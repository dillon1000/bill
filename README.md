# Bill

An AI support agent for Discord and the web, in Swift on Vapor. Bill answers in ticket channels, help forum posts, DMs, any channel where someone @mentions it, and an in-product chat. It reads your docs, your code, pull requests and issues on GitHub, and (through your own plugin) the asking person's account. It can hand off to a human, triage and close tickets, and file GitHub issues. Every step it takes is written to a hash-chained audit log first.

Built for [Buildcord](https://buildcord.dev), and written to be used by anyone.

## Pieces

| Module | What it is |
| --- | --- |
| `BillAI` | A Swift port of the [Vercel AI SDK](https://ai-sdk.dev)'s core: `generateText` with a tool loop, `stopWhen` (`stepCountIs`, `hasToolCall`), `prepareStep`, `onStepFinish`, typed tools with JSON Schema, tool errors returned to the model, `pruneMessages`, and an OpenAI-compatible provider (OpenRouter by default). |
| `Bill` | The agent: the hard system prompt, scopes and policy, plugins, the help desk interface, secret redaction, the audit log (JSON lines or Postgres), and a docs plugin for any site with an `llms-full.txt`. |
| `BillGitHub` | A GitHub App narrowed to one repository: code search, file reads, directory listings, recent commits, pull requests and issues, and filing issues. Paths such as `.env`, keys and workflows are always off limits, plus any you add. |
| `BillDiscord` | The front desk: answers in tickets, forum posts, DMs and @mentions (replying to the message), waits for a burst of messages to finish, shows typing, splits long replies, never mentions anyone but the hand-off role, and limits replies per person per hour. |
| `BillServer` | `GET /health` and `POST /v1/chat`, for your product to call on behalf of a signed-in person. |
| `bill` | A complete example that runs all of the above. |

## Least privilege

- **Scopes.** Every tool declares a scope. A `Policy` grants a conversation its scopes from where it happens and who's asking. A tool outside them isn't offered to the model, and a call to it is refused and audited. The default `SurfacePolicy` reads account data only in private places, detailed data only with the person's consent, and never in a public forum post or channel.
- **Bound tools.** Plugins build their tools for one conversation, bound to its requester. No tool takes a user id, so Bill can't be talked into reading someone else's data.
- **GitHub.** The installation token is requested for one repository with `contents`, `pull_requests` and `metadata` read, and `issues` write only if you allow it.
- **Discord.** Intents are Guilds, Guild Messages, Message Content and Direct Messages. Permissions are View Channel, Send Messages, Send Messages in Threads and Read Message History.
- **Secrets.** Tool output is redacted before the model sees it, replies before anyone does, and audit data before it's stored.
- **Closing.** `close_ticket` needs the person's own words from their latest message, quoted exactly.

## Audit log

Each event (conversation start with its scopes, every model step with its usage and cost, every tool call before it runs and its result after, refusals, replies and errors) carries the SHA-256 of the one before it. `AuditLog.verify` finds an edited, removed or reordered event. If an event can't be written, Bill stops: the tool doesn't run and nothing is sent. Give the database role `insert` and `select` on `bill_audit`, and nothing else.

## Running the example

```sh
swift run bill serve
```

| Variable | |
| --- | --- |
| `OPENROUTER_API_KEY` | Model access |
| `BILL_MODEL` | Defaults to `openai/gpt-6-luna` |
| `BILL_PRODUCT_PROMPT_FILE` | A Markdown file describing your product, its links and its own rules |
| `BILL_TOKEN` | What your product presents to `POST /v1/chat` |
| `DISCORD_TOKEN`, `DISCORD_GUILD_ID` | The bot and its server |
| `DISCORD_FORUM_IDS` | Comma-separated help forums to answer in |
| `DISCORD_DMS` | `false` to ignore DMs |
| `DISCORD_MENTIONS` | `false` to ignore @mentions outside tickets and forums |
| `DISCORD_SUPPORT_ROLE_ID` | Pinged on a hand-off |
| `STAFF_CHANNEL_ID` | Where hand-offs, triage and closures are posted |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID` | The GitHub App |
| `GITHUB_REPOSITORY` | `owner/name` |
| `GITHUB_WRITE_ISSUES` | `false` for read-only |
| `GITHUB_DENY_PATHS` | Comma-separated globs Bill may never read |
| `DOCS_LLMS_FULL_URL` | Your docs' `llms-full.txt` |
| `AUDIT_FILE` | Defaults to `audit.jsonl` |

## Using it in your product

Depend on the package, then build a `Bill` with your own plugins: one for your accounts (tools bound to `conversation.requester`), a `Desk` for your ticket system, a `TicketDirectory` and an `IdentityResolver` for Discord (returning nil for anyone Bill shouldn't answer). To keep Bill from handing someone off, leave `ticket:handoff` out of their scopes in your `Policy`. Your product prompt adds knowledge and rules; it can't loosen the core ones.

```swift
let bill = Bill(
    model: OpenAICompatibleModel.openRouter("openai/gpt-6-luna", apiKey: key),
    productPrompt: prompt,
    plugins: [DocsPlugin(source: "https://docs.example.com/llms-full.txt"), GitHubPlugin(github: app, paths: PathPolicy(deny: [])), MyAccounts(db: db), DeskPlugin(desk: MyDesk(), labels: ["bug", "billing"])],
    policy: SurfacePolicy(detailConsent: { await consented($0) }),
    audit: AuditLog(sink: PostgresAuditSink(client: postgres))
)
```

## License

MIT
