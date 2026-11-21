import AsyncHTTPClient
import Foundation
import NIOCore
import NIOHTTP1

/// One request to a model, after the AI SDK's `LanguageModelV2CallOptions`.
public struct ModelCall: Sendable {
    public var system: String?
    public var messages: [ModelMessage]
    public var tools: [Tool]
    public var toolChoice: ToolChoice
    public var maxOutputTokens: Int?
    public var reasoningEffort: String?
}

public struct ModelResponse: Sendable {
    public var text: String
    public var toolCalls: [ToolCall]
    public var finishReason: FinishReason
    public var usage: Usage
    public var responseId: String?
    public init(text: String, toolCalls: [ToolCall], finishReason: FinishReason, usage: Usage, responseId: String? = nil) {
        self.text = text
        self.toolCalls = toolCalls
        self.finishReason = finishReason
        self.usage = usage
        self.responseId = responseId
    }
}

/// The provider interface, after the AI SDK's `LanguageModelV2`.
public protocol LanguageModel: Sendable {
    var provider: String { get }
    var modelId: String { get }
    func generate(_ call: ModelCall) async throws -> ModelResponse
}

public struct ModelError: Error, Sendable, CustomStringConvertible {
    public let status: Int
    public let description: String
}

/// Any OpenAI-compatible Chat Completions endpoint, such as OpenRouter. The AI SDK's `createOpenAICompatible`.
public struct OpenAICompatibleModel: LanguageModel {
    public let provider: String
    public let modelId: String
    let baseURL: String
    let apiKey: String
    let headers: [(String, String)]
    let http: HTTPClient
    let maxRetries: Int
    let timeout: TimeAmount

    public init(
        provider: String, modelId: String, baseURL: String, apiKey: String, headers: [(String, String)] = [],
        http: HTTPClient = .shared, maxRetries: Int = 2, timeout: TimeAmount = .seconds(120)
    ) {
        self.provider = provider
        self.modelId = modelId
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.headers = headers
        self.http = http
        self.maxRetries = maxRetries
        self.timeout = timeout
    }

    /// An OpenRouter model, such as `openai/gpt-6-luna`.
    public static func openRouter(_ modelId: String, apiKey: String, appName: String = "Bill", appURL: String? = nil, http: HTTPClient = .shared)
        -> OpenAICompatibleModel
    {
        var headers = [("X-Title", appName)]
        if let appURL { headers.append(("HTTP-Referer", appURL)) }
        return OpenAICompatibleModel(
            provider: "openrouter", modelId: modelId, baseURL: "https://openrouter.ai/api/v1", apiKey: apiKey, headers: headers, http: http
        )
    }

    public func generate(_ call: ModelCall) async throws -> ModelResponse {
        let body = try JSONEncoder.bill.encode(payload(call))
        var attempt = 0
        while true {
            var request = HTTPClientRequest(url: "\(baseURL)/chat/completions")
            request.method = .POST
            request.headers.add(name: "Authorization", value: "Bearer \(apiKey)")
            request.headers.add(name: "Content-Type", value: "application/json")
            for (name, value) in headers { request.headers.add(name: name, value: value) }
            request.body = .bytes(ByteBuffer(bytes: body))
            let response = try await http.execute(request, timeout: timeout)
            let data = try await response.body.collect(upTo: 16 << 20)
            let status = Int(response.status.code)
            if status == 429 || status >= 500, attempt < maxRetries {
                attempt += 1
                try await Task.sleep(for: .milliseconds(500 << attempt))
                continue
            }
            guard (200..<300).contains(status) else {
                throw ModelError(status: status, description: "\(provider) answered \(status): \(String(buffer: data).prefix(500))")
            }
            return try parse(Data(buffer: data))
        }
    }

    func payload(_ call: ModelCall) -> JSONValue {
        var messages: [JSONValue] = []
        if let system = call.system { messages.append(["role": "system", "content": .string(system)]) }
        for message in call.messages {
            switch message {
            case let .system(text): messages.append(["role": "system", "content": .string(text)])
            case let .user(text): messages.append(["role": "user", "content": .string(text)])
            case let .assistant(text, calls):
                var m: [String: JSONValue] = ["role": "assistant", "content": calls.isEmpty || !text.isEmpty ? .string(text) : .null]
                if !calls.isEmpty {
                    m["tool_calls"] = .array(
                        calls.map { ["id": .string($0.id), "type": "function", "function": ["name": .string($0.name), "arguments": .string($0.input.text)]] }
                    )
                }
                messages.append(.object(m))
            case let .tool(results):
                for r in results {
                    let content: JSONValue = r.isError ? ["error": r.output] : r.output
                    messages.append(["role": "tool", "tool_call_id": .string(r.callId), "content": .string(content.text)])
                }
            }
        }
        var body: [String: JSONValue] = ["model": .string(modelId), "messages": .array(messages), "usage": ["include": true]]
        if !call.tools.isEmpty {
            body["tools"] = .array(
                call.tools.map {
                    ["type": "function", "function": ["name": .string($0.name), "description": .string($0.description), "parameters": $0.inputSchema, "strict": true]]
                }
            )
            body["parallel_tool_calls"] = true
            body["tool_choice"] =
                switch call.toolChoice {
                case .auto: "auto"
                case .none: "none"
                case .required: "required"
                case let .tool(name): ["type": "function", "function": ["name": .string(name)]]
                }
        }
        if let max = call.maxOutputTokens { body["max_completion_tokens"] = .number(Double(max)) }
        if let effort = call.reasoningEffort { body["reasoning"] = ["effort": .string(effort), "exclude": true] }
        return .object(body)
    }

    func parse(_ data: Data) throws -> ModelResponse {
        guard let json = JSONValue.parse(String(decoding: data, as: UTF8.self)), let choice = json["choices"]?.array?.first,
            let message = choice["message"]
        else { throw ModelError(status: 200, description: "\(provider) sent an answer without a choice.") }
        let calls = (message["tool_calls"]?.array ?? []).compactMap { c -> ToolCall? in
            guard let id = c["id"]?.string, let name = c["function"]?["name"]?.string else { return nil }
            let args = c["function"]?["arguments"]?.string ?? "{}"
            return ToolCall(id: id, name: name, input: JSONValue.parse(args) ?? ["__unparsed": .string(args)])
        }
        var usage = Usage()
        if let u = json["usage"] {
            usage.inputTokens = u["prompt_tokens"]?.int ?? 0
            usage.outputTokens = u["completion_tokens"]?.int ?? 0
            usage.cachedInputTokens = u["prompt_tokens_details"]?["cached_tokens"]?.int ?? 0
            usage.reasoningTokens = u["completion_tokens_details"]?["reasoning_tokens"]?.int ?? 0
            if case let .number(cost) = u["cost"] { usage.cost = cost }
        }
        let reason: FinishReason =
            switch choice["finish_reason"]?.string {
            case "stop": .stop
            case "length": .length
            case "tool_calls": .toolCalls
            case "content_filter": .contentFilter
            case "error": .error
            default: calls.isEmpty ? .other : .toolCalls
            }
        return ModelResponse(text: message["content"]?.string ?? "", toolCalls: calls, finishReason: reason, usage: usage, responseId: json["id"]?.string)
    }
}
