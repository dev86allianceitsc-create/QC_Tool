import { act, renderHook } from "@testing-library/react"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { useComparisonDetail } from "./useComparisonDetail"

import type {
  ComparisonDetailDto,
  SnapshotSummaryDto,
} from "./comparison.types"

function makeSnapshotSummary(
  overrides: Partial<SnapshotSummaryDto> = {},
): SnapshotSummaryDto {
  return {
    projectId: "proj-1",
    apiId: "api-1",
    environmentId: "env-1",
    executionCompletedAt: "2026-09-01T00:00:00.000Z",
    latencyMs: 100,
    apiVersion: "1.0.0",
    databaseVersion: "db-1.0",
    isInvalidatedNow: false,
    ...overrides,
  }
}

function makeDetail(
  overrides: Partial<ComparisonDetailDto> = {},
): ComparisonDetailDto {
  return {
    comparisonId: "cmp-1",
    projectId: "proj-1",
    apiId: "api-1",
    environmentId: "env-1",
    baselineSnapshotId: "snap-a",
    targetSnapshotId: "snap-b",
    sourceKind: "AUTO_EXECUTION",
    sourceExecutionId: "exec-1",
    comparisonChainId: null,
    pairOrdinal: null,
    processingStatus: "QUEUED",
    stoppedAtGate: null,
    reasonCode: null,
    reasonDetailSafe: null,
    inputCheckOutcome: null,
    result: null,
    outputDifferenceCount: null,
    classification: null,
    classificationRevision: null,
    classifiedBy: null,
    classifiedAt: null,
    baselineSnapshot: makeSnapshotSummary(),
    targetSnapshot: makeSnapshotSummary(),
    latencyDeltaMs: null,
    apiVersionChanged: null,
    databaseVersionChanged: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    endedAt: null,
    appliedRuleSummary: null,
    latestAttemptNumber: 1,
    findingsLink: "/comparisons/cmp-1/findings",
    attemptsLink: "/comparisons/cmp-1/attempts",
    ...overrides,
  }
}

const NOT_FOUND_BODY = {
  errorCode: "NOT_FOUND",
  message: "Comparison not found.",
  details: [],
  requestId: "r1",
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe("useComparisonDetail", () => {
  it("fetches once on mount and never polls once already terminal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeDetail({ processingStatus: "COMPLETED", result: "SAME" }),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()
    const { result } = renderHook(() =>
      useComparisonDetail("cmp-1", "token-1", onSessionExpired, onAccessDenied),
    )

    await flush(0)

    expect(result.current.comparison?.processingStatus).toBe("COMPLETED")
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(false)

    await flush(20000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("polls with a growing backoff delay while QUEUED/RUNNING, stopping once COMPLETED (AC-10)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(200, makeDetail({ processingStatus: "QUEUED" })),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(200, makeDetail({ processingStatus: "RUNNING" })),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeDetail({
            processingStatus: "COMPLETED",
            result: "SAME",
            outputDifferenceCount: 0,
          }),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()
    const { result } = renderHook(() =>
      useComparisonDetail("cmp-1", "token-1", onSessionExpired, onAccessDenied),
    )

    await flush(0)
    expect(result.current.comparison?.processingStatus).toBe("QUEUED")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // First backoff delay is the 1000ms initial delay.
    await flush(1000)
    expect(result.current.comparison?.processingStatus).toBe("RUNNING")
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Delay grows ×1.5 after a non-terminal poll: 1000 -> 1500.
    await flush(1500)
    expect(result.current.comparison?.processingStatus).toBe("COMPLETED")
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // Terminal — no further polling no matter how much time passes.
    await flush(30000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("stops polling and reports notFound when a poll 404s mid-flight (AC-10)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(200, makeDetail({ processingStatus: "RUNNING" })),
      )
      .mockResolvedValueOnce(mockJsonResponse(404, NOT_FOUND_BODY))
    vi.stubGlobal("fetch", fetchMock)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()
    const { result } = renderHook(() =>
      useComparisonDetail("cmp-1", "token-1", onSessionExpired, onAccessDenied),
    )

    await flush(0)
    expect(result.current.notFound).toBe(false)
    expect(result.current.comparison?.processingStatus).toBe("RUNNING")

    await flush(1000)

    expect(result.current.notFound).toBe(true)
    expect(result.current.comparison).toBeNull()
    expect(onAccessDenied).not.toHaveBeenCalled()

    // Access-guard 404s are collapsed to "not found" and polling stops for good.
    await flush(30000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reports notFound immediately when the initial load 404s, without ever polling", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(404, NOT_FOUND_BODY))
    vi.stubGlobal("fetch", fetchMock)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()
    const { result } = renderHook(() =>
      useComparisonDetail("cmp-1", "token-1", onSessionExpired, onAccessDenied),
    )

    await flush(0)

    expect(result.current.notFound).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(result.current.comparison).toBeNull()

    await flush(30000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
