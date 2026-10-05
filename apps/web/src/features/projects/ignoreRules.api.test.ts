import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import {
  bulkCreateIgnoreRules,
  createIgnoreRule,
  listIgnoreRules,
  removeIgnoreRule,
  updateIgnoreRule,
} from "./ignoreRules.api"

const RULE = {
  ignoreRuleId: "r1",
  projectId: "p1",
  apiId: "a1",
  apiName: "Get Order",
  apiMethod: "GET",
  apiPath: "/orders/:id",
  scope: "API",
  path: "$.StartTime",
  enabled: true,
  note: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body))

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

describe("ignoreRules.api", () => {
  it("listIgnoreRules sends apiId/scope/enabled as query params", async () => {
    const fetchMock = stubFetch([RULE])

    await listIgnoreRules(
      "p1",
      { apiId: "a1", scope: "API", enabled: true },
      "token-1",
    )

    const [url] = fetchMock.mock.calls[0]

    expect(String(url)).toContain("/projects/p1/ignore-rules?")
    expect(String(url)).toContain("apiId=a1")
    expect(String(url)).toContain("scope=API")
    expect(String(url)).toContain("enabled=true")
  })

  it("createIgnoreRule POSTs the API-scoped body", async () => {
    const fetchMock = stubFetch(RULE, 201)

    await createIgnoreRule(
      "p1",
      { scope: "API", apiId: "a1", path: "$.StartTime" },
      "token-1",
    )

    const [url, init] = fetchMock.mock.calls[0]

    expect(String(url)).toContain("/projects/p1/ignore-rules")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(
      JSON.stringify({ scope: "API", apiId: "a1", path: "$.StartTime" }),
    )
  })

  it("bulkCreateIgnoreRules POSTs to the /bulk endpoint", async () => {
    const fetchMock = stubFetch({ created: [RULE], skippedCount: 0 }, 201)

    await bulkCreateIgnoreRules(
      "p1",
      { scope: "PROJECT", paths: ["$.StartTime", "$.EndTime"] },
      "token-1",
    )

    const [url, init] = fetchMock.mock.calls[0]

    expect(String(url)).toContain("/projects/p1/ignore-rules/bulk")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(
      JSON.stringify({
        scope: "PROJECT",
        paths: ["$.StartTime", "$.EndTime"],
      }),
    )
  })

  it("updateIgnoreRule PATCHes the enabled flag", async () => {
    const fetchMock = stubFetch({ ...RULE, enabled: false })

    await updateIgnoreRule("p1", "r1", { enabled: false }, "token-1")

    const [url, init] = fetchMock.mock.calls[0]

    expect(String(url)).toContain("/projects/p1/ignore-rules/r1")
    expect(init.method).toBe("PATCH")
    expect(init.body).toBe(JSON.stringify({ enabled: false }))
  })

  it("removeIgnoreRule DELETEs the rule", async () => {
    const fetchMock = stubFetch(undefined, 204)

    await removeIgnoreRule("p1", "r1", "token-1")

    const [url, init] = fetchMock.mock.calls[0]

    expect(String(url)).toContain("/projects/p1/ignore-rules/r1")
    expect(init.method).toBe("DELETE")
  })
})
