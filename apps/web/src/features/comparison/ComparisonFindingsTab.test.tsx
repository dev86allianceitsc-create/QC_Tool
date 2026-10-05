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
    projectId: string
    apiId: string
    onSessionExpired: () => void
    onAccessDenied: () => void
    detailProcessingStatus: ComparisonProcessingStatus | null
  }> = {},
) {
  return render(
    <ComparisonFindingsTab
      comparisonId={overrides.comparisonId ?? "cmp-1"}
      phase={overrides.phase ?? "OUTPUT"}
      projectId={overrides.projectId}
      apiId={overrides.apiId}
      accessToken="token-1"
      onSessionExpired={overrides.onSessionExpired ?? vi.fn()}
      onAccessDenied={overrides.onAccessDenied ?? vi.fn()}
      detailProcessingStatus={overrides.detailProcessingStatus ?? null}
    />,
  )
}

function makeBodyFinding(
  overrides: Partial<ComparisonFindingItemDto> = {},
): ComparisonFindingItemDto {
  return makeFinding({
    component: "RESPONSE_BODY",
    location: { path: "$.StartTime" },
    a: makeSide({ presenceKind: "VALUE", safeText: "100", isRedacted: false }),
    b: makeSide({ presenceKind: "VALUE", safeText: "150", isRedacted: false }),
    safeSummary: "$.StartTime differs",
    ...overrides,
  })
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

  it("refetches when the parent's detailProcessingStatus transitions, so a tab left open updates once processing finishes", async () => {
    const fetchMock = stubFetch(() =>
      makeResult({
        processingStatus: "RUNNING",
        items: [],
        totalItems: 0,
      }),
    )

    const { rerender } = renderTab({ detailProcessingStatus: "QUEUED" })

    expect(
      await screen.findByText(
        "Still processing — this tab will update once the comparison finishes.",
      ),
    ).toBeInTheDocument()

    fetchMock.mockClear()
    stubFetch(() =>
      makeResult({
        processingStatus: "COMPLETED",
        items: [],
        totalItems: 0,
      }),
    )

    rerender(
      <ComparisonFindingsTab
        comparisonId="cmp-1"
        phase="OUTPUT"
        accessToken="token-1"
        onSessionExpired={vi.fn()}
        onAccessDenied={vi.fn()}
        detailProcessingStatus="COMPLETED"
      />,
    )

    expect(
      await screen.findByText("No output differences found."),
    ).toBeInTheDocument()
  })

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

  it("shows real A/B values and a Difference summary for a non-sensitive header whose value changed", async () => {
    stubFetch(
      makeResult({
        items: [
          makeFinding({
            component: "RESPONSE_HEADER",
            location: { path: "$.headers.age" },
            a: makeSide({
              presenceKind: "VALUE",
              displayKind: "string",
              safeText: "123",
              isRedacted: false,
            }),
            b: makeSide({
              presenceKind: "VALUE",
              displayKind: "string",
              safeText: "167",
              isRedacted: false,
            }),
            safeSummary: 'Header "age" value differs',
          }),
        ],
        totalItems: 1,
      }),
    )

    renderTab()

    expect(await screen.findByText("123")).toBeInTheDocument()
    expect(screen.getByText("167")).toBeInTheDocument()
    expect(screen.getByText("Difference: 123 → 167")).toBeInTheDocument()
    expect(screen.queryByText("Has value")).not.toBeInTheDocument()
  })

  it("still shows the presence label when a side has no content box (ABSENT/NULL/EMPTY), but suppresses it once a real value box renders", async () => {
    stubFetch(
      makeResult({
        items: [
          makeFinding({
            a: makeSide({
              presenceKind: "ABSENT",
              displayKind: "string",
              safeText: null,
              isRedacted: false,
            }),
            b: makeSide({
              presenceKind: "VALUE",
              displayKind: "string",
              safeText: "value-b",
              isRedacted: false,
            }),
          }),
        ],
        totalItems: 1,
      }),
    )

    renderTab()

    expect(await screen.findByText("Does not exist")).toBeInTheDocument()
    expect(screen.getByText("value-b")).toBeInTheDocument()
    expect(screen.queryByText("Has value")).not.toBeInTheDocument()
  })

  it("collapses a redacted difference to the fixed protected-value phrase instead of diffing the literal [REDACTED] text", async () => {
    stubFetch(
      makeResult({
        items: [
          makeFinding({
            component: "REQUEST_HEADER",
            location: { path: "authorization" },
            a: makeSide({
              presenceKind: "VALUE",
              displayKind: "text",
              safeText: "[REDACTED]",
              isRedacted: true,
            }),
            b: makeSide({
              presenceKind: "VALUE",
              displayKind: "text",
              safeText: "[REDACTED]",
              isRedacted: true,
            }),
          }),
        ],
        totalItems: 1,
      }),
    )

    renderTab()

    expect(await screen.findByText("Difference detected in protected value")).toBeInTheDocument()
    expect(screen.getAllByText("[REDACTED]")).toHaveLength(2)
  })

  it("renders no Difference summary line when both sides genuinely have the same value", async () => {
    stubFetch(
      makeResult({
        items: [
          makeFinding({
            a: makeSide({
              presenceKind: "VALUE",
              displayKind: "string",
              safeText: "same-val",
              isRedacted: false,
            }),
            b: makeSide({
              presenceKind: "VALUE",
              displayKind: "string",
              safeText: "same-val",
              isRedacted: false,
            }),
          }),
        ],
        totalItems: 1,
      }),
    )

    renderTab()

    await screen.findByText("Status code differs")
    expect(screen.queryByText(/^Difference:/)).not.toBeInTheDocument()
  })

  it("hides the Ignore fields button when projectId/apiId are not provided", async () => {
    stubFetch(makeResult({ items: [makeBodyFinding()], totalItems: 1 }))

    renderTab()

    await screen.findByText("$.StartTime differs")
    expect(screen.queryByText("Ignore fields")).not.toBeInTheDocument()
  })

  it("hides the Ignore fields button on the INPUT phase even when projectId/apiId are provided", async () => {
    stubFetch(
      makeResult({
        phase: "INPUT",
        items: [makeBodyFinding()],
        totalItems: 1,
      }),
    )

    renderTab({ phase: "INPUT", projectId: "p1", apiId: "a1" })

    await screen.findByText("$.StartTime differs")
    expect(screen.queryByText("Ignore fields")).not.toBeInTheDocument()
  })

  it("shows the Ignore fields button on OUTPUT when projectId/apiId are provided", async () => {
    stubFetch(makeResult({ items: [makeBodyFinding()], totalItems: 1 }))

    renderTab({ projectId: "p1", apiId: "a1" })

    expect(await screen.findByText("Ignore fields")).toBeInTheDocument()
  })

  it("shows a checkbox only on RESPONSE_BODY findings with a path location, not on HTTP_STATUS/RESPONSE_HEADER findings", async () => {
    stubFetch(
      makeResult({
        items: [
          makeBodyFinding({ findingId: "f-body", location: { path: "$.StartTime" } }),
          makeFinding({
            findingId: "f-status",
            component: "HTTP_STATUS",
            location: null,
            safeSummary: "Status code differs",
          }),
          makeFinding({
            findingId: "f-header",
            component: "RESPONSE_HEADER",
            location: { path: "$.headers.age" },
            safeSummary: "Header value differs",
          }),
        ],
        totalItems: 3,
      }),
    )

    renderTab({ projectId: "p1", apiId: "a1" })

    fireEvent.click(await screen.findByText("Ignore fields"))

    expect(
      screen.getByLabelText("Select $.StartTime to ignore"),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
  })

  it("Select all selects only the ignorable findings on the page, and Ignore selected (N) reflects the count", async () => {
    stubFetch(
      makeResult({
        items: [
          makeBodyFinding({ findingId: "f-1", location: { path: "$.StartTime" } }),
          makeBodyFinding({ findingId: "f-2", location: { path: "$.EndTime" } }),
          makeFinding({
            findingId: "f-status",
            component: "HTTP_STATUS",
            location: null,
            safeSummary: "Status code differs",
          }),
        ],
        totalItems: 3,
      }),
    )

    renderTab({ projectId: "p1", apiId: "a1" })

    fireEvent.click(await screen.findByText("Ignore fields"))

    expect(screen.getByText("Ignore selected (0)")).toBeDisabled()

    fireEvent.click(screen.getByText("Select all"))

    expect(screen.getByText("Ignore selected (2)")).not.toBeDisabled()
    expect(
      (screen.getByLabelText("Select $.StartTime to ignore") as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(
      (screen.getByLabelText("Select $.EndTime to ignore") as HTMLInputElement)
        .checked,
    ).toBe(true)

    fireEvent.click(screen.getByText("Deselect all"))
    expect(screen.getByText("Ignore selected (0)")).toBeDisabled()
  })

  it("Cancel exits selection mode and clears the selection", async () => {
    stubFetch(makeResult({ items: [makeBodyFinding()], totalItems: 1 }))

    renderTab({ projectId: "p1", apiId: "a1" })

    fireEvent.click(await screen.findByText("Ignore fields"))
    fireEvent.click(screen.getByLabelText("Select $.StartTime to ignore"))
    expect(screen.getByText("Ignore selected (1)")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Cancel"))

    expect(screen.queryByText("Ignore selected (1)")).not.toBeInTheDocument()
    expect(screen.getByText("Ignore fields")).toBeInTheDocument()
  })

  it("clicking Ignore selected opens a single confirmation dialog for the whole selection", async () => {
    stubFetch(
      makeResult({
        items: [
          makeBodyFinding({ findingId: "f-1", location: { path: "$.StartTime" } }),
          makeBodyFinding({ findingId: "f-2", location: { path: "$.EndTime" } }),
        ],
        totalItems: 2,
      }),
    )

    renderTab({ projectId: "p1", apiId: "a1" })

    fireEvent.click(await screen.findByText("Ignore fields"))
    fireEvent.click(screen.getByText("Select all"))
    fireEvent.click(screen.getByText("Ignore selected (2)"))

    expect(await screen.findByText("Ignore 2 fields")).toBeInTheDocument()
    expect(
      screen.getByText("Apply these Ignore Rules to:"),
    ).toBeInTheDocument()
    // One occurrence in the underlying finding card's location line, one in
    // the dialog's selected-paths list — confirms a single dialog covers the
    // whole selection rather than one dialog per field.
    expect(screen.getAllByText("$.StartTime")).toHaveLength(2)
    expect(screen.getAllByText("$.EndTime")).toHaveLength(2)
  })

  it("a successful bulk create exits selection mode and shows the created-rules feedback message", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url)
      if (s.includes("/ignore-rules/bulk")) {
        return Promise.resolve(
          mockJsonResponse(201, {
            created: [{ ignoreRuleId: "r1" }],
            skippedCount: 0,
          }),
        )
      }
      if (s.includes("/findings")) {
        return Promise.resolve(
          mockJsonResponse(
            200,
            makeResult({ items: [makeBodyFinding()], totalItems: 1 }),
          ),
        )
      }
      void init
      return Promise.resolve(mockJsonResponse(404, {}))
    })
    vi.stubGlobal("fetch", fetchMock)

    renderTab({ projectId: "p1", apiId: "a1" })

    fireEvent.click(await screen.findByText("Ignore fields"))
    fireEvent.click(screen.getByLabelText("Select $.StartTime to ignore"))
    fireEvent.click(screen.getByText("Ignore selected (1)"))

    await screen.findByText("Ignore 1 field")
    fireEvent.click(screen.getByText("Confirm"))

    expect(
      await screen.findByText("Created 1 Ignore Rule."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Ignore 1 field")).not.toBeInTheDocument()
    expect(screen.getByText("Ignore fields")).toBeInTheDocument()
  })
})
