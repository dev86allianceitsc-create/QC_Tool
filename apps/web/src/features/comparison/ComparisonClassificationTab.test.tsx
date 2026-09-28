import { fireEvent, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { ComparisonClassificationTab } from "./ComparisonClassificationTab"

import type {
  ClassificationEventItemDto,
  ComparisonDetailDto,
  ComparisonPagedResult,
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
    processingStatus: "COMPLETED",
    stoppedAtGate: null,
    reasonCode: null,
    reasonDetailSafe: null,
    inputCheckOutcome: null,
    result: "DIFFERENT",
    outputDifferenceCount: 1,
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

function makeEvent(
  overrides: Partial<ClassificationEventItemDto> = {},
): ClassificationEventItemDto {
  return {
    classificationEventId: "evt-1",
    revision: 1,
    classification: "EXPECTED",
    note: null,
    classifiedBy: "alice",
    classifiedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeList(
  overrides: Partial<ComparisonPagedResult<ClassificationEventItemDto>> = {},
): ComparisonPagedResult<ClassificationEventItemDto> {
  return {
    items: [],
    page: 1,
    pageSize: 20,
    totalItems: 0,
    hasMore: false,
    ...overrides,
  }
}

const CONFLICT_BODY = {
  errorCode: "REVISION_CONFLICT",
  message: "The classification has changed since you loaded it.",
  details: [],
  requestId: "r1",
}

const INTERNAL_ERROR_BODY = {
  errorCode: "INTERNAL_ERROR",
  message: "Unable to save classification right now.",
  details: [],
  requestId: "r1",
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubFetch(
  options: {
    list?: ComparisonPagedResult<ClassificationEventItemDto> | (() => ComparisonPagedResult<ClassificationEventItemDto>)
    createResponse?: { status: number; body: unknown }
  } = {},
) {
  const fetchMock = vi
    .fn()
    .mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes("/classification-events")) {
        const method = init?.method ?? "GET"
        if (method === "POST") {
          const resp =
            options.createResponse ??
            { status: 200, body: makeEvent() } as {
              status: number
              body: unknown
            }
          return Promise.resolve(mockJsonResponse(resp.status, resp.body))
        }
        const body =
          typeof options.list === "function"
            ? options.list()
            : (options.list ?? makeList())
        return Promise.resolve(mockJsonResponse(200, { ...body }))
      }
      return Promise.resolve(mockJsonResponse(404, {}))
    })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderTab(
  overrides: Partial<{
    comparison: ComparisonDetailDto
    onSessionExpired: () => void
    onAccessDenied: () => void
    onClassified: () => void
  }> = {},
) {
  return render(
    <ComparisonClassificationTab
      comparison={overrides.comparison ?? makeDetail()}
      accessToken="token-1"
      onSessionExpired={overrides.onSessionExpired ?? vi.fn()}
      onAccessDenied={overrides.onAccessDenied ?? vi.fn()}
      onClassified={overrides.onClassified ?? vi.fn()}
    />,
  )
}

describe("ComparisonClassificationTab", () => {
  it("shows 'Not marked' and hides the classify control when result isn't DIFFERENT", async () => {
    stubFetch()

    renderTab({
      comparison: makeDetail({ result: "SAME", classification: null }),
    })

    expect(await screen.findByText("Not marked")).toBeInTheDocument()
    expect(
      screen.queryByText("Classify this difference"),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
  })

  it("shows the classify control with both options only when result is DIFFERENT", async () => {
    stubFetch()

    renderTab({ comparison: makeDetail({ result: "DIFFERENT" }) })

    expect(
      await screen.findByText("Classify this difference"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: "Classification" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Expected" })).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: "Unexpected" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Save classification" }),
    ).toBeDisabled()
  })

  it("shows classifiedBy/classifiedAt beside the current classification badge when present", async () => {
    stubFetch()

    renderTab({
      comparison: makeDetail({
        result: "SAME",
        classification: "EXPECTED",
        classifiedBy: "alice",
        classifiedAt: "2026-09-01T00:00:00.000Z",
      }),
    })

    expect(await screen.findByText("Expected")).toBeInTheDocument()
    expect(screen.getByText(/by alice/)).toBeInTheDocument()
  })

  it("submits with the comparison's current revision, resets the form, and notifies the parent", async () => {
    const onClassified = vi.fn()
    const fetchMock = stubFetch({
      createResponse: {
        status: 200,
        body: makeEvent({ classification: "UNEXPECTED" }),
      },
    })

    renderTab({
      comparison: makeDetail({
        result: "DIFFERENT",
        classificationRevision: 3,
      }),
      onClassified,
    })

    await screen.findByText("Classify this difference")
    fireEvent.click(screen.getByRole("radio", { name: "Unexpected" }))
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "Known change." },
    })

    fetchMock.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Save classification" }))

    await screen.findByRole("button", { name: "Save classification" })

    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    )
    expect(postCall).toBeDefined()
    const sentBody = JSON.parse((postCall![1] as RequestInit).body as string)
    expect(sentBody).toEqual({
      classification: "UNEXPECTED",
      note: "Known change.",
      expectedRevision: 3,
    })

    expect(onClassified).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("radio", { name: "Unexpected" })).not.toBeChecked()
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("")
    expect(
      screen.getByRole("button", { name: "Save classification" }),
    ).toBeDisabled()
  })

  it("on a 409 REVISION_CONFLICT, clears the pending selection/note and requires an explicit re-submit (AC-09)", async () => {
    const onClassified = vi.fn()
    stubFetch({ createResponse: { status: 409, body: CONFLICT_BODY } })

    renderTab({
      comparison: makeDetail({
        result: "DIFFERENT",
        classificationRevision: 3,
      }),
      onClassified,
    })

    await screen.findByText("Classify this difference")
    fireEvent.click(screen.getByRole("radio", { name: "Expected" }))
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "My note." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save classification" }))

    expect(
      await screen.findByText(
        "The classification has changed since you loaded it.",
      ),
    ).toBeInTheDocument()

    // The pending choice is cleared, not silently resubmitted — the user must
    // look at the refreshed current value and explicitly choose again.
    expect(screen.getByRole("radio", { name: "Expected" })).not.toBeChecked()
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("")
    expect(
      screen.getByRole("button", { name: "Save classification" }),
    ).toBeDisabled()
    expect(onClassified).toHaveBeenCalledTimes(1)
  })

  it("keeps the pending selection and note after a non-conflict error, instead of silently clearing it", async () => {
    stubFetch({ createResponse: { status: 500, body: INTERNAL_ERROR_BODY } })

    renderTab({
      comparison: makeDetail({
        result: "DIFFERENT",
        classificationRevision: 1,
      }),
    })

    await screen.findByText("Classify this difference")
    fireEvent.click(screen.getByRole("radio", { name: "Expected" }))
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "My note." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save classification" }))

    expect(
      await screen.findByText("Unable to save classification right now."),
    ).toBeInTheDocument()

    expect(screen.getByRole("radio", { name: "Expected" })).toBeChecked()
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("My note.")
    expect(
      screen.getByRole("button", { name: "Save classification" }),
    ).not.toBeDisabled()
  })

  it("shows 'No classification events recorded yet.' when the history is empty", async () => {
    stubFetch({ list: makeList() })

    renderTab()

    expect(
      await screen.findByText("No classification events recorded yet."),
    ).toBeInTheDocument()
  })

  it("renders classification history rows and pages with Prev/Next", async () => {
    const fetchMock = stubFetch({
      list: () =>
        makeList({
          items: [makeEvent({ revision: 1, note: "First note" })],
          totalItems: 25,
          hasMore: true,
        }),
    })

    renderTab()

    expect(await screen.findByText("#1")).toBeInTheDocument()
    expect(screen.getByText("First note")).toBeInTheDocument()
    expect(screen.getByText("alice")).toBeInTheDocument()
    expect(screen.getByText("25 events")).toBeInTheDocument()
    expect(screen.getByText("Page 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled()

    fetchMock.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    await screen.findByText("Page 2")
    const listCalls = fetchMock.mock.calls.filter(
      (c) =>
        String(c[0]).includes("/classification-events") &&
        (c[1] as RequestInit | undefined)?.method !== "POST",
    )
    expect(listCalls.length).toBeGreaterThan(0)
    expect(String(listCalls[0]?.[0])).toContain("page=2")
  })

  it("shows an error with a Retry button for the history list, and Retry re-fetches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(500, {
          errorCode: "INTERNAL_ERROR",
          message: "Unable to load classification history.",
          details: [],
          requestId: "r1",
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          200,
          makeList({ items: [makeEvent()], totalItems: 1 }),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    renderTab()

    expect(
      await screen.findByText("Unable to load classification history."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("#1")).toBeInTheDocument()
  })
})
