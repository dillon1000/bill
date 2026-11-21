import Bill
import BillAI
import Foundation

/// Paths Bill may never read, whatever the token allows. Globs: `*` within a segment, `**` across them.
public struct PathPolicy: Sendable {
    let denied: [NSRegularExpression]

    public init(deny: [String]) {
        denied = (PathPolicy.defaults + deny).compactMap { try? NSRegularExpression(pattern: PathPolicy.regex($0), options: [.caseInsensitive]) }
    }

    public static let defaults = [
        "**/.env", "**/.env.*", "**/*.pem", "**/*.key", "**/*.p12", "**/*.pfx", "**/id_rsa*", "**/*secret*", "**/*credential*",
        "**/.dev.vars*", "**/.npmrc", "**/.netrc", "**/*.tfstate*", "**/.github/workflows/**",
    ]

    public func allows(_ path: String) -> Bool {
        let p = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if p.split(separator: "/").contains(where: { $0 == ".." }) { return false }
        return !denied.contains { $0.firstMatch(in: p, range: NSRange(p.startIndex..., in: p)) != nil }
    }

    static func regex(_ glob: String) -> String {
        var out = "^"
        var chars = Array(glob)[...]
        while let c = chars.popFirst() {
            if c == "*", chars.first == "*" {
                chars.removeFirst()
                if chars.first == "/" {
                    chars.removeFirst()
                    out += "(?:.*/)?"
                } else {
                    out += ".*"
                }
            } else if c == "*" {
                out += "[^/]*"
            } else if c == "?" {
                out += "[^/]"
            } else {
                out += NSRegularExpression.escapedPattern(for: String(c))
            }
        }
        return out + "$"
    }
}

/// Code, pull requests and issues from one repository.
public struct GitHubPlugin: Plugin {
    let github: GitHubApp
    let paths: PathPolicy
    let branch: String
    /// Labels every filed issue gets, so staff can find Bill's.
    let issueLabels: [String]

    public init(github: GitHubApp, paths: PathPolicy, branch: String = "main", issueLabels: [String] = ["bill"]) {
        self.github = github
        self.paths = paths
        self.branch = branch
        self.issueLabels = issueLabels
    }

    struct Query: Decodable, Sendable { let query: String }
    struct ReadFile: Decodable, Sendable { let path: String; let startLine: Int?; let endLine: Int? }
    struct Path: Decodable, Sendable { let path: String }
    struct Number: Decodable, Sendable { let number: Int }
    struct NewIssue: Decodable, Sendable { let title: String; let body: String }

