import { fireEvent, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { ComparisonFindingsTab } from "./ComparisonFindingsTab"

import type {
  ComparisonFindingItemDto,
  ComparisonFindingPhase,
  ComparisonFindingsResult,
  ComparisonProcessingStatus,
  FindingSideDto,
} from "./comparison.types"

function makeSide(overrides: Partial<FindingSideDto> = {}): FindingSideDto {
  return {
    presenceKind: "VALUE",
    displayKind: "string",
    safeText: "hello",
    hexPreview: null,
    isRedacted: true,
    hasMore: false,
    ...overrides,
  }
}

function makeFinding(
  overrides: Partial<ComparisonFindingItemDto> = {},
): ComparisonFindingItemDto {
  return {
    findingId: "f1",
    phase: "OUTPUT",
    component: "HTTP_STATUS",
    differenceKind: "VALUE_MISMATCH",
    findingOrdinal: 1,
    location: null,
    a: makeSide(),
    b: makeSide(),
    ruleCode: "RULE-001",
    ruleVersion: "1",
    safeSummary: "Status code differs",
    ...overrides,
  }
}

function makeResult(
  overrides: Partial<ComparisonFindingsResult> = {},
): ComparisonFindingsResult {
  return {
    comparisonId: "cmp-1",
    phase: "OUTPUT",
    result: "DIFFERENT",
    processingStatus: "COMPLETED",
    items: [],
    page: 1,
    pageSize: 20,
    totalItems: 0,
    hasMore: false,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubFetch(
  response: ComparisonFindingsResult | (() => ComparisonFindingsResult),
) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/findings")) {
      const body = typeof response === "function" ? response() : response
      return Promise.resolve(mockJsonResponse(200, body))
    }
    return Promise.resolve(mockJsonResponse(404, {}))
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderTab(
  overrides: Partial<{
    comparisonId: string
    phase: ComparisonFindingPhase
    onSessionExpired: () => void
    onAccessDenied: () => void
  }> = {},
) {
  return render(
    <ComparisonFindingsTab
      comparisonId={overrides.comparisonId ?? "cmp-1"}
      phase={overrides.phase ?? "OUTPUT"}
      accessToken="token-1"
      onSessionExpired={overrides.onSessionExpired ?? vi.fn()}
      onAccessDenied={overrides.onAccessDenied ?? vi.fn()}
    />,
  )
}

describe("ComparisonFindingsTab", () => {
  it("renders findings in A→B order with side presence labels, location, and rule code (AC-05)", async () => {
    stubFetch(
      makeResult({
        items: [
          makeFinding({
            component: "RESPONSE_HEADER",
            differenceKind: "VALUE_MISMATCH",
            location: { path: "$.headers.x-request-id" },
            a: makeSide({ presenceKind: "VALUE", safeText: "req-a" }),
            b: makeSide({ presenceKind: "VALUE", safeText: "req-b" }),
            ruleCode: "RULE-HEADER-001",
            ruleVersion: "2",
            safeSummary: "Header value differs",
          }),
        ],
        totalItems: 1,
      }),
    )

    renderTab()

    expect(await screen.findByText("Header value differs")).toBeInTheDocument()
    expect(screen.getByText("RESPONSE HEADER")).toBeInTheDocument()
    expect(screen.getByText("$.headers.x-request-id")).toBeInTheDocument()
    expect(screen.getByText("RULE-HEADER-001 · 2")).toBeInTheDocument()
    expect(screen.getByText("Side A")).toBeInTheDocument()
    expect(screen.getByText("Side B")).toBeInTheDocument()
    expect(screen.getByText("req-a")).toBeInTheDocument()
    expect(screen.getByText("req-b")).toBeInTheDocument()
  })

  it("shows a Type mismatch badge only when display kinds differ across sides", async () => {
    stubFetch(
      makeResult({
        items: [
          makeFinding({
            findingId: "f-mismatch",
            a: makeSide({ displayKind: "string" }),
            b: makeSide({ displayKind: "number" }),
          }),
          makeFinding({
            findingId: "f-same-kind",
            a: makeSide({ displayKind: "string" }),
            b: makeSide({ displayKind: "string" }),
          }),
        ],
        totalItems: 2,
      }),
    )

    renderTab()

    await screen.findAllByText("Side A")
    expect(screen.getAllByText("Type mismatch")).toHaveLength(1)
  })

  it("shows the Showing range and disables Prev on page 1 and Next when hasMore is false", async () => {
    stubFetch(
      makeResult({
        items: [makeFinding()],
        page: 1,
        totalItems: 1,
        hasMore: false,
      }),
    )

    renderTab()

    expect(await screen.findByText("Showing 1–1 of 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("enables Prev/Next mid-list, and clicking Next advances the page and refetches", async () => {
    const fetchMock = stubFetch(() =>
      makeResult({
        items: [makeFinding()],
        totalItems: 45,
        hasMore: true,
      }),
    )

    renderTab()

    // Initial render: the hook's own page state starts at 1 (the response's
    // `page` field is never read — the hook manages paging client-side).
    expect(await screen.findByText("Showing 1–20 of 45")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled()

    fetchMock.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    await screen.findByText("Showing 21–40 of 45")
    expect(screen.getByRole("button", { name: "Prev" })).not.toBeDisabled()

    const findingsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/findings"),
    )
    expect(findingsCalls.length).toBeGreaterThan(0)
    expect(String(findingsCalls[0]?.[0])).toContain("page=2")
  })

  it.each<[ComparisonProcessingStatus | null, ComparisonFindingPhase, string]>([
    [
      null,
      "OUTPUT",
      "Still processing — this tab will update once the comparison finishes.",
    ],
    [
      "QUEUED",
      "OUTPUT",
      "Still processing — this tab will update once the comparison finishes.",
    ],
    [
      "RUNNING",
      "INPUT",
      "Still processing — this tab will update once the comparison finishes.",
    ],
    ["COMPLETED", "OUTPUT", "No output differences found."],
    ["COMPLETED", "INPUT", "No input issues found."],
    [
      "BLOCKED",
      "OUTPUT",
      "The comparison did not reach the output-comparison stage.",
    ],
    ["FAILED", "INPUT", "No input diagnosis recorded for this comparison."],
  ])(
    "renders the correct empty-state message for processingStatus=%s phase=%s",
    async (processingStatus, phase, expectedMessage) => {
      stubFetch(
        makeResult({
          phase,
          processingStatus: processingStatus ?? "QUEUED",
          items: [],
          totalItems: 0,
        }),
      )

      renderTab({ phase })

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument()
    },
  )

  it("shows an error message with a Retry button on failure, and Retry re-fetches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(500, {
          errorCode: "INTERNAL_ERROR",
          message: "Unable to load findings right now.",
          details: [],
          requestId: "r1",
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeResult({ items: [makeFinding()], totalItems: 1 }),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    renderTab()

    expect(
      await screen.findByText("Unable to load findings right now."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Status code differs")).toBeInTheDocument()
  })

  it("never renders a raw/download control for a redacted finding side (deviation #2)", async () => {
    stubFetch(
      makeResult({
        items: [
          makeFinding({
            a: makeSide({ isRedacted: true, hasMore: true }),
            b: makeSide({ isRedacted: true }),
          }),
        ],
        totalItems: 1,
      }),
    )

    renderTab()

    await screen.findByText("Status code differs")
    expect(screen.queryByText(/download/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^raw$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/view raw/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/redacted/i)).not.toBeInTheDocument()
  })
})
