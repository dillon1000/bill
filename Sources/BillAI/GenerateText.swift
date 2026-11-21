import Foundation

/// One model call and the tool calls it made, after the AI SDK's `StepResult`.
public struct StepResult: Sendable {
    public let stepNumber: Int
    public let text: String
    public let toolCalls: [ToolCall]
    public let toolResults: [ToolResult]
    public let finishReason: FinishReason
    public let usage: Usage
    public let modelId: String
}

/// A tool error that ends the whole call instead of being shown to the model.
public protocol AbortsGeneration: Error {}

/// When the tool loop stops, after the AI SDK's `stopWhen`.
public struct StopCondition: Sendable {
    public let isMet: @Sendable ([StepResult]) -> Bool
    public init(_ isMet: @escaping @Sendable ([StepResult]) -> Bool) { self.isMet = isMet }

    public static func stepCountIs(_ count: Int) -> StopCondition { StopCondition { $0.count >= count } }
    public static func hasToolCall(_ name: String) -> StopCondition {
        StopCondition { steps in steps.last?.toolCalls.contains { $0.name == name } ?? false }
    }
}

/// What `prepareStep` may change before a step, after the AI SDK's `PrepareStepResult`.
public struct StepSettings: Sendable {
    public var system: String?
    public var messages: [ModelMessage]?
    public var activeTools: [String]?
    public var toolChoice: ToolChoice?
    public init(system: String? = nil, messages: [ModelMessage]? = nil, activeTools: [String]? = nil, toolChoice: ToolChoice? = nil) {
        self.system = system
        self.messages = messages
        self.activeTools = activeTools
        self.toolChoice = toolChoice
    }
}

public struct GenerateTextResult: Sendable {
    public let text: String
    public let steps: [StepResult]
    public let finishReason: FinishReason
    /// The assistant and tool messages the call added, to append to the conversation.
    public let responseMessages: [ModelMessage]
    public var totalUsage: Usage { steps.reduce(Usage()) { $0 + $1.usage } }
    public var toolCalls: [ToolCall] { steps.flatMap(\.toolCalls) }
}

/// Runs the model and its tools until a stop condition holds: the AI SDK's `generateText`.
public func generateText(
    model: any LanguageModel,
    system: String? = nil,
    messages: [ModelMessage],
    tools: [Tool] = [],
    toolChoice: ToolChoice = .auto,
    stopWhen: [StopCondition] = [.stepCountIs(1)],
    maxOutputTokens: Int? = nil,
    reasoningEffort: String? = nil,
    prepareStep: (@Sendable (_ stepNumber: Int, _ steps: [StepResult], _ messages: [ModelMessage]) async throws -> StepSettings?)? = nil,
    onStepFinish: (@Sendable (StepResult) async throws -> Void)? = nil
) async throws -> GenerateTextResult {
    let byName = Dictionary(tools.map { ($0.name, $0) }, uniquingKeysWith: { a, _ in a })
    var steps: [StepResult] = []
    var added: [ModelMessage] = []

    while true {
        let stepNumber = steps.count
        let all = messages + added
        let settings = try await prepareStep?(stepNumber, steps, all)
        let active = settings?.activeTools.map { names in tools.filter { names.contains($0.name) } } ?? tools
        let response = try await model.generate(
            ModelCall(
                system: settings?.system ?? system, messages: settings?.messages ?? all, tools: active,
                toolChoice: settings?.toolChoice ?? toolChoice, maxOutputTokens: maxOutputTokens, reasoningEffort: reasoningEffort
            )
        )
        added.append(.assistant(text: response.text, toolCalls: response.toolCalls))

        let activeNames = Set(active.map(\.name))
        let soFar = messages + added
        let options = { @Sendable (call: ToolCall) in ToolCallOptions(toolCallId: call.id, messages: soFar, stepNumber: stepNumber) }
        let results = try await withThrowingTaskGroup(of: (Int, ToolResult).self) { group in
            for (index, call) in response.toolCalls.enumerated() {
                group.addTask {
                    guard let tool = byName[call.name], activeNames.contains(call.name) else {
                        return (index, ToolResult(callId: call.id, name: call.name, output: .string("There's no tool called \(call.name)."), isError: true))
                    }
                    if call.input["__unparsed"] != nil {
                        return (index, ToolResult(callId: call.id, name: call.name, output: "The arguments weren't valid JSON.", isError: true))
                    }
                    do {
                        return (index, ToolResult(callId: call.id, name: call.name, output: try await tool.execute(call.input, options(call))))
                    } catch let error as any AbortsGeneration {
                        throw error
                    } catch {
                        return (index, ToolResult(callId: call.id, name: call.name, output: .string("\(error)"), isError: true))
                    }
                }
            }
            var out: [(Int, ToolResult)] = []
            for try await r in group { out.append(r) }
            return out.sorted { $0.0 < $1.0 }.map(\.1)
        }
        if !results.isEmpty { added.append(.tool(results)) }

        let step = StepResult(
            stepNumber: stepNumber, text: response.text, toolCalls: response.toolCalls, toolResults: results,
            finishReason: response.finishReason, usage: response.usage, modelId: model.modelId
        )
        steps.append(step)
        try await onStepFinish?(step)

        if response.toolCalls.isEmpty || stopWhen.contains(where: { $0.isMet(steps) }) {
            return GenerateTextResult(text: step.text, steps: steps, finishReason: step.finishReason, responseMessages: added)
        }
    }
}
