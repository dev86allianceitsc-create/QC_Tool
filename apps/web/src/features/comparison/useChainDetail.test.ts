import { act, renderHook } from "@testing-library/react"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { useChainDetail } from "./useChainDetail"

import type {
  ComparisonChainDetailDto,
  ComparisonChainPairDto,
  ComparisonSummaryDto,
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

function makeComparisonSummary(
  overrides: Partial<ComparisonSummaryDto> = {},
): ComparisonSummaryDto {
  return {
    comparisonId: "cmp-1",
    projectId: "proj-1",
    apiId: "api-1",
    environmentId: "env-1",
    baselineSnapshotId: "snap-a",
    targetSnapshotId: "snap-b",
    sourceKind: "CHAIN_PAIR",
    sourceExecutionId: null,
    comparisonChainId: "chain-1",
    pairOrdinal: 1,
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
    ...overrides,
  }
}

function makePair(
  pairOrdinal: number,
  comparisonOverrides: Partial<ComparisonSummaryDto> = {},
): ComparisonChainPairDto {
  return {
    pairOrdinal,
    comparison: makeComparisonSummary({ pairOrdinal, ...comparisonOverrides }),
  }
}

function makeChain(
  pairs: ComparisonChainPairDto[],
  overrides: Partial<ComparisonChainDetailDto> = {},
): ComparisonChainDetailDto {
  return {
    comparisonChainId: "chain-1",
    projectId: "proj-1",
    apiId: "api-1",
    environmentId: "env-1",
    requestedAt: "2026-09-01T00:00:00.000Z",
    selectedSnapshotCount: pairs.length + 1,
    pairs,
    page: 1,
    pageSize: 20,
    totalItems: pairs.length,
    hasMore: false,
    ...overrides,
  }
}

const NOT_FOUND_BODY = {
  errorCode: "NOT_FOUND",
  message: "Chain not found.",
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

describe("useChainDetail", () => {
  it("keeps polling while any pair is non-terminal, stopping only once every pair is terminal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeChain([
            makePair(1, { processingStatus: "COMPLETED", result: "SAME" }),
            makePair(2, { processingStatus: "QUEUED" }),
          ]),
        ),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeChain([
            makePair(1, { processingStatus: "COMPLETED", result: "SAME" }),
            makePair(2, { processingStatus: "RUNNING" }),
          ]),
        ),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeChain([
            makePair(1, { processingStatus: "COMPLETED", result: "SAME" }),
            makePair(2, { processingStatus: "COMPLETED", result: "DIFFERENT" }),
          ]),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()
    const { result } = renderHook(() =>
      useChainDetail(
        "chain-1",
        1,
        20,
        "token-1",
        onSessionExpired,
        onAccessDenied,
      ),
    )

    await flush(0)
    expect(
      result.current.chain?.pairs.map((p) => p.comparison.processingStatus),
    ).toEqual(["COMPLETED", "QUEUED"])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await flush(1000)
    expect(result.current.chain?.pairs[1]?.comparison.processingStatus).toBe(
      "RUNNING",
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await flush(1500)
    expect(result.current.chain?.pairs[1]?.comparison.processingStatus).toBe(
      "COMPLETED",
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await flush(30000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("does not let a BLOCKED pair short-circuit polling while a sibling pair is still active (AC-06)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeChain([
            makePair(1, {
              processingStatus: "BLOCKED",
              reasonCode: "SNAPSHOT_INVALIDATED",
            }),
            makePair(2, { processingStatus: "RUNNING" }),
          ]),
        ),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeChain([
            makePair(1, {
              processingStatus: "BLOCKED",
              reasonCode: "SNAPSHOT_INVALIDATED",
            }),
            makePair(2, { processingStatus: "COMPLETED", result: "SAME" }),
          ]),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()
    const { result } = renderHook(() =>
      useChainDetail(
        "chain-1",
        1,
        20,
        "token-1",
        onSessionExpired,
        onAccessDenied,
      ),
    )

    await flush(0)
    // Pair 1 is already terminal (BLOCKED) but pair 2 is not — the chain as a
    // whole must not be treated as terminal yet.
    expect(result.current.chain?.pairs[0]?.comparison.processingStatus).toBe(
      "BLOCKED",
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await flush(1000)
    expect(result.current.chain?.pairs[0]?.comparison.processingStatus).toBe(
      "BLOCKED",
    )
    expect(result.current.chain?.pairs[1]?.comparison.processingStatus).toBe(
      "COMPLETED",
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Every pair is now terminal — polling stops for good.
    await flush(30000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("stops polling and reports notFound when a poll 404s mid-flight", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeChain([makePair(1, { processingStatus: "RUNNING" })]),
        ),
      )
      .mockResolvedValueOnce(mockJsonResponse(404, NOT_FOUND_BODY))
    vi.stubGlobal("fetch", fetchMock)

    const onSessionExpired = vi.fn()
    const onAccessDenied = vi.fn()
    const { result } = renderHook(() =>
      useChainDetail(
        "chain-1",
        1,
        20,
        "token-1",
        onSessionExpired,
        onAccessDenied,
      ),
    )

    await flush(0)
    expect(result.current.notFound).toBe(false)

    await flush(1000)
    expect(result.current.notFound).toBe(true)
    expect(result.current.chain).toBeNull()

    await flush(30000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
