import { fireEvent, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { ChainDetailScreen } from "./ChainDetailScreen"

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
    baselineSnapshotId: "aaaaaaaa-0000-0000-0000-000000000000",
    targetSnapshotId: "bbbbbbbb-0000-0000-0000-000000000000",
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
  message: "Chain not found.",
  details: [],
  requestId: "r1",
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function stubFetch(
  chain: ComparisonChainDetailDto | (() => ComparisonChainDetailDto),
  chainStatus = 200,
) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const u = String(url)

    if (u.includes("/environments")) {
      return Promise.resolve(mockJsonResponse(200, { ...ENVIRONMENTS_PAGE }))
    }

    if (u.includes("/apis")) {
      return Promise.resolve(mockJsonResponse(200, { ...APIS_PAGE }))
    }

    if (u.includes("/comparison-chains/")) {
      if (chainStatus !== 200) {
        return Promise.resolve(mockJsonResponse(chainStatus, NOT_FOUND_BODY))
      }
      const body = typeof chain === "function" ? chain() : chain
      return Promise.resolve(mockJsonResponse(200, { ...body }))
    }

    return Promise.resolve(mockJsonResponse(404, {}))
  })

  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderScreen(
  overrides: Partial<{
    onBack: () => void
    onViewComparison: (comparisonId: string) => void
    onSessionExpired: () => void
    onAccessDenied: () => void
  }> = {},
) {
  return render(
    <ChainDetailScreen
      projectId="proj-1"
      comparisonChainId="chain-1"
      accessToken="token-1"
      onBack={overrides.onBack ?? vi.fn()}
      onViewComparison={overrides.onViewComparison ?? vi.fn()}
      onSessionExpired={overrides.onSessionExpired ?? vi.fn()}
      onAccessDenied={overrides.onAccessDenied ?? vi.fn()}
    />,
  )
}

describe("ChainDetailScreen", () => {
  it("resolves API/Environment names in the header and shows Snapshot/pair counts", async () => {
    stubFetch(
      makeChain([
        makePair(1, { processingStatus: "COMPLETED", result: "SAME" }),
      ]),
    )

    renderScreen()

    expect(await screen.findByText("Widget API")).toBeInTheDocument()
    expect(screen.getByText("Staging")).toBeInTheDocument()
    expect(screen.getByText("2 Snapshots selected")).toBeInTheDocument()
    expect(screen.getByText("1 pair")).toBeInTheDocument()
    expect(screen.getByText(/^Requested /)).toBeInTheDocument()
  })

  it("falls back to the raw id when the API/Environment isn't in the loaded list (deviation #7)", async () => {
    stubFetch(
      makeChain([makePair(1)], {
        apiId: "api-missing",
        environmentId: "env-missing",
      }),
    )

    renderScreen()

    expect(await screen.findByText("api-missing")).toBeInTheDocument()
    expect(screen.getByText("env-missing")).toBeInTheDocument()
  })

  it("keeps a BLOCKED pair's own status/Result independent of a sibling's, with no aggregate chain-level badge (AC-06)", async () => {
    stubFetch(
      makeChain([
        makePair(1, {
          comparisonId: "cmp-1",
          processingStatus: "BLOCKED",
          reasonCode: "SNAPSHOT_INVALIDATED",
          reasonDetailSafe: "Baseline Snapshot was invalidated mid-chain.",
          stoppedAtGate: "INPUT",
          result: "SAME",
        }),
        makePair(2, {
          comparisonId: "cmp-2",
          processingStatus: "COMPLETED",
          result: "DIFFERENT",
          classification: "UNEXPECTED",
        }),
      ]),
    )

    renderScreen()

    const rows = await screen.findAllByRole("row")
    // header row + 2 pair rows
    expect(rows).toHaveLength(3)

    const row1 = rows[1]!
    const row2 = rows[2]!

    expect(row1.textContent).toContain("#1")
    expect(row1.textContent).toContain("Cannot compare fully")
    // BLOCKED collapses any stale `result` to "—", never a stale SAME badge.
    expect(row1.textContent).toContain("—")
    expect(row1.textContent).not.toContain("SAME")
    expect(row1.textContent).toContain("INPUT")
    expect(row1.textContent).toContain(
      "Baseline Snapshot was invalidated mid-chain.",
    )

    expect(row2.textContent).toContain("#2")
    expect(row2.textContent).toContain("Completed")
    expect(row2.textContent).toContain("DIFFERENT")
    expect(row2.textContent).toContain("Unexpected")

    // Exactly one Result badge rendered (pair 2's) — no chain-level aggregate.
    expect(screen.getAllByText("DIFFERENT")).toHaveLength(1)
    expect(screen.queryByText("SAME")).not.toBeInTheDocument()
    // Exactly 2 status badges total (one per pair), confirming no extra
    // summary badge exists outside the table.
    expect(screen.getAllByText("Cannot compare fully")).toHaveLength(1)
    expect(screen.getAllByText("Completed")).toHaveLength(1)
  })

  it("renders the Snapshot pair in A→B order using the short id format, never swapped", async () => {
    stubFetch(
      makeChain([
        makePair(1, {
          baselineSnapshotId: "aaaaaaaa-1111-1111-1111-111111111111",
          targetSnapshotId: "bbbbbbbb-2222-2222-2222-222222222222",
        }),
      ]),
    )

    renderScreen()

    expect(await screen.findByText("SNP-AAAAAAAA")).toBeInTheDocument()
    expect(screen.getByText("SNP-BBBBBBBB")).toBeInTheDocument()
    expect(screen.getByText("→")).toBeInTheDocument()
  })

  it("calls onViewComparison with the clicked row's own comparisonId", async () => {
    const onViewComparison = vi.fn()
    stubFetch(
      makeChain([
        makePair(1, { comparisonId: "cmp-first" }),
        makePair(2, { comparisonId: "cmp-second" }),
      ]),
    )

    renderScreen({ onViewComparison })

    const viewButtons = await screen.findAllByRole("button", { name: "View" })
    expect(viewButtons).toHaveLength(2)

    fireEvent.click(viewButtons[1]!)

    expect(onViewComparison).toHaveBeenCalledWith("cmp-second")
    expect(onViewComparison).toHaveBeenCalledTimes(1)
  })

  it("shows the Showing range and disables Prev on page 1 and Next when hasMore is false", async () => {
    stubFetch(
      makeChain([makePair(1)], { page: 1, totalItems: 1, hasMore: false }),
    )

    renderScreen()

    expect(await screen.findByText("Showing 1–1 of 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("enables Next when hasMore is true and disables Prev only while on page 1", async () => {
    stubFetch(
      makeChain([makePair(1)], { page: 1, totalItems: 45, hasMore: true }),
    )

    renderScreen()

    await screen.findByText("Showing 1–20 of 45")
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled()
  })

  it("shows a not-found empty state and a Back control when the chain 404s", async () => {
    const onBack = vi.fn()
    stubFetch(makeChain([]), 404)

    renderScreen({ onBack })

    expect(
      await screen.findByText(
        "This Comparison Chain no longer exists or you no longer have access to it.",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "← Comparisons" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("shows a 'No pairs recorded' message for a chain with zero pairs", async () => {
    stubFetch(makeChain([]))

    renderScreen()

    expect(
      await screen.findByText("No pairs recorded for this Chain."),
    ).toBeInTheDocument()
  })
})
