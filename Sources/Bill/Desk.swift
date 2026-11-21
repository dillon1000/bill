import BillAI
import Foundation

public enum Priority: String, Sendable, Codable, CaseIterable { case low, normal, high, urgent }

/// The help desk Bill works in: how it hands a ticket to a person, triages and closes one.
public protocol Desk: Sendable {
    func handOff(_ conversation: Conversation, reason: String, priority: Priority) async throws
    func triage(_ conversation: Conversation, priority: Priority, labels: [String], note: String?) async throws
    func close(_ conversation: Conversation, summary: String) async throws
}

/// The ticket tools, each bound to the conversation it was made for.
public struct DeskPlugin: Plugin {
    let desk: any Desk
    /// Labels Bill may set. Anything else is refused, so a prompt can't invent new ones.
    let labels: [String]

    public init(desk: any Desk, labels: [String]) {
        self.desk = desk
        self.labels = labels
    }

    struct HandOff: Decodable, Sendable { let reason: String; let priority: Priority }
    struct Triage: Decodable, Sendable { let priority: Priority; let labels: [String]; let note: String? }
    struct Close: Decodable, Sendable { let summary: String; let confirmation: String }
    struct Done: Encodable, Sendable { let done: Bool }

    public func tools(for conversation: Conversation) async -> [BillTool] {
        let desk = desk, allowed = Set(labels)
        return [
            BillTool(
                .handOff, writes: true,
                .typed(
                    "hand_off",
                    description:
                        "Hand the conversation to a human on the support team. Use it when the person asks for a human, when money, refunds, bans, appeals, data deletion, legal or security matters come up, when you're unsure, or when you couldn't solve it after trying. After this, stop and tell the person a human will follow up.",
                    schema: Schema.object([
                        "reason": Schema.string("For staff: what the person needs, what you checked and what you found.", maxLength: 2000),
                        "priority": Schema.oneOf(Priority.allCases.map(\.rawValue), "urgent only for outages, security or data loss"),
                    ])
                ) { (input: HandOff, _) in
                    try await desk.handOff(conversation, reason: input.reason, priority: input.priority)
                    return Done(done: true)
                }
            ),
            BillTool(
                .triage, writes: true,
                .typed(
                    "triage_ticket",
                    description: "Set the ticket's priority and labels, and optionally leave an internal note for staff. The person never sees the note.",
                    schema: Schema.object([
                        "priority": Schema.oneOf(Priority.allCases.map(\.rawValue), "How urgent the ticket is"),
                        "labels": Schema.array(Schema.oneOf(labels, "A label"), "Labels that fit", maxItems: 5),
                        "note": Schema.optional(Schema.string("An internal note for staff", maxLength: 2000)),
                    ])
                ) { (input: Triage, _) in
                    let unknown = input.labels.filter { !allowed.contains($0) }
                    guard unknown.isEmpty else { throw ToolError("Unknown labels: \(unknown.joined(separator: ", ")). Use only: \(allowed.sorted().joined(separator: ", ")).") }
                    try await desk.triage(conversation, priority: input.priority, labels: input.labels, note: input.note)
                    return Done(done: true)
                }
            ),
            BillTool(
                .closeTicket, writes: true,
                .typed(
                    "close_ticket",
                    description:
                        "Close the ticket. Only after the person has said in their own words that their problem is solved or that they want it closed. Quote those words exactly in confirmation.",
                    schema: Schema.object([
                        "summary": Schema.string("For staff: the problem and how it was solved", maxLength: 2000),
                        "confirmation": Schema.string("The person's own words, copied exactly from their latest message, saying it's solved or to close it", maxLength: 500),
                    ])
                ) { (input: Close, _) in
                    let quote = input.confirmation.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard quote.count >= 2, conversation.lastRequesterText.localizedCaseInsensitiveContains(quote) else {
                        throw ToolError("The confirmation isn't in the person's latest message. Ask them whether it's solved before closing.")
                    }
                    try await desk.close(conversation, summary: input.summary)
                    return Done(done: true)
                }
            ),
        ]
    }
}
