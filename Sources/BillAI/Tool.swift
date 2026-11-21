import Foundation

/// What a tool's `execute` learns about the call, as in the AI SDK.
public struct ToolCallOptions: Sendable {
    public let toolCallId: String
    public let messages: [ModelMessage]
    public let stepNumber: Int
    public init(toolCallId: String, messages: [ModelMessage], stepNumber: Int) {
        self.toolCallId = toolCallId
        self.messages = messages
        self.stepNumber = stepNumber
    }
}

/// A tool the model can call: the AI SDK's `tool({ description, inputSchema, execute })`.
public struct Tool: Sendable {
    public let name: String
    public let description: String
    public let inputSchema: JSONValue
    public let execute: @Sendable (JSONValue, ToolCallOptions) async throws -> JSONValue

    public init(
        name: String, description: String, inputSchema: JSONValue,
        execute: @escaping @Sendable (JSONValue, ToolCallOptions) async throws -> JSONValue
    ) {
        self.name = name
        self.description = description
        self.inputSchema = inputSchema
        self.execute = execute
    }

    /// A tool with typed input and output. Input that doesn't decode is reported to the model as an error.
    public static func typed<Input: Decodable & Sendable, Output: Encodable & Sendable>(
        _ name: String, description: String, schema: JSONValue,
        execute: @escaping @Sendable (Input, ToolCallOptions) async throws -> Output
    ) -> Tool {
        Tool(name: name, description: description, inputSchema: schema) { input, options in
            let decoded: Input
            do { decoded = try input.decode(Input.self) } catch { throw ToolError("The input doesn't match the schema: \(error)") }
            return try JSONValue(encoding: try await execute(decoded, options))
        }
    }

    /// Wraps execute, for auditing, permission checks and the like.
    public func wrapped(
        _ around: @escaping @Sendable (Tool, JSONValue, ToolCallOptions) async throws -> JSONValue
    ) -> Tool {
        let inner = self
        return Tool(name: name, description: description, inputSchema: inputSchema) { try await around(inner, $0, $1) }
    }
}

/// An error whose message is meant for the model.
public struct ToolError: Error, Sendable, CustomStringConvertible {
    public let description: String
    public init(_ description: String) { self.description = description }
}

public enum ToolChoice: Sendable, Hashable {
    case auto, none, required
    case tool(String)
}
