import AsyncHTTPClient
import BillAI
import Crypto
import Foundation
import NIOCore
import NIOHTTP1
import _CryptoExtras

/// A GitHub App installation, authenticating as itself on one repository with only the permissions asked for.
public actor GitHubApp {
    public struct Permissions: Sendable {
        /// Read code, pull requests and issues. Issue writing is separate, so a deployment can leave it off.
        public var writeIssues: Bool
        public init(writeIssues: Bool) { self.writeIssues = writeIssues }
        var json: JSONValue {
            ["contents": "read", "metadata": "read", "pull_requests": "read", "issues": writeIssues ? "write" : "read"]
        }
    }

    let appId: String
    let key: _RSA.Signing.PrivateKey
    let installationId: String
    public let repository: String
    let permissions: Permissions
    let http: HTTPClient
    let api: String
    var token: (value: String, expires: Date)?

    /// `repository` is `owner/name`. The installation token is narrowed to it, whatever else the app is installed on.
    public init(
        appId: String, privateKeyPEM: String, installationId: String, repository: String, permissions: Permissions,
        http: HTTPClient = .shared, api: String = "https://api.github.com"
    ) throws {
        self.appId = appId
        key = try _RSA.Signing.PrivateKey(pemRepresentation: privateKeyPEM)
        self.installationId = installationId
        self.repository = repository
        self.permissions = permissions
        self.http = http
        self.api = api
    }

    func jwt() throws -> String {
        func b64(_ d: Data) -> String {
            d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        }
        let now = Int(Date().timeIntervalSince1970)
        let header = b64(Data(#"{"alg":"RS256","typ":"JWT"}"#.utf8))
        let payload = b64(Data(#"{"iat":\#(now - 60),"exp":\#(now + 540),"iss":"\#(appId)"}"#.utf8))
        let signature = try key.signature(for: Data("\(header).\(payload)".utf8), padding: .insecurePKCS1v1_5)
        return "\(header).\(payload).\(b64(signature.rawRepresentation))"
    }

    func installationToken() async throws -> String {
        if let token, token.expires.timeIntervalSinceNow > 300 { return token.value }
        let name = String(repository.split(separator: "/").last ?? "")
        let body: JSONValue = ["repositories": [.string(name)], "permissions": permissions.json]
        let json = try await send(.POST, "/app/installations/\(installationId)/access_tokens", body: body, auth: "Bearer \(try jwt())")
        guard let value = json["token"]?.string, let expires = json["expires_at"]?.string.flatMap({ ISO8601DateFormatter().date(from: $0) }) else {
            throw ToolError("GitHub didn't issue an installation token.")
        }
        token = (value, expires)
        return value
    }

    /// Calls the REST API as the installation. Paths are relative to the API root.
    public func request(_ method: HTTPMethod, _ path: String, body: JSONValue? = nil, accept: String = "application/vnd.github+json") async throws -> JSONValue {
        try await send(method, path, body: body, auth: "Bearer \(try await installationToken())", accept: accept)
    }

    /// A file's raw text.
    public func raw(_ path: String) async throws -> String {
        let response = try await execute(.GET, path, body: nil, auth: "Bearer \(try await installationToken())", accept: "application/vnd.github.raw+json")
        return String(buffer: response)
    }

    func send(_ method: HTTPMethod, _ path: String, body: JSONValue?, auth: String, accept: String = "application/vnd.github+json") async throws -> JSONValue {
        let buffer = try await execute(method, path, body: body, auth: auth, accept: accept)
        return JSONValue.parse(String(buffer: buffer)) ?? .null
    }

    func execute(_ method: HTTPMethod, _ path: String, body: JSONValue?, auth: String, accept: String) async throws -> ByteBuffer {
        var request = HTTPClientRequest(url: api + path)
        request.method = method
        request.headers.add(name: "Authorization", value: auth)
        request.headers.add(name: "Accept", value: accept)
        request.headers.add(name: "X-GitHub-Api-Version", value: "2022-11-28")
        request.headers.add(name: "User-Agent", value: "bill-support-agent")
        if let body {
            request.headers.add(name: "Content-Type", value: "application/json")
            request.body = .bytes(ByteBuffer(string: body.text))
        }
        let response = try await http.execute(request, timeout: .seconds(30))
        let buffer = try await response.body.collect(upTo: 8 << 20)
        guard (200..<300).contains(response.status.code) else {
            let message = JSONValue.parse(String(buffer: buffer))?["message"]?.string ?? "HTTP \(response.status.code)"
            throw ToolError("GitHub refused: \(message)")
        }
        return buffer
    }
}
