import BillAI
import Foundation

/// Where a conversation happens. Each place gets its own grants.
public enum Surface: String, Sendable, Codable {
    /// A private support ticket channel.
    case ticket
    /// A public help forum post.
    case forum
    /// A public server channel where someone mentioned Bill.
    case channel
    /// A direct message to the bot.
    case dm
    /// A chat inside the product, where the person is signed in.
    case web
}

/// Who Bill is talking to. Tools read data about this person only, never someone they name.
public struct Requester: Sendable, Codable, Hashable {
    public var discordId: String?
    /// The product account, when the Discord account is linked to one or the person is signed in.
    public var accountId: String?
    public var name: String
    public init(discordId: String? = nil, accountId: String? = nil, name: String) {
        self.discordId = discordId
        self.accountId = accountId
        self.name = name
    }
}

public struct Turn: Sendable, Codable, Hashable {
    public enum Author: String, Sendable, Codable { case requester, staff, bill, other }
    public var author: Author
    public var name: String
    public var text: String
    public var at: Date
    public init(author: Author, name: String, text: String, at: Date = Date()) {
        self.author = author
        self.name = name
        self.text = text
        self.at = at
    }
}

public struct Conversation: Sendable {
    /// Stable for the life of the conversation: a channel, thread or chat id.
    public var id: String
    public var surface: Surface
    public var requester: Requester
    public var turns: [Turn]
    /// The ticket this conversation belongs to, in the help desk's own terms.
    public var ticket: String?
    public init(id: String, surface: Surface, requester: Requester, turns: [Turn], ticket: String? = nil) {
        self.id = id
        self.surface = surface
        self.requester = requester
        self.turns = turns
        self.ticket = ticket
    }

    /// The latest thing the requester said.
    public var lastRequesterText: String { turns.last { $0.author == .requester }?.text ?? "" }
}

/// What Bill decided to do with a conversation.
public struct Reply: Sendable, Codable {
    public var text: String
    /// Bill handed the conversation to a person and should stay quiet until asked.
    public var handedOff: Bool
    public var closed: Bool
    public var usage: Usage
    public init(text: String, handedOff: Bool = false, closed: Bool = false, usage: Usage = Usage()) {
        self.text = text
        self.handedOff = handedOff
        self.closed = closed
        self.usage = usage
    }
}
