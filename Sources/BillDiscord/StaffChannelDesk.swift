import Bill
import DiscordBM

/// A help desk that's just a staff channel: hand-offs, triage and closures are posted there. For products without a ticket system.
public struct StaffChannelDesk: Desk {
    let client: any DiscordClient
    let channel: String

    public init(client: any DiscordClient, channel: String) {
        self.client = client
        self.channel = channel
    }

    func post(_ text: String) async throws {
        try await client.createMessage(channelId: ChannelSnowflake(channel), payload: .init(content: String(text.prefix(1900)), allowed_mentions: .init(parse: [])))
            .guardSuccess()
    }

    func origin(_ c: Conversation) -> String {
        let place = c.id.hasPrefix("discord:") ? "<#\(c.id.dropFirst(8))>" : "`\(c.id)`"
        return "\(place) · \(c.requester.name)"
    }

    public func handOff(_ c: Conversation, reason: String, priority: Priority) async throws {
        try await post("**Hand-off (\(priority.rawValue))** \(origin(c))\n\(reason)")
    }

    public func triage(_ c: Conversation, priority: Priority, labels: [String], note: String?) async throws {
        try await post("**Triaged (\(priority.rawValue))** \(origin(c)) \(labels.joined(separator: ", "))\(note.map { "\n\($0)" } ?? "")")
    }

    public func close(_ c: Conversation, summary: String) async throws {
        try await post("**Closed** \(origin(c))\n\(summary)")
    }
}

/// Discord identity only, for products without accounts to link.
public struct DiscordOnlyIdentity: IdentityResolver {
    public init() {}
    public func requester(discordId: String, name: String) async -> Requester { Requester(discordId: discordId, name: name) }
}

/// No ticket channels.
public struct NoTickets: TicketDirectory {
    public init() {}
    public func ticket(channel: String) async -> TicketInfo? { nil }
}
