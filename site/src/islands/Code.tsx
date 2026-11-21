import * as stylex from "@stylexjs/stylex";
import { AnimatePresence, motion as m } from "motion/react";
import { Fragment, useState } from "react";
import { CopyButton } from "../components/ui/CopyButton";
import { Segmented } from "../components/ui/Segmented";
import { color, font, radius, syntax, text } from "../styles/tokens.stylex";

const files = {
  "main.swift": `let bill = Bill(
    model: OpenAICompatibleModel.openRouter("openai/gpt-6-luna", apiKey: key),
    productPrompt: try String(contentsOfFile: "prompt.md", encoding: .utf8),
    plugins: [
        DocsPlugin(source: "https://docs.example.com/llms-full.txt"),
        GitHubPlugin(github: app, paths: PathPolicy(deny: ["apps/admin/**"])),
        Accounts(db: db),
        DeskPlugin(desk: HelpDesk(db: db), labels: ["bug", "billing", "account"]),
    ],
    policy: SurfacePolicy(detailConsent: { await consented($0) }),
    audit: AuditLog(sink: PostgresAuditSink(client: db))
)

let reply = try await bill.respond(to: conversation)`,
  "Accounts.swift": `// A plugin's tools are built for one conversation, bound to the person asking.
// None takes a user id, so there's no one else to ask about.
struct Accounts: Plugin {
    let db: PostgresClient

    func tools(for conversation: Conversation) async -> [BillTool] {
        guard let id = conversation.requester.accountId else { return [] }
        return [
            BillTool(.readAccount, .typed("my_account",
                description: "The requester's plan, standing and bots.",
                schema: Schema.object([:])
            ) { (_: Empty, _) in try await plan(for: id) }),
        ]
    }
}`,
  "Package.swift": `dependencies: [
    .package(url: "https://github.com/dillon1000/bill.git", from: "0.1.0"),
],
targets: [
    .executableTarget(name: "Support", dependencies: [
        .product(name: "Bill", package: "bill"),
        .product(name: "BillGitHub", package: "bill"),
        .product(name: "BillDiscord", package: "bill"),
        .product(name: "BillServer", package: "bill"),
    ]),
]`,
};
type File = keyof typeof files;

const keywords = new Set(["let", "var", "try", "await", "async", "func", "struct", "return", "guard", "else", "in", "throws", "import"]);

function highlight(code: string) {
  return code.split(/(\/\/.*|"(?:[^"\\]|\\.)*"|\b[A-Za-z_][A-Za-z0-9_]*\b|\.\w+)/g).map((part, i) => {
    if (part.startsWith("//")) return <span key={i} {...stylex.props(s.comment)}>{part}</span>;
    if (part.startsWith('"')) return <span key={i} {...stylex.props(s.string)}>{part}</span>;
    if (keywords.has(part)) return <span key={i} {...stylex.props(s.keyword)}>{part}</span>;
    if (/^[A-Z]/.test(part)) return <span key={i} {...stylex.props(s.type)}>{part}</span>;
    if (/^\.\w+/.test(part)) return <span key={i} {...stylex.props(s.member)}>{part}</span>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function Code() {
  const [file, setFile] = useState<File>("main.swift");
  return (
    <div {...stylex.props(s.frame)}>
      <div {...stylex.props(s.bar)}>
        <Segmented label="File" value={file} onChange={setFile} options={Object.keys(files).map((f) => ({ value: f as File, label: f }))} />
        <CopyButton text={files[file]} compact size="sm" variant="ghost" />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.pre key={file} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} {...stylex.props(s.pre)}>
          <code>{highlight(files[file])}</code>
        </m.pre>
      </AnimatePresence>
    </div>
  );
}

const s = stylex.create({
  frame: { cornerShape: "squircle", borderRadius: radius.xl, backgroundColor: color.surface, boxShadow: `0 0 0 1px ${color.line}`, overflow: "hidden" },
  bar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 8, borderBottom: `1px solid ${color.line}`, flexWrap: "wrap" },
  pre: { margin: 0, padding: "18px 20px 22px", overflowX: "auto", fontFamily: font.mono, fontSize: text.sm, lineHeight: 1.65, color: syntax.punctuation, minHeight: 330 },
  comment: { color: syntax.comment },
  string: { color: syntax.string },
  keyword: { color: syntax.keyword },
  type: { color: syntax.property },
  member: { color: syntax.function },
});
