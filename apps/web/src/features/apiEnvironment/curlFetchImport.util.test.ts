import { describe, expect, it } from "vitest"

import {
  buildImportPreview,
  derivePathValues,
  detectImportFormat,
  parseCurlCommand,
  parseFetchSnippet,
  parseImportInput,
} from "./curlFetchImport.util"

describe("detectImportFormat", () => {
  it("recognizes a curl command", () => {
    expect(detectImportFormat("curl 'https://api.example.com/x'")).toBe("CURL")
  })

  it("recognizes a fetch() snippet", () => {
    expect(detectImportFormat('fetch("https://api.example.com/x")')).toBe("FETCH")
  })

  it("falls back to UNKNOWN for unrecognized text", () => {
    expect(detectImportFormat("just some random text")).toBe("UNKNOWN")
    expect(detectImportFormat("")).toBe("UNKNOWN")
  })
})

describe("parseCurlCommand", () => {
  it("parses a Chrome 'Copy as cURL (bash)' GET request with multiple headers and no body", () => {
    const raw = [
      "curl 'https://api.example.com/widgets/123?status=active&status=inactive'",
      "  -H 'Authorization: Bearer abc123'",
      "  -H 'Accept: application/json'",
      "  -H 'X-Client-Id: web-app'",
      "  --compressed",
    ].join(" \\\n")

    const parsed = parseCurlCommand(raw)

    expect(parsed.httpMethod).toBe("GET")
    expect(parsed.url).toBe("https://api.example.com/widgets/123?status=active&status=inactive")
    expect(parsed.headers).toEqual({
      Authorization: "Bearer abc123",
      Accept: "application/json",
      "X-Client-Id": "web-app",
    })
    expect(parsed.body).toBeNull()
  })

  it("parses an explicit -X POST with a JSON -d body", () => {
    const raw = `curl -X POST 'https://api.example.com/widgets' -H 'Content-Type: application/json' -d '{"name":"Widget A","price":9.99}'`

    const parsed = parseCurlCommand(raw)

    expect(parsed.httpMethod).toBe("POST")
    expect(parsed.headers).toEqual({ "Content-Type": "application/json" })
    expect(parsed.body).toBe('{"name":"Widget A","price":9.99}')
  })

  it("implies POST when -d is present without -X", () => {
    const raw = `curl 'https://api.example.com/widgets' -d '{"name":"Widget B"}'`

    const parsed = parseCurlCommand(raw)

    expect(parsed.httpMethod).toBe("POST")
  })

  it("parses a query string from the URL", () => {
    const raw = "curl 'https://api.example.com/search?q=foo&page=2'"

    const parsed = parseCurlCommand(raw)

    expect(parsed.url).toBe("https://api.example.com/search?q=foo&page=2")
  })

  it("unescapes an escaped double quote inside a double-quoted header value", () => {
    const raw = 'curl "https://api.example.com/widgets" -H "X-Note: say \\"hi\\""'

    const parsed = parseCurlCommand(raw)

    expect(parsed.headers["X-Note"]).toBe('say "hi"')
  })

  it("throws a friendly error when no URL can be found", () => {
    expect(() => parseCurlCommand("curl -H 'Accept: application/json'")).toThrow(/URL/)
  })
})

describe("parseFetchSnippet", () => {
  it("parses a Chrome 'Copy as fetch' snippet with headers, a JSON string body, and an explicit method", () => {
    const raw = `fetch("https://api.example.com/widgets/123", {
      "headers": {
        "accept": "application/json",
        "authorization": "Bearer xyz"
      },
      "body": "{\\"a\\":1}",
      "method": "POST"
    }).then(res => res.json())`

    const parsed = parseFetchSnippet(raw)

    expect(parsed.httpMethod).toBe("POST")
    expect(parsed.url).toBe("https://api.example.com/widgets/123")
    expect(parsed.headers).toEqual({ accept: "application/json", authorization: "Bearer xyz" })
    expect(parsed.body).toBe('{"a":1}')
  })

  it("defaults to GET when no method is present", () => {
    const raw = `fetch('https://api.example.com/widgets/123')`

    const parsed = parseFetchSnippet(raw)

    expect(parsed.httpMethod).toBe("GET")
    expect(parsed.body).toBeNull()
  })

  it("throws a friendly error when no fetch(...) call can be found", () => {
    expect(() => parseFetchSnippet("not a fetch call")).toThrow(/fetch/)
  })
})

