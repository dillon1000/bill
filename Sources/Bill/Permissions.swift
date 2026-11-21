import BillAI
import Foundation

/// A permission a tool needs. A conversation holds a set of them; a tool outside the set isn't offered to the model and refuses to run.
public struct Scope: RawRepresentable, Hashable, Sendable, Codable, ExpressibleByStringLiteral, CustomStringConvertible {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public init(stringLiteral value: String) { rawValue = value }
    public var description: String { rawValue }

    public static let readDocs: Scope = "docs:read"
    public static let readCode: Scope = "code:read"
    public static let readHistory: Scope = "history:read"
    /// The requester's own account basics: plan, standing, the names of what they own.
    public static let readAccount: Scope = "account:read"
    /// The requester's own detailed data, only when they have opted in to support access.
    public static let readAccountDetail: Scope = "account:detail"
    public static let handOff: Scope = "ticket:handoff"
    public static let triage: Scope = "ticket:triage"
    public static let closeTicket: Scope = "ticket:close"
    public static let fileIssue: Scope = "issues:write"
}

/// Decides what a conversation may do. Implement it to fit your product; `SurfacePolicy` is a sensible default.
public protocol Policy: Sendable {
    func scopes(for conversation: Conversation) async -> Set<Scope>
}

/// Grants by surface, with account scopes only once the requester is identified.
public struct SurfacePolicy: Policy {
    public var bySurface: [Surface: Set<Scope>]
    /// Whether the requester has opted in to support reading their detailed data.
    public var detailConsent: @Sendable (Requester) async -> Bool

    public init(bySurface: [Surface: Set<Scope>] = SurfacePolicy.defaults, detailConsent: @escaping @Sendable (Requester) async -> Bool = { _ in false }) {
        self.bySurface = bySurface
        self.detailConsent = detailConsent
    }

    public static let defaults: [Surface: Set<Scope>] = [
        .ticket: [.readDocs, .readCode, .readHistory, .readAccount, .readAccountDetail, .handOff, .triage, .closeTicket, .fileIssue],
        .dm: [.readDocs, .readCode, .readHistory, .readAccount, .readAccountDetail, .handOff, .fileIssue],
        .web: [.readDocs, .readCode, .readHistory, .readAccount, .readAccountDetail, .handOff, .fileIssue],
        // A forum post is public: nothing about the poster's account may be read into it.
        .forum: [.readDocs, .readCode, .handOff, .fileIssue],
    ]

    public func scopes(for conversation: Conversation) async -> Set<Scope> {
        var scopes = bySurface[conversation.surface] ?? []
        if conversation.requester.accountId == nil { scopes.subtract([.readAccount, .readAccountDetail, .readHistory]) }
        if scopes.contains(.readAccountDetail), !(await detailConsent(conversation.requester)) { scopes.remove(.readAccountDetail) }
        if conversation.ticket == nil { scopes.subtract([.triage, .closeTicket]) }
        return scopes
    }
}

/// A tool and the scope it needs.
public struct BillTool: Sendable {
    public let scope: Scope
    /// Writes change something outside Bill. They're audited before they run, and a failed audit stops them.
    public let writes: Bool
    public let tool: Tool
    public init(_ scope: Scope, writes: Bool = false, _ tool: Tool) {
        self.scope = scope
        self.writes = writes
        self.tool = tool
    }
}

/// A source of tools and context: a product's accounts, a code host, a docs site, a help desk.
public protocol Plugin: Sendable {
    /// Tools for this conversation. They're bound to its requester, so none takes a user id.
    func tools(for conversation: Conversation) async -> [BillTool]
    /// Facts worth having before the first step, such as the requester's plan. Returned as data, never as instructions.
    func briefing(for conversation: Conversation, scopes: Set<Scope>) async -> String?
}

extension Plugin {
    public func briefing(for conversation: Conversation, scopes: Set<Scope>) async -> String? { nil }
}
