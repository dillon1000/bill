import Foundation

/// A message in a conversation with a model, after the AI SDK's `ModelMessage`.
public enum ModelMessage: Sendable, Hashable, Codable {
    case system(String)
    case user(String)
    case assistant(text: String, toolCalls: [ToolCall] = [])
    case tool([ToolResult])

    public var role: String {
        switch self {
        case .system: "system"
        case .user: "user"
        case .assistant: "assistant"
        case .tool: "tool"
        }
    }
}

public struct ToolCall: Sendable, Hashable, Codable {
    public let id: String
    public let name: String
    public let input: JSONValue
    public init(id: String, name: String, input: JSONValue) {
        self.id = id
        self.name = name
        self.input = input
    }
}

public struct ToolResult: Sendable, Hashable, Codable {
    public let callId: String
    public let name: String
    public let output: JSONValue
    /// The AI SDK's `tool-error`: the model sees the error and can recover.
    public let isError: Bool
    public init(callId: String, name: String, output: JSONValue, isError: Bool = false) {
        self.callId = callId
        self.name = name
        self.output = output
        self.isError = isError
    }
}

public struct Usage: Sendable, Hashable, Codable {
    public var inputTokens = 0
    public var outputTokens = 0
    public var cachedInputTokens = 0
    public var reasoningTokens = 0
    /// What the provider charged, in US dollars, when it says.
    public var cost: Double = 0
    public init() {}
    public static func + (a: Usage, b: Usage) -> Usage {
        var u = a
        u.inputTokens += b.inputTokens
        u.outputTokens += b.outputTokens
        u.cachedInputTokens += b.cachedInputTokens
        u.reasoningTokens += b.reasoningTokens
        u.cost += b.cost
        return u
    }
}

public enum FinishReason: String, Sendable, Codable {
    case stop, length, toolCalls = "tool-calls", contentFilter = "content-filter", error, other
}
