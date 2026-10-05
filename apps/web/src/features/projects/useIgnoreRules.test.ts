import { act, renderHook, waitFor } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { useIgnoreRules } from "./useIgnoreRules"

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

describe("useIgnoreRules", () => {
  it("loads the project's Ignore Rules", async () => {
    stubFetch([RULE])

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()

    const { result } = renderHook(() =>
      useIgnoreRules("p1", "token-1", onSessionExpired, onAccessDenied),
    )

    await waitFor(() => expect(result.current.rules).toEqual([RULE]))
  })

  it("routes session-expired errors through onSessionExpired", async () => {
    stubFetch({ errorCode: "SESSION_INVALID", message: "bad" }, 401)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()

    const { result } = renderHook(() =>
      useIgnoreRules("p1", "token-1", onSessionExpired, onAccessDenied),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(onSessionExpired).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it("createRule POSTs then refetches", async () => {
    const fetchMock = stubFetch([])

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()

    const { result } = renderHook(() =>
      useIgnoreRules("p1", "token-1", onSessionExpired, onAccessDenied),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    fetchMock.mockResolvedValueOnce(mockJsonResponse(201, RULE))
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, [RULE]))

    await act(async () => {
      await result.current.createRule({
        scope: "API",
        apiId: "a1",
        path: "$.StartTime",
      })
    })

    const [url, init] = fetchMock.mock.calls[1]

    expect(String(url)).toContain("/projects/p1/ignore-rules")
    expect(init.method).toBe("POST")

    await waitFor(() => expect(result.current.rules).toEqual([RULE]))
  })

  it("bulkCreateRules POSTs to /bulk, refetches, and returns the result", async () => {
    const fetchMock = stubFetch([])

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()

    const { result } = renderHook(() =>
      useIgnoreRules("p1", "token-1", onSessionExpired, onAccessDenied),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(201, { created: [RULE], skippedCount: 1 }),
    )
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, [RULE]))

    let bulkResult: { created: unknown[]; skippedCount: number } | undefined

    await act(async () => {
      bulkResult = await result.current.bulkCreateRules({
        scope: "PROJECT",
        paths: ["$.StartTime", "$.EndTime"],
      })
    })

    expect(bulkResult).toEqual({ created: [RULE], skippedCount: 1 })

    const [url, init] = fetchMock.mock.calls[1]

    expect(String(url)).toContain("/projects/p1/ignore-rules/bulk")
    expect(init.method).toBe("POST")

    await waitFor(() => expect(result.current.rules).toEqual([RULE]))
  })

  it("updateRule PATCHes enabled then refetches", async () => {
    const fetchMock = stubFetch([RULE])

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()

    const { result } = renderHook(() =>
      useIgnoreRules("p1", "token-1", onSessionExpired, onAccessDenied),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(200, { ...RULE, enabled: false }),
    )
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(200, [{ ...RULE, enabled: false }]),
    )

    await act(async () => {
      await result.current.updateRule("r1", false)
    })

    const [url, init] = fetchMock.mock.calls[1]

    expect(String(url)).toContain("/projects/p1/ignore-rules/r1")
    expect(init.method).toBe("PATCH")
    expect(init.body).toBe(JSON.stringify({ enabled: false }))

    await waitFor(() =>
      expect(result.current.rules[0]?.enabled).toBe(false),
    )
  })

  it("removeRule DELETEs then refetches", async () => {
    const fetchMock = stubFetch([RULE])

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()

    const { result } = renderHook(() =>
      useIgnoreRules("p1", "token-1", onSessionExpired, onAccessDenied),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined))
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, []))

    await act(async () => {
      await result.current.removeRule("r1")
    })

    const [url, init] = fetchMock.mock.calls[1]

    expect(String(url)).toContain("/projects/p1/ignore-rules/r1")
    expect(init.method).toBe("DELETE")

    await waitFor(() => expect(result.current.rules).toEqual([]))
  })
})
