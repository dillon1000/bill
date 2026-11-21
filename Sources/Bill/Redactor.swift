import Foundation

/// Finds secrets in text, so they never reach a reply, an issue or the audit log.
public struct Redactor: Sendable {
    public var patterns: [String]

    public init(extra: [String] = []) { patterns = Redactor.defaults + extra }

    public static let defaults = [
        #"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"#,
        #"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b"#,
        #"\bgithub_pat_[A-Za-z0-9_]{40,}\b"#,
        #"\bsk-[A-Za-z0-9_\-]{20,}\b"#,
        #"\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b"#,
        #"\b(?:rk|pk)_live_[A-Za-z0-9]{16,}\b"#,
        #"\bwhsec_[A-Za-z0-9]{16,}\b"#,
        #"\bxox[abposr]-[A-Za-z0-9-]{10,}\b"#,
        #"\bAKIA[0-9A-Z]{16}\b"#,
        #"\bAIza[0-9A-Za-z_\-]{35}\b"#,
        // Discord bot tokens: base64 user id, timestamp, HMAC.
        #"\b[MNO][A-Za-z\d_-]{23,27}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,40}\b"#,
        #"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"#,
        #"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s'"`]+"#,
        #"(?i)\b(?:api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-\.\/+=]{12,}"#,
    ]

    public func redact(_ text: String) -> String {
        patterns.reduce(text) { $0.replacingOccurrences(of: $1, with: "[redacted]", options: .regularExpression) }
    }

    public func containsSecret(_ text: String) -> Bool { redact(text) != text }
}