    static func q(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(.init(charactersIn: "-_.~"))) ?? "" }

    public func tools(for conversation: Conversation) async -> [BillTool] {
        let gh = github, paths = paths, branch = branch, repo = github.repository, labels = issueLabels
        @Sendable func refuse(_ path: String) -> ToolError { ToolError("\(path) is off limits.") }
        return [
            BillTool(
                .readCode,
                .typed(
                    "search_code",
                    description: "Search the product's source code on the default branch. Use identifiers, error messages or UI strings. Returns matching paths with snippets.",
                    schema: Schema.object(["query": Schema.string("Words to find, GitHub code search syntax without repo:", maxLength: 200)])
                ) { (input: Query, _) -> JSONValue in
                    let json = try await gh.request(
                        .GET, "/search/code?per_page=15&q=\(Self.q("\(input.query) repo:\(repo)"))", accept: "application/vnd.github.text-match+json"
                    )
                    let items = (json["items"]?.array ?? []).compactMap { item -> JSONValue? in
                        guard let path = item["path"]?.string, paths.allows(path) else { return nil }
                        let fragments = (item["text_matches"]?.array ?? []).compactMap { $0["fragment"]?.string }.map { JSONValue.string(clip($0, 400)) }
                        return ["path": .string(path), "snippets": .array(fragments)]
                    }
                    return ["results": .array(items)]
                }
            ),
            BillTool(
                .readCode,
                .typed(
                    "read_file",
                    description: "Read lines of a source file on the default branch, numbered. At most 300 lines a call.",
                    schema: Schema.object([
                        "path": Schema.string("Path from the repository root", maxLength: 300),
                        "startLine": Schema.optional(Schema.integer("First line, from 1", minimum: 1)),
                        "endLine": Schema.optional(Schema.integer("Last line", minimum: 1)),
                    ])
                ) { (input: ReadFile, _) -> JSONValue in
                    guard paths.allows(input.path) else { throw refuse(input.path) }
                    let text = try await gh.raw("/repos/\(repo)/contents/\(input.path.split(separator: "/").map { Self.q(String($0)) }.joined(separator: "/"))?ref=\(Self.q(branch))")
                    let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
                    let start = max(1, input.startLine ?? 1), end = min(lines.count, input.endLine ?? start + 299, start + 299)
                    guard start <= end else { return ["path": .string(input.path), "totalLines": .number(Double(lines.count)), "text": ""] }
                    let body = (start...end).map { "\($0)\t\(lines[$0 - 1])" }.joined(separator: "\n")
                    return ["path": .string(input.path), "totalLines": .number(Double(lines.count)), "text": .string(body)]
                }
            ),
            BillTool(
                .readCode,
                .typed("list_directory", description: "List a directory of the source tree.", schema: Schema.object(["path": Schema.string("Directory path, empty for the root", maxLength: 300)])) {
                    (input: Path, _) -> JSONValue in
                    guard input.path.isEmpty || paths.allows(input.path) else { throw refuse(input.path) }
                    let json = try await gh.request(.GET, "/repos/\(repo)/contents/\(input.path)?ref=\(Self.q(branch))")
                    let entries = (json.array ?? []).compactMap { e -> JSONValue? in
                        guard let path = e["path"]?.string, paths.allows(path) else { return nil }
                        return ["path": .string(path), "type": e["type"] ?? .null]
                    }
                    return ["entries": .array(entries)]
                }
            ),
            BillTool(
                .readCode,
                .typed(
                    "search_pull_requests",
                    description: "Search pull requests, open and merged, to learn whether something changed or is being fixed.",
                    schema: Schema.object(["query": Schema.string("Words to find", maxLength: 200)])
                ) { (input: Query, _) in try await Self.searchIssues(gh, repo: repo, "is:pr \(input.query)") }
            ),
            BillTool(
                .readCode,
                .typed("read_pull_request", description: "Read a pull request: its description, state, and the files it changed.", schema: Schema.object(["number": Schema.integer("The PR number", minimum: 1)])) {
                    (input: Number, _) -> JSONValue in
                    let pr = try await gh.request(.GET, "/repos/\(repo)/pulls/\(input.number)")
                    let files = try await gh.request(.GET, "/repos/\(repo)/pulls/\(input.number)/files?per_page=50")
                    let changed = (files.array ?? []).compactMap { $0["filename"]?.string }.filter(paths.allows).map(JSONValue.string)
                    return [
                        "number": .number(Double(input.number)), "title": pr["title"] ?? .null, "state": pr["state"] ?? .null, "merged": pr["merged"] ?? .null,
                        "mergedAt": pr["merged_at"] ?? .null, "url": pr["html_url"] ?? .null, "body": .string(clip(pr["body"]?.string ?? "", 4000)),
                        "files": .array(changed),
                    ]
                }
            ),
            BillTool(
                .readCode,
                .typed("search_issues", description: "Search GitHub issues, to find known bugs and avoid filing duplicates.", schema: Schema.object(["query": Schema.string("Words to find", maxLength: 200)])) {
                    (input: Query, _) in try await Self.searchIssues(gh, repo: repo, "is:issue \(input.query)")
                }
            ),
            BillTool(
                .readCode,
                .typed("recent_changes", description: "The latest commits, optionally only those touching a path. Shows what shipped recently.", schema: Schema.object(["path": Schema.string("A path, or empty for everything", maxLength: 300)])) {
                    (input: Path, _) -> JSONValue in
                    guard input.path.isEmpty || paths.allows(input.path) else { throw refuse(input.path) }
                    let json = try await gh.request(.GET, "/repos/\(repo)/commits?sha=\(Self.q(branch))&per_page=15\(input.path.isEmpty ? "" : "&path=\(Self.q(input.path))")")
                    return [
                        "commits": .array(
                            (json.array ?? []).map {
                                ["sha": .string(String($0["sha"]?.string?.prefix(8) ?? "")), "message": .string(String(($0["commit"]?["message"]?.string ?? "").prefix(300))), "date": $0["commit"]?["committer"]?["date"] ?? .null]
                            }
                        )
                    ]
                }
            ),
            BillTool(
                .fileIssue, writes: true,
                .typed(
                    "file_issue",
                    description: "File a GitHub issue for a confirmed bug, after checking search_issues for a duplicate. No personal data or secrets.",
                    schema: Schema.object([
                        "title": Schema.string("A short statement of the bug", maxLength: 200),
                        "body": Schema.string("What happens, what should happen, steps to reproduce, and the code involved", maxLength: 8000),
                    ])
                ) { (input: NewIssue, _) -> JSONValue in
                    let body = "\(input.body)\n\n---\nFiled by Bill from support conversation `\(conversation.id)`."
                    let json = try await gh.request(
                        .POST, "/repos/\(repo)/issues", body: ["title": .string(input.title), "body": .string(body), "labels": .array(labels.map(JSONValue.string))]
                    )
                    return ["number": json["number"] ?? .null, "url": json["html_url"] ?? .null]
                }
            ),
        ]
    }

    static func searchIssues(_ gh: GitHubApp, repo: String, _ query: String) async throws -> JSONValue {
        let json = try await gh.request(.GET, "/search/issues?per_page=10&q=\(q("\(query) repo:\(repo)"))")
        return [
            "results": .array(
                (json["items"]?.array ?? []).map {
                    [
                        "number": $0["number"] ?? .null, "title": $0["title"] ?? .null, "state": $0["state"] ?? .null, "url": $0["html_url"] ?? .null,
                        "closedAt": $0["closed_at"] ?? .null, "merged": .bool(($0["pull_request"]?["merged_at"]).map { $0 != .null } ?? false),
                    ]
                }
            )
        ]
    }
}
