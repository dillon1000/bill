import AsyncHTTPClient
import BillAI
import Foundation

/// A docs site that publishes `llms-full.txt`: every page as `# Title`, then `Source: <url>`, then Markdown.
public actor DocsPlugin: Plugin {
    struct Page: Sendable { let title: String; let url: String; let body: String }

    let source: String
    let http: HTTPClient
    var pages: [Page] = []
    var fetchedAt = Date.distantPast

    /// `source` is the `llms-full.txt` address.
    public init(source: String, http: HTTPClient = .shared) {
        self.source = source
        self.http = http
    }

    func load() async throws -> [Page] {
        if !pages.isEmpty, fetchedAt.timeIntervalSinceNow > -3600 { return pages }
        let response = try await http.execute(HTTPClientRequest(url: source), timeout: .seconds(20))
        guard response.status == .ok else { throw ToolError("The docs didn't load (\(response.status.code)).") }
        pages = DocsPlugin.parse(String(buffer: try await response.body.collect(upTo: 32 << 20)))
        fetchedAt = Date()
        return pages
    }

    static func parse(_ text: String) -> [Page] {
        text.components(separatedBy: "\n# ").dropFirst().compactMap { chunk in
            let lines = chunk.split(separator: "\n", omittingEmptySubsequences: false)
            guard let title = lines.first, let source = lines.first(where: { $0.hasPrefix("Source: ") }) else { return nil }
            return Page(title: String(title), url: String(source.dropFirst(8)), body: lines.dropFirst().joined(separator: "\n"))
        }
    }

    static func search(_ pages: [Page], _ query: String) -> [JSONValue] {
        let terms = query.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count > 2 }
        guard !terms.isEmpty else { return [] }
        let scored = pages.map { page -> (Page, Int) in
            let title = page.title.lowercased(), body = page.body.lowercased()
            return (page, terms.reduce(0) { $0 + (title.contains($1) ? 8 : 0) + min(10, body.components(separatedBy: $1).count - 1) })
        }
        return scored.filter { $0.1 > 0 }.sorted { $0.1 > $1.1 }.prefix(5).map { page, _ in
            let body = page.body
            let at = terms.lazy.compactMap { body.range(of: $0, options: .caseInsensitive) }.first?.lowerBound ?? body.startIndex
            let start = body.index(at, offsetBy: -300, limitedBy: body.startIndex) ?? body.startIndex
            return ["title": .string(page.title), "url": .string(page.url), "excerpt": .string(clip(String(body[start...]), 1200))]
        }
    }

    struct Query: Decodable, Sendable { let query: String }
    struct URLInput: Decodable, Sendable { let url: String }

    public nonisolated func tools(for conversation: Conversation) async -> [BillTool] {
        [
            BillTool(
                .readDocs,
                .typed(
                    "search_docs", description: "Search the product's public documentation. Returns the best pages with an excerpt and their URL.",
                    schema: Schema.object(["query": Schema.string("What to look for", maxLength: 200)])
                ) { (input: Query, _) -> JSONValue in ["results": .array(DocsPlugin.search(try await self.load(), input.query))] }
            ),
            BillTool(
                .readDocs,
                .typed("read_doc", description: "Read a whole docs page by its URL, from search_docs.", schema: Schema.object(["url": Schema.string("The page URL", maxLength: 300)])) {
                    (input: URLInput, _) -> JSONValue in
                    let want = input.url.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
                    guard let page = try await self.load().first(where: { $0.url.trimmingCharacters(in: CharacterSet(charactersIn: "/")) == want }) else {
                        throw ToolError("No docs page has that URL. Use one from search_docs.")
                    }
                    return ["title": .string(page.title), "url": .string(page.url), "text": .string(clip(page.body, 16000))]
                }
            ),
        ]
    }
}
