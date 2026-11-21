import Foundation

/// Which earlier tool calls `pruneMessages` drops.
public enum PruneToolCalls: Sendable {
    case none
    case all
    /// Keeps tool calls and results in the last `n` messages.
    case beforeLastMessages(Int)
}

/// Removes tool traffic and empty messages from history: the AI SDK's `pruneMessages`.
public func pruneMessages(_ messages: [ModelMessage], toolCalls: PruneToolCalls, emptyMessages: Bool = true) -> [ModelMessage] {
    let keepFrom: Int =
        switch toolCalls {
        case .none: 0
        case .all: messages.count
        case let .beforeLastMessages(n): max(0, messages.count - n)
        }
    // Keep a tool result only beside its call, or providers refuse the history.
    var keptCalls = Set<String>()
    for message in messages[keepFrom...] { if case let .assistant(_, calls) = message { calls.forEach { keptCalls.insert($0.id) } } }
    var out: [ModelMessage] = []
    for (index, message) in messages.enumerated() {
        switch message {
        case let .assistant(text, calls) where index < keepFrom:
            if !text.isEmpty || !emptyMessages { out.append(.assistant(text: text, toolCalls: [])) }
        case let .assistant(text, calls):
            if !(emptyMessages && text.isEmpty && calls.isEmpty) { out.append(message) }
        case let .tool(results):
            let kept = results.filter { keptCalls.contains($0.callId) }
            if !kept.isEmpty { out.append(.tool(kept)) }
        default:
            out.append(message)
        }
    }
    return out
}

/// A rough token count, about four characters a token, which is enough to budget a context window.
public func estimateTokens(_ messages: [ModelMessage]) -> Int {
    messages.reduce(0) { total, m in
        let chars: Int =
            switch m {
            case let .system(t), let .user(t): t.count
            case let .assistant(t, calls): t.count + calls.reduce(0) { $0 + $1.input.text.count + $1.name.count }
            case let .tool(results): results.reduce(0) { $0 + $1.output.text.count }
            }
        return total + chars / 4 + 4
    }
}

/// Fits history into a token budget: first old tool traffic goes, then the oldest turns, never the latest user message.
public func fitToBudget(_ messages: [ModelMessage], maxTokens: Int, keepRecent: Int = 6) -> [ModelMessage] {
    if estimateTokens(messages) <= maxTokens { return messages }
    var fitted = pruneMessages(messages, toolCalls: .beforeLastMessages(keepRecent))
    while estimateTokens(fitted) > maxTokens, fitted.count > 1 {
        fitted.removeFirst()
        // Never start on a tool result whose call was dropped.
        while case .tool = fitted.first { fitted.removeFirst() }
    }
    return fitted
}

/// Cuts a long text to a character budget, saying what was cut.
public func clip(_ text: String, _ limit: Int) -> String {
    text.count <= limit ? text : "\(text.prefix(limit))\n[… \(text.count - limit) more characters cut]"
}
