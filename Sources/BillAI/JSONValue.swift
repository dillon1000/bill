import Foundation

/// Any JSON value: tool inputs and outputs, schemas, provider payloads.
public enum JSONValue: Sendable, Hashable, Codable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: any Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case let .bool(b): try c.encode(b)
        case let .number(n): if n.rounded() == n, abs(n) < 1e15 { try c.encode(Int64(n)) } else { try c.encode(n) }
        case let .string(s): try c.encode(s)
        case let .array(a): try c.encode(a)
        case let .object(o): try c.encode(o)
        }
    }

    public subscript(key: String) -> JSONValue? {
        if case let .object(o) = self { o[key] } else { nil }
    }

    public var string: String? { if case let .string(s) = self { s } else { nil } }
    public var int: Int? { if case let .number(n) = self { Int(exactly: n) } else { nil } }
    public var bool: Bool? { if case let .bool(b) = self { b } else { nil } }
    public var array: [JSONValue]? { if case let .array(a) = self { a } else { nil } }

    /// Converts any Encodable into JSON.
    public init(encoding value: some Encodable) throws {
        self = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder.bill.encode(value))
    }

    public func decode<T: Decodable>(_: T.Type = T.self) throws -> T {
        try JSONDecoder().decode(T.self, from: JSONEncoder.bill.encode(self))
    }

    /// Compact JSON text, keys sorted so equal values serialize equally.
    public var text: String { String(decoding: (try? JSONEncoder.bill.encode(self)) ?? Data("null".utf8), as: UTF8.self) }

    /// Parses JSON text, returning nil when it isn't JSON.
    public static func parse(_ text: String) -> JSONValue? { try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8)) }
}

extension JSONValue: ExpressibleByStringLiteral, ExpressibleByIntegerLiteral, ExpressibleByBooleanLiteral, ExpressibleByArrayLiteral,
    ExpressibleByDictionaryLiteral, ExpressibleByNilLiteral, ExpressibleByFloatLiteral
{
    public init(stringLiteral value: String) { self = .string(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(arrayLiteral elements: JSONValue...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, JSONValue)...) { self = .object(Dictionary(elements, uniquingKeysWith: { _, b in b })) }
    public init(nilLiteral: ()) { self = .null }
}

extension JSONEncoder {
    public static let bill: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}

/// JSON Schema for tool inputs, written the way zod schemas are in the AI SDK.
public enum Schema {
    public static func object(_ properties: [String: JSONValue], required: [String]? = nil) -> JSONValue {
        [
            "type": "object", "properties": .object(properties), "additionalProperties": false,
            "required": .array((required ?? properties.keys.sorted()).map { .string($0) }),
        ]
    }
    public static func string(_ description: String, maxLength: Int = 4000) -> JSONValue {
        ["type": "string", "description": .string(description), "maxLength": .number(Double(maxLength))]
    }
    public static func integer(_ description: String, minimum: Int = 0, maximum: Int = 1_000_000) -> JSONValue {
        ["type": "integer", "description": .string(description), "minimum": .number(Double(minimum)), "maximum": .number(Double(maximum))]
    }
    public static func boolean(_ description: String) -> JSONValue { ["type": "boolean", "description": .string(description)] }
    public static func oneOf(_ values: [String], _ description: String) -> JSONValue {
        ["type": "string", "enum": .array(values.map { .string($0) }), "description": .string(description)]
    }
    public static func array(_ items: JSONValue, _ description: String, maxItems: Int = 20) -> JSONValue {
        ["type": "array", "items": items, "description": .string(description), "maxItems": .number(Double(maxItems))]
    }
    /// A value the model may leave out, sent as null; strict mode needs every property listed as required.
    public static func optional(_ schema: JSONValue) -> JSONValue {
        guard case var .object(o) = schema, let type = o["type"] else { return schema }
        o["type"] = [type, "null"]
        return .object(o)
    }
}
