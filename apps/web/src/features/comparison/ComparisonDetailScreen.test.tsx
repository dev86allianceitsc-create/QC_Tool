import { act, fireEvent, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { ComparisonDetailScreen } from "./ComparisonDetailScreen"

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

const EMPTY_FINDINGS = {
  comparisonId: "cmp-1",
  phase: null,
  result: null,
  processingStatus: "COMPLETED",
  items: [],
  page: 1,
  pageSize: 20,
  totalItems: 0,
  hasMore: false,
}

const EMPTY_ATTEMPTS = {
  items: [],
  page: 1,
  pageSize: 20,
  totalItems: 0,
  hasMore: false,
}

const EMPTY_CLASSIFICATION_EVENTS = {
  items: [],
  page: 1,
  pageSize: 20,
  totalItems: 0,
  hasMore: false,
}

const APIS_PAGE = {
  items: [
    {
      apiId: "api-1",
      apiName: "Widget API",
      httpMethod: "GET",
      path: "/widgets",
      description: null,
      creationSource: "MANUAL",
      createdAt: "t",
      updatedAt: "t",
    },
  ],
  page: 1,
  pageSize: 100,
  totalItems: 1,
  totalPages: 1,
}

const ENVIRONMENTS_PAGE = {
  items: [
    {
      environmentId: "env-1",
      environmentName: "Staging",
      classification: "NON_PRODUCTION",
      allowRun: true,
      environmentStatus: "ACTIVE",
      createdAt: "t",
      updatedAt: "t",
    },
  ],
  page: 1,
  pageSize: 100,
  totalItems: 1,
  totalPages: 1,
}

const NOT_FOUND_BODY = {
  errorCode: "NOT_FOUND",
  message: "Comparison not found.",
  details: [],
  requestId: "r1",
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function stubFetch(
  overrides: {
    comparison?: unknown | (() => unknown)
    comparisonStatus?: number
    apis?: unknown
    environments?: unknown
    findings?: unknown
    attempts?: unknown
    classificationEvents?: unknown
    reevaluate?: unknown
    reevaluateStatus?: number
  } = {},
) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/reevaluate")) {
      return Promise.resolve(
        mockJsonResponse(
          overrides.reevaluateStatus ?? 201,
          overrides.reevaluate ?? {
            comparisonAttemptId: "att-2",
            attemptNumber: 2,
            processingStatus: "COMPLETED",
            result: "SAME",
          },
        ),
      )
    }

    if (url.includes("/findings")) {
      return Promise.resolve(
        mockJsonResponse(200, overrides.findings ?? EMPTY_FINDINGS),
      )
    }

    if (url.includes("/attempts")) {
      return Promise.resolve(
        mockJsonResponse(200, overrides.attempts ?? EMPTY_ATTEMPTS),
      )
    }

    if (url.includes("/classification-events")) {
      return Promise.resolve(
        mockJsonResponse(
          200,
          overrides.classificationEvents ?? EMPTY_CLASSIFICATION_EVENTS,
        ),
      )
    }

    if (url.includes("/environments")) {
      return Promise.resolve(
        mockJsonResponse(200, overrides.environments ?? ENVIRONMENTS_PAGE),
      )
    }

    if (url.includes("/apis")) {
      return Promise.resolve(mockJsonResponse(200, overrides.apis ?? APIS_PAGE))
    }

    if (url.includes("/comparisons/")) {
      const body =
        typeof overrides.comparison === "function"
          ? (overrides.comparison as () => unknown)()
          : overrides.comparison ?? makeDetail()
      return Promise.resolve(
        mockJsonResponse(
          overrides.comparisonStatus ?? 200,
          // Real fetch().json() always parses a fresh object; clone here so
          // repeated polls against a fixed `overrides.comparison` don't hand
          // React the exact same reference back (which would make setData a
          // referential-equality no-op and silently stall polling forever).
          { ...body as Record<string, unknown> },
        ),
      )
    }

    return Promise.resolve(mockJsonResponse(404, {}))
  })

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function renderScreen(
  overrides: Partial<{
    onBack: () => void
    onViewChain: (comparisonChainId: string) => void
    onSessionExpired: () => void
    onAccessDenied: () => void
  }> = {},
) {
  return render(
    <ComparisonDetailScreen
      projectId="proj-1"
      comparisonId="cmp-1"
      accessToken="token-1"
      onBack={vi.fn()}
      onViewChain={vi.fn()}
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
      {...overrides}
    />,
  )
}

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe("ComparisonDetailScreen", () => {
  it("resolves the API and Environment names from the loaded lists (deviation #7)", async () => {
    stubFetch({
      comparison: makeDetail({ apiId: "api-1", environmentId: "env-1" }),
    })

    renderScreen()

    expect(await screen.findByText("Widget API")).toBeInTheDocument()
    expect(screen.getByText("Staging")).toBeInTheDocument()
  })

  it("falls back to the raw id when the API or Environment isn't in the loaded list", async () => {
    stubFetch({
      comparison: makeDetail({
        apiId: "api-missing",
        environmentId: "env-missing",
      }),
    })

    renderScreen()

    expect(await screen.findByText("api-missing")).toBeInTheDocument()
    expect(screen.getByText("env-missing")).toBeInTheDocument()
  })

  it("shows 'Not concluded yet' while processingStatus is QUEUED, with no Result/classification badge", async () => {
    stubFetch({
      comparison: makeDetail({ processingStatus: "QUEUED", result: null }),
    })

    renderScreen()

    expect(await screen.findByText("Not concluded yet")).toBeInTheDocument()
    expect(screen.queryByText("SAME")).not.toBeInTheDocument()
    expect(screen.queryByText("DIFFERENT")).not.toBeInTheDocument()
  })

  it("shows the Result badge once COMPLETED", async () => {
    stubFetch({
      comparison: makeDetail({
        processingStatus: "COMPLETED",
        result: "SAME",
        outputDifferenceCount: 0,
      }),
    })

    renderScreen()

    expect(await screen.findByText("SAME")).toBeInTheDocument()
    expect(screen.queryByText("Not concluded yet")).not.toBeInTheDocument()
  })

  it("shows a classification chip beside Result only when result is DIFFERENT", async () => {
    stubFetch({
      comparison: makeDetail({
        processingStatus: "COMPLETED",
        result: "DIFFERENT",
        classification: "EXPECTED",
      }),
    })

    renderScreen()

    expect(await screen.findByText("DIFFERENT")).toBeInTheDocument()
    expect(screen.getByText("Expected")).toBeInTheDocument()
  })

  it("never shows a classification chip when result is SAME, even with a stale non-null classification", async () => {
    stubFetch({
      comparison: makeDetail({
        processingStatus: "COMPLETED",
        result: "SAME",
        classification: "UNEXPECTED",
      }),
    })

    renderScreen()

    expect(await screen.findByText("SAME")).toBeInTheDocument()
    expect(screen.queryByText("Unexpected")).not.toBeInTheDocument()
  })

  it("shows the invalidation banner once COMPLETED when a snapshot side is invalidated now, without rewriting Result", async () => {
    stubFetch({
      comparison: makeDetail({
        processingStatus: "COMPLETED",
        result: "SAME",
        baselineSnapshot: makeSnapshotSummary({ isInvalidatedNow: true }),
      }),
    })

    renderScreen()

    expect(await screen.findByText(/have since been/i)).toBeInTheDocument()
    expect(screen.getByText("SAME")).toBeInTheDocument()
  })

  it("never shows the invalidation banner when the comparison isn't COMPLETED, even if a snapshot is invalidated now", async () => {
    stubFetch({
      comparison: makeDetail({
        processingStatus: "BLOCKED",
        targetSnapshot: makeSnapshotSummary({ isInvalidatedNow: true }),
      }),
    })

    renderScreen()

    await screen.findByText("Blocked")
    expect(screen.queryByText(/have since been/i)).not.toBeInTheDocument()
  })

  it("renders a chain cross-link when comparisonChainId is set, wired to the right id", async () => {
    const onViewChain = vi.fn()
    stubFetch({
      comparison: makeDetail({ comparisonChainId: "chain-9", pairOrdinal: 3 }),
    })

    renderScreen({ onViewChain })

    const link = await screen.findByText("Part of chain · pair #3 · View chain")
    fireEvent.click(link)

    expect(onViewChain).toHaveBeenCalledWith("chain-9")
  })

  it("never renders a chain cross-link when comparisonChainId is null", async () => {
    stubFetch({ comparison: makeDetail({ comparisonChainId: null }) })

    renderScreen()

    await screen.findByText("Widget API")
    expect(screen.queryByText(/View chain/)).not.toBeInTheDocument()
  })

  it("switches between all 5 tabs, rendering each tab's own content", async () => {
    stubFetch({
      comparison: makeDetail({
        processingStatus: "COMPLETED",
        result: "SAME",
        outputDifferenceCount: 0,
      }),
    })

    renderScreen()

    expect(await screen.findByText("Source")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Output differences" }))
    expect(
      await screen.findByText("No output differences found."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Input diagnosis" }))
    expect(
      await screen.findByText("No input issues found."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Attempt history" }))
    expect(
      await screen.findByText("No attempts recorded yet."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Classification history" }))
    expect(
      await screen.findByText("No classification events recorded yet."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Overview" }))
    expect(await screen.findByText("Source")).toBeInTheDocument()
  })

  it("renders the shared not-found state when the initial load 404s", async () => {
    stubFetch({ comparisonStatus: 404, comparison: NOT_FOUND_BODY })

    renderScreen()

    expect(
      await screen.findByText(
        "This Comparison no longer exists or you no longer have access to it.",
      ),
    ).toBeInTheDocument()
  })

  it("shows a timed-out banner after MAX_POLLS non-terminal polls, without ever reaching a Result", async () => {
    vi.useFakeTimers()
    stubFetch({ comparison: makeDetail({ processingStatus: "QUEUED" }) })

    renderScreen()

    await flush(0)
    expect(
      screen.queryByText(/taking longer than expected/i),
    ).not.toBeInTheDocument()

    // MAX_POLLS=80; each flush(10_000) reliably fires exactly one pending
    // timer (delays are always <= the 10s cap), so 90 iterations comfortably
    // crosses the threshold.
    for (let i = 0; i < 90; i += 1) {
      await flush(10_000)
    }

    expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument()
  })

  it("shows the Re-evaluate button only once the Comparison is COMPLETED", async () => {
    stubFetch({ comparison: makeDetail({ processingStatus: "QUEUED" }) })

    renderScreen()

    await screen.findByText("Widget API")
    expect(
      screen.queryByRole("button", { name: "Re-evaluate" }),
    ).not.toBeInTheDocument()
  })

  it("shows the Re-evaluate button once COMPLETED", async () => {
    stubFetch({
      comparison: makeDetail({ processingStatus: "COMPLETED", result: "SAME" }),
    })

    renderScreen()

    expect(
      await screen.findByRole("button", { name: "Re-evaluate" }),
    ).toBeInTheDocument()
  })

  it("clicking Re-evaluate calls the reevaluate API then refetches and shows the updated result", async () => {
    let comparisonCalls = 0
    const fetchMock = stubFetch({
      comparison: () => {
        comparisonCalls += 1
        return comparisonCalls === 1
          ? makeDetail({ processingStatus: "COMPLETED", result: "DIFFERENT" })
          : makeDetail({ processingStatus: "COMPLETED", result: "SAME" })
      },
      reevaluate: {
        comparisonAttemptId: "att-2",
        attemptNumber: 2,
        processingStatus: "COMPLETED",
        result: "SAME",
      },
    })

    renderScreen()

    const button = await screen.findByRole("button", { name: "Re-evaluate" })
    expect(await screen.findByText("DIFFERENT")).toBeInTheDocument()

    fireEvent.click(button)

    expect(await screen.findByText("SAME")).toBeInTheDocument()
    expect(screen.queryByText("DIFFERENT")).not.toBeInTheDocument()

    const reevaluateCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/reevaluate"),
    )
    expect(reevaluateCall).toBeDefined()
    expect(reevaluateCall?.[1]).toMatchObject({ method: "POST" })
  })

  it("shows an inline error when the reevaluate call fails, without crashing", async () => {
    stubFetch({
      comparison: makeDetail({ processingStatus: "COMPLETED", result: "SAME" }),
      reevaluateStatus: 409,
      reevaluate: {
        errorCode: "LATEST_ATTEMPT_NOT_COMPLETED",
        message: "The latest attempt is not completed.",
        details: [],
        requestId: "r1",
      },
    })

    renderScreen()

    const button = await screen.findByRole("button", { name: "Re-evaluate" })
    fireEvent.click(button)

    expect(
      await screen.findByText("The latest attempt is not completed."),
    ).toBeInTheDocument()
    expect(await screen.findByText("SAME")).toBeInTheDocument()
  })
})
