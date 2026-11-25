import Bill
import DiscordBM
import Foundation
import Logging

/// A support ticket channel, as the help desk sees it.
public struct TicketInfo: Sendable {
    public var ref: String
    public var openerDiscordId: String
    /// False once a person has claimed the ticket or Bill handed it off. Bill then answers only when mentioned.
    public var billActive: Bool
    public init(ref: String, openerDiscordId: String, billActive: Bool) {
        self.ref = ref
        self.openerDiscordId = openerDiscordId
        self.billActive = billActive
    }
}

public protocol TicketDirectory: Sendable {
    func ticket(channel: String) async -> TicketInfo?
}

/// Maps a Discord user to a requester, linking the product account when there is one.
public protocol IdentityResolver: Sendable {
    /// Nil when Bill shouldn't answer this person at all, such as someone staff have banned from Bill.
    func requester(discordId: String, name: String) async -> Requester?
}

/// Answers in ticket channels, help forum posts, DMs, and any channel where someone mentions Bill.
public actor FrontDesk {
    public struct Settings: Sendable {
        public var guildId: String
        /// Forum channels whose posts Bill answers.
        public var forums: Set<String>
        public var allowDMs: Bool
        /// Answer anyone who mentions Bill, or replies to it, in the server's other channels.
        public var answerMentions: Bool
        /// Pinged on a hand-off. The only mention Bill ever makes.
        public var handOffRole: String?
        /// Replies a person can get an hour, across all surfaces.
        public var hourlyLimit: Int
        public init(guildId: String, forums: Set<String>, allowDMs: Bool, answerMentions: Bool = true, handOffRole: String?, hourlyLimit: Int = 30) {
            self.guildId = guildId
            self.forums = forums
            self.allowDMs = allowDMs
            self.answerMentions = answerMentions
            self.handOffRole = handOffRole
            self.hourlyLimit = hourlyLimit
        }
    }

    let bill: Bill
    let client: any DiscordClient
    let settings: Settings
    let tickets: any TicketDirectory
    let identity: any IdentityResolver
    let logger: Logger
    var me: String?
    var parents: [String: (parent: String?, owner: String?)] = [:]
    var pending: [String: Task<Void, Never>] = [:]
    var quiet: [String: Date] = [:]
    var replies: [String: [Date]] = [:]
    var answering: Set<String> = []

    public init(bill: Bill, client: any DiscordClient, settings: Settings, tickets: any TicketDirectory, identity: any IdentityResolver, logger: Logger) {
        self.bill = bill
        self.client = client
        self.settings = settings
        self.tickets = tickets
        self.identity = identity
        self.logger = logger
    }

    enum Place { case ticket(TicketInfo), forum(owner: String), dm, channel(asker: String, message: String) }

    public func handle(_ event: Gateway.Event) async {
        switch event.data {
        case let .ready(ready): me = ready.user.id.rawValue
        case let .messageCreate(message): await received(message)
        default: break
        }
    }

    func received(_ m: Gateway.MessageCreate) async {
        // READY can arrive before anyone listens to the gateway's events, so ask Discord who we are when it hasn't been seen.
        if me == nil { me = try? await client.getOwnUser().decode().id.rawValue }
        guard let author = m.author, author.bot != true, m.webhook_id == nil, !m.content.isEmpty, let me else { return }
        let channel = m.channel_id.rawValue
        let mentioned = m.mentions.contains { $0.id.rawValue == me }
        let place: Place
        if m.guild_id == nil {
            guard settings.allowDMs else { return }
            place = .dm
        } else if m.guild_id?.rawValue != settings.guildId {
            return
        } else if let ticket = await tickets.ticket(channel: channel) {
            guard author.id.rawValue == ticket.openerDiscordId || mentioned, ticket.billActive || mentioned else { return }
            place = .ticket(ticket)
        } else if let thread = await thread(channel), let parent = thread.parent, settings.forums.contains(parent), let owner = thread.owner {
            guard author.id.rawValue == owner || mentioned else { return }
            place = .forum(owner: owner)
        } else if settings.answerMentions, mentioned || m.referenced_message?.value.author?.id.rawValue == me {
            place = .channel(asker: author.id.rawValue, message: m.id.rawValue)
        } else {
            return
        }
        // A ticket says itself whether Bill is on it, so staff can hand it back; elsewhere Bill stays quiet a day after handing off.
        let isTicket = if case .ticket = place { true } else { false }
        if !isTicket, let until = quiet[channel], until > Date(), !mentioned { return }

        // Wait for the person to finish typing a burst of messages, then answer them together.
        let requesterId: String =
            switch place {
            case let .ticket(t): t.openerDiscordId
            case let .forum(owner): owner
            case .dm: author.id.rawValue
            case let .channel(asker, _): asker
            }
        // A shared channel has many askers; one person's burst mustn't cancel another's answer.
        let key = if case .channel = place { "\(channel):\(requesterId)" } else { channel }
        pending[key]?.cancel()
        let name = m.member?.nick ?? author.global_name ?? author.username
        pending[key] = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await self?.answer(key: key, channel: channel, place: place, requesterId: requesterId, name: name)
        }
    }

    func thread(_ channel: String) async -> (parent: String?, owner: String?)? {
        if let known = parents[channel] { return known }
        guard let c = try? await client.getChannel(id: ChannelSnowflake(channel)).decode() else { return nil }
        let entry = (parent: c.type == .publicThread ? c.parent_id?.rawValue : nil, owner: c.owner_id?.rawValue)
        parents[channel] = entry
        return entry
    }

    /// Answers a ticket channel or DM now, whatever the ticket's state, as when staff ask Bill to pick it up, in place of any answer still waiting for
    /// the requester to finish typing. Nil when the channel is neither, Bill doesn't answer its requester, or it's already answering there.
    public func respond(inChannel channel: String) async throws -> Reply? {
        pending.removeValue(forKey: channel)?.cancel()
        if me == nil { me = try? await client.getOwnUser().decode().id.rawValue }
        let place: Place, requesterId: String
        if let ticket = await tickets.ticket(channel: channel) {
            (place, requesterId) = (.ticket(ticket), ticket.openerDiscordId)
        } else if let c = try? await client.getChannel(id: ChannelSnowflake(channel)).decode(), c.type == .dm, let recipient = c.recipients?.first {
            (place, requesterId) = (.dm, recipient.id.rawValue)
        } else {
            return nil
        }
        let user = try await client.getUser(id: UserSnowflake(requesterId)).decode()
        return try await reply(channel: channel, place: place, requesterId: requesterId, name: user.global_name ?? user.username, limited: false)
    }

    func answer(key: String, channel: String, place: Place, requesterId: String, name: String) async {
        // Still uncancelled, so still the queued task: it stops being one a triggered reply can cancel.
        guard !Task.isCancelled else { return }
        pending[key] = nil
        do {
            _ = try await reply(channel: channel, place: place, requesterId: requesterId, name: name, limited: true)
        } catch {
            logger.error("Bill couldn't answer in \(channel): \(error)")
        }
    }

    func reply(channel: String, place: Place, requesterId: String, name: String, limited: Bool) async throws -> Reply? {
        guard answering.insert(channel).inserted else { return nil }
        defer { answering.remove(channel) }
        guard let requester = await identity.requester(discordId: requesterId, name: name) else { return nil }
        let now = Date()
        let recent = (replies[requesterId] ?? []).filter { now.timeIntervalSince($0) < 3600 }
        guard !limited || recent.count < settings.hourlyLimit else { return nil }
        replies[requesterId] = recent + [now]

        let surface: Surface, ticket: String?, replyTo: String?
        switch place {
        case let .ticket(t): (surface, ticket, replyTo) = (.ticket, t.ref, nil)
        case .forum: (surface, ticket, replyTo) = (.forum, nil, nil)
        case .dm: (surface, ticket, replyTo) = (.dm, nil, nil)
        case let .channel(_, message): (surface, ticket, replyTo) = (.channel, nil, message)
        }
        let typing = Task {
            while !Task.isCancelled {
                _ = try? await client.triggerTypingIndicator(channelId: ChannelSnowflake(channel))
                try? await Task.sleep(for: .seconds(8))
            }
        }
        defer { typing.cancel() }
        let turns = try await history(channel: channel, requesterId: requesterId, surface: surface)
        let reply = try await bill.respond(to: Conversation(id: "discord:\(channel)", surface: surface, requester: requester, turns: turns, ticket: ticket))
        if reply.handedOff { quiet[channel] = Date().addingTimeInterval(86400) }
        let ping = reply.handedOff ? settings.handOffRole : nil
        for (index, chunk) in FrontDesk.chunks(reply.text).enumerated() {
            let content = index == 0 && ping != nil ? "<@&\(ping!)> \(chunk)" : chunk
            try await client.createMessage(
                channelId: ChannelSnowflake(channel),
                payload: .init(
                    content: content,
                    allowed_mentions: .init(parse: [], roles: ping.map { [RoleSnowflake($0)] } ?? []),
                    message_reference: index == 0 ? replyTo.map { .init(message_id: MessageSnowflake($0), fail_if_not_exists: false) } : nil
                )
            ).guardSuccess()
        }
        return reply
    }

    /// The channel's recent messages, oldest first.
    func history(channel: String, requesterId: String, surface: Surface) async throws -> [Turn] {
        let messages = try await client.listMessages(channelId: ChannelSnowflake(channel), limit: surface == .channel ? 20 : 50).decode()
        return messages.reversed().compactMap { m -> Turn? in
            guard !m.content.isEmpty, let user = m.author else { return nil }
            let id = user.id.rawValue
            let author: Turn.Author =
                if id == me { .bill } else if id == requesterId { .requester } else if surface == .ticket { .staff } else { .other }
            return Turn(author: author, name: user.global_name ?? user.username, text: m.content, at: m.timestamp.date)
        }
    }

    /// Splits text into Discord-sized messages, on line breaks where it can.
    static func chunks(_ text: String, limit: Int = 1900) -> [String] {
        var out: [String] = [], current = ""
        for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
            if current.count + line.count + 1 > limit, !current.isEmpty {
                out.append(current)
                current = ""
            }
            var rest = Substring(line)
            while rest.count > limit {
                out.append(String(rest.prefix(limit)))
                rest = rest.dropFirst(limit)
            }
            current += current.isEmpty ? String(rest) : "\n\(rest)"
        }
        if !current.isEmpty { out.append(current) }
        return out
    }
}