describe("parseImportInput", () => {
  it("returns a friendly error for empty or unrecognized input", () => {
    const result = parseImportInput("")
    expect(result).toHaveProperty("error")
  })

  it("dispatches to parseCurlCommand for curl input", () => {
    const result = parseImportInput("curl 'https://api.example.com/x'")
    expect(result).toHaveProperty("parsed")
  })

  it("dispatches to parseFetchSnippet for fetch input", () => {
    const result = parseImportInput('fetch("https://api.example.com/x")')
    expect(result).toHaveProperty("parsed")
  })
})

describe("buildImportPreview", () => {
  it("excludes reserved headers (with a warning) and includes normal headers/query params", () => {
    const preview = buildImportPreview({
      httpMethod: "GET",
      url: "https://api.example.com/widgets/123?status=active&status=inactive",
      headers: { Authorization: "Bearer abc123", Accept: "application/json", "X-Client-Id": "web-app" },
      body: null,
    })

    expect(preview.path).toBe("/widgets/123")
    expect(preview.suggestedApiName).toBe("GET /widgets/123")
    expect(preview.queryParameters).toEqual([{ name: "status", required: false, value: "active" }])
    expect(preview.headerParameters).toEqual([
      { name: "Accept", required: false, value: "application/json" },
      { name: "X-Client-Id", required: false, value: "web-app" },
    ])
    expect(preview.requestBody).toBeNull()
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Authorization"),
        expect.stringContaining("Duplicate QUERY parameter 'status'"),
      ]),
    )
  })

  it("marks a valid JSON body as included", () => {
    const preview = buildImportPreview({
      httpMethod: "POST",
      url: "https://api.example.com/widgets",
      headers: {},
      body: '{"name":"Widget A"}',
    })

    expect(preview.requestBody).toEqual({ bodyType: "JSON" })
    expect(preview.bodyValue).toBe('{"name":"Widget A"}')
  })

  it("warns and excludes the body when it is present but not valid JSON", () => {
    const preview = buildImportPreview({
      httpMethod: "POST",
      url: "https://api.example.com/widgets",
      headers: {},
      body: "not-json-body",
    })

    expect(preview.requestBody).toBeNull()
    expect(preview.bodyValue).toBeNull()
    expect(preview.warnings).toEqual(expect.arrayContaining([expect.stringContaining("not valid JSON")]))
  })

  it("deduplicates case-insensitively duplicate headers, keeping the first occurrence", () => {
    const preview = buildImportPreview({
      httpMethod: "GET",
      url: "https://api.example.com/widgets",
      headers: { "X-Trace-Id": "first", "x-trace-id": "second" },
      body: null,
    })

    expect(preview.headerParameters).toEqual([{ name: "X-Trace-Id", required: false, value: "first" }])
    expect(preview.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Duplicate HEADER parameter 'x-trace-id'")]))
  })
})

describe("derivePathValues", () => {
  it("maps a placeholder segment back to the concrete value at the same position", () => {
    expect(derivePathValues("/widgets/123", "/widgets/{id}")).toEqual({ id: "123" })
  })

  it("returns an empty object when the edited path has no placeholders", () => {
    expect(derivePathValues("/widgets/123", "/widgets/123")).toEqual({})
  })

  it("maps multiple placeholders by segment position", () => {
    expect(derivePathValues("/widgets/123/parts/456", "/widgets/{widgetId}/parts/{partId}")).toEqual({
      widgetId: "123",
      partId: "456",
    })
  })

  it("ignores a placeholder with no corresponding original segment", () => {
    expect(derivePathValues("/widgets", "/widgets/{id}")).toEqual({})
  })

  it("ignores extra original segments beyond the edited path's length", () => {
    expect(derivePathValues("/widgets/123/extra", "/widgets/{id}")).toEqual({ id: "123" })
  })
})
