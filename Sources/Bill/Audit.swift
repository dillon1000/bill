import BillAI
import Crypto
import Foundation
import Logging
import PostgresNIO

/// One thing Bill did. Each event carries the hash of the one before it, so a deleted or edited event breaks the chain.
public struct AuditEvent: Sendable, Codable, Hashable {
    public enum Kind: String, Sendable, Codable {
        /// A conversation began, with the scopes it was granted.
        case started
        /// One model call.
        case step
        /// A tool was about to run.
        case toolCall = "tool_call"
        case toolResult = "tool_result"
        /// A tool was asked for outside the conversation's scopes.
        case denied
        case reply
        case error
    }

    public var id: UUID
    public var at: Date
    public var conversation: String
    public var surface: String
    public var discordId: String?
    public var accountId: String?
    public var kind: Kind
    public var tool: String?
    public var scope: String?
    public var data: JSONValue
    public var previousHash: String
    public var hash: String

    /// What the hash covers: every field but the hash itself.
    var canonical: String {
        let fields: JSONValue = [
            "id": .string(id.uuidString.lowercased()), "at": .number(at.timeIntervalSince1970.rounded(.down)),
            "conversation": .string(conversation), "surface": .string(surface), "discordId": discordId.map(JSONValue.string) ?? .null,
            "accountId": accountId.map(JSONValue.string) ?? .null, "kind": .string(kind.rawValue), "tool": tool.map(JSONValue.string) ?? .null,
            "scope": scope.map(JSONValue.string) ?? .null, "data": data, "previousHash": .string(previousHash),
        ]
        return fields.text
    }

    static func digest(_ text: String) -> String { SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined() }
}

/// Where audit events are kept. It only ever appends; give its database role insert and select, nothing else.
public protocol AuditSink: Sendable {
    func append(_ event: AuditEvent) async throws
    /// The newest event's hash, to continue the chain after a restart.
    func lastHash() async throws -> String?
}

/// Records every action Bill takes. Recording fails closed: when an event can't be written, the action doesn't happen.
public actor AuditLog {
    let sink: any AuditSink
    let redactor: Redactor
    var last: String?
    var tail: Task<Void, any Error>?
    let maxField = 8000

    public init(sink: any AuditSink, redactor: Redactor = Redactor()) {
        self.sink = sink
        self.redactor = redactor
    }

    @discardableResult
    public func record(_ kind: AuditEvent.Kind, _ conversation: Conversation, tool: String? = nil, scope: Scope? = nil, data: JSONValue = [:]) async throws
        -> AuditEvent
    {
        if last == nil {
            let loaded = try await sink.lastHash() ?? String(repeating: "0", count: 64)
            if last == nil { last = loaded }
        }
        // No suspension from reading `last` to queueing the append, so parallel tool calls can't fork the chain.
        var event = AuditEvent(
            id: UUID(), at: Date(timeIntervalSince1970: Date().timeIntervalSince1970.rounded(.down)), conversation: conversation.id,
            surface: conversation.surface.rawValue, discordId: conversation.requester.discordId, accountId: conversation.requester.accountId,
            kind: kind, tool: tool, scope: scope?.rawValue, data: scrub(data), previousHash: last!, hash: ""
        )
        event.hash = AuditEvent.digest(event.canonical)
        last = event.hash
        let previous = tail, sink = sink, written = event
        let append = Task {
            try await previous?.value
            try await sink.append(written)
        }
        tail = append
        do {
            try await append.value
        } catch {
            // Everything queued after a failed write fails too; the next record starts again from what's stored.
            last = nil
            tail = nil
            throw error
        }
        return event
    }

    /// Secrets out, long values clipped.
    func scrub(_ value: JSONValue) -> JSONValue {
        switch value {
        case let .string(s): .string(clip(redactor.redact(s), maxField))
        case let .array(a): .array(a.prefix(200).map(scrub))
        case let .object(o): .object(o.mapValues(scrub))
        default: value
        }
    }

    /// Checks a run of events, oldest first, links up and hashes true.
    public static func verify(_ events: [AuditEvent]) -> Bool {
        var previous: String?
        for e in events {
            if let previous, e.previousHash != previous { return false }
            if AuditEvent.digest(e.canonical) != e.hash { return false }
            previous = e.hash
        }
        return true
    }
}

/// Writes events as JSON lines, for a local run.
public actor JSONLinesAuditSink: AuditSink {
    let url: URL
    public init(path: String) { url = URL(fileURLWithPath: path) }

    public func append(_ event: AuditEvent) async throws {
        var line = try JSONEncoder.bill.encode(event)
        line.append(0x0A)
        if !FileManager.default.fileExists(atPath: url.path) { FileManager.default.createFile(atPath: url.path, contents: nil) }
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: line)
    }

    public func lastHash() async throws -> String? {
        guard let data = FileManager.default.contents(atPath: url.path) else { return nil }
        guard let line = String(decoding: data, as: UTF8.self).split(separator: "\n").last else { return nil }
        return try JSONDecoder.bill.decode(AuditEvent.self, from: Data(line.utf8)).hash
    }

    public func events() throws -> [AuditEvent] {
        guard let data = FileManager.default.contents(atPath: url.path) else { return [] }
        return try String(decoding: data, as: UTF8.self).split(separator: "\n").map { try JSONDecoder.bill.decode(AuditEvent.self, from: Data($0.utf8)) }
    }
}

/// Writes events to Postgres, into the table `bill_audit` (see `PostgresAuditSink.schema`).
public struct PostgresAuditSink: AuditSink {
    let client: PostgresClient
    let logger: Logger

    public init(client: PostgresClient, logger: Logger = Logger(label: "bill.audit")) {
        self.client = client
        self.logger = logger
    }

    public static let schema = """
        create table if not exists bill_audit (
          seq bigserial primary key,
          id uuid not null unique,
          at timestamptz not null,
          conversation text not null,
          surface text not null,
          discord_id text,
          account_id text,
          kind text not null,
          tool text,
          scope text,
          data jsonb not null,
          previous_hash text not null,
          hash text not null unique
        );
        create index if not exists bill_audit_conversation_idx on bill_audit (conversation, seq);
        create index if not exists bill_audit_account_idx on bill_audit (account_id, seq);
        """

    public func append(_ e: AuditEvent) async throws {
        let data = e.data.text
        try await client.query(
            """
            insert into bill_audit (id, at, conversation, surface, discord_id, account_id, kind, tool, scope, data, previous_hash, hash)
            values (\(e.id), \(e.at), \(e.conversation), \(e.surface), \(e.discordId), \(e.accountId), \(e.kind.rawValue), \(e.tool), \(e.scope),
              \(data)::jsonb, \(e.previousHash), \(e.hash))
            """, logger: logger
        )
    }

    public func lastHash() async throws -> String? {
        for try await hash in try await client.query("select hash from bill_audit order by seq desc limit 1", logger: logger).decode(String.self) {
            return hash
        }
        return nil
    }
}

extension JSONDecoder {
    static let bill: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
