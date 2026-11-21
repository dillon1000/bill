import Bill
import Crypto
import Vapor

/// The HTTP side: a health check, and a chat endpoint for a product to call on a signed-in person's behalf.
public struct ChatRequest: Content {
    public struct Message: Content {
        public var role: String
        public var name: String?
        public var text: String
    }
    public var conversationId: String
    public var accountId: String
    public var name: String
    public var messages: [Message]
}

/// Registers `GET /health` and `POST /v1/chat`. Only a caller holding `token` reaches chat, and it vouches for `accountId`.
public func billRoutes(_ app: Application, bill: Bill, token: String) {
    app.get("health") { _ in "ok" }
    app.on(.POST, "v1", "chat", body: .collect(maxSize: "256kb")) { req async throws -> Reply in
        guard let given = req.headers.bearerAuthorization?.token, constantTimeEquals(given, token) else { throw Abort(.unauthorized) }
        let chat = try req.content.decode(ChatRequest.self)
        guard !chat.accountId.isEmpty, chat.messages.count <= 100, chat.conversationId.count <= 100 else { throw Abort(.badRequest) }
        let turns = chat.messages.suffix(50).map {
            Turn(author: $0.role == "assistant" ? .bill : $0.role == "staff" ? .staff : .requester, name: $0.name ?? chat.name, text: String($0.text.prefix(8000)))
        }
        return try await bill.respond(
            to: Conversation(id: "web:\(chat.conversationId)", surface: .web, requester: Requester(accountId: chat.accountId, name: chat.name), turns: Array(turns))
        )
    }
}

func constantTimeEquals(_ a: String, _ b: String) -> Bool {
    SHA256.hash(data: Data(a.utf8)) == SHA256.hash(data: Data(b.utf8))
}

extension Reply: Content {}
