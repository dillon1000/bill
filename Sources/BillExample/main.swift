import Bill
import BillAI
import BillDiscord
import BillGitHub
import BillServer
import DiscordBM
import Foundation
import Vapor

// A complete Bill for a product with a GitHub repo, an llms-full.txt docs site and a Discord server. See README.md for the settings.

func env(_ name: String) throws -> String {
    guard let value = Environment.get(name), !value.isEmpty else { throw Abort(.internalServerError, reason: "\(name) isn't set.") }
    return value
}
func env(_ name: String, default value: String) -> String { Environment.get(name).flatMap { $0.isEmpty ? nil : $0 } ?? value }

let app = try await Application.make(.detect())
app.http.server.configuration.hostname = "0.0.0.0"
app.http.server.configuration.port = Int(env("PORT", default: "8080")) ?? 8080

let gateway = await BotGatewayManager(
    eventLoopGroup: app.eventLoopGroup, httpClient: app.http.client.shared, token: try env("DISCORD_TOKEN"),
    intents: [.guilds, .guildMessages, .messageContent, .directMessages]
)
let github = try GitHubApp(
    appId: try env("GITHUB_APP_ID"), privateKeyPEM: try env("GITHUB_APP_PRIVATE_KEY"), installationId: try env("GITHUB_INSTALLATION_ID"),
    repository: try env("GITHUB_REPOSITORY"), permissions: .init(writeIssues: env("GITHUB_WRITE_ISSUES", default: "true") == "true")
)
let bill = Bill(
    model: OpenAICompatibleModel.openRouter(env("BILL_MODEL", default: "openai/gpt-6-luna"), apiKey: try env("OPENROUTER_API_KEY")),
    productPrompt: try String(contentsOfFile: try env("BILL_PRODUCT_PROMPT_FILE"), encoding: .utf8),
    plugins: [
        DocsPlugin(source: try env("DOCS_LLMS_FULL_URL")),
        GitHubPlugin(github: github, paths: PathPolicy(deny: env("GITHUB_DENY_PATHS", default: "").split(separator: ",").map(String.init))),
        DeskPlugin(desk: StaffChannelDesk(client: gateway.client, channel: try env("STAFF_CHANNEL_ID")), labels: ["bug", "question", "billing", "account"]),
    ],
    policy: SurfacePolicy(),
    audit: AuditLog(sink: JSONLinesAuditSink(path: env("AUDIT_FILE", default: "audit.jsonl")))
)
let desk = FrontDesk(
    bill: bill, client: gateway.client,
    settings: .init(
        guildId: try env("DISCORD_GUILD_ID"), forums: Set(env("DISCORD_FORUM_IDS", default: "").split(separator: ",").map(String.init)),
        allowDMs: env("DISCORD_DMS", default: "true") == "true", handOffRole: Environment.get("DISCORD_SUPPORT_ROLE_ID")
    ),
    tickets: NoTickets(), identity: DiscordOnlyIdentity(), logger: app.logger
)
billRoutes(app, bill: bill, token: try env("BILL_TOKEN"))

Task {
    await gateway.connect()
    for await event in await gateway.events { Task { await desk.handle(event) } }
}
try await app.execute()
try await app.asyncShutdown()
