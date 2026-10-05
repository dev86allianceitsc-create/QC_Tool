import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { RunHistoryArea } from "./RunHistoryArea"

import type { ApiRunExecutionListItem, RunDetail, TestCaseListItem } from "./run.types"

const TEST_CASE_1: TestCaseListItem = {
  testCaseKey: "tc1",
  apiId: "a1",
  environmentId: "e1",
  environmentName: "DEV",
  authType: "LOGIN_FORM",
  testAccountId: "ta1",
  testAccountLabel: "QA Tester",
  inputSummary: {
    pathValues: {},
    queryValues: {},
    headerValues: {},
    bodyValue: JSON.stringify({ UI_FirstID: "123456", UI_SecondID: "789" }),
  },
  lastRunAt: "2026-09-29T10:00:00.000Z",
  lastExecutionId: "ex1",
  lastResult: "DIFFERENT",
  runCount: 3,
  testCaseNumber: 1,
}

// Same Environment as TEST_CASE_1 on purpose — the regression this covers is
// two different Test Cases sharing an Environment looking like duplicated
// cards when Environment was the heading.
const TEST_CASE_2: TestCaseListItem = {
  testCaseKey: "tc2",
  apiId: "a1",
  environmentId: "e1",
  environmentName: "DEV",
  authType: "NONE",
  testAccountId: null,
  testAccountLabel: null,
  inputSummary: { pathValues: {}, queryValues: {}, headerValues: {}, bodyValue: "" },
  lastRunAt: "2026-09-30T10:00:00.000Z",
  lastExecutionId: "ex2",
  lastResult: "INITIAL_RUN",
  runCount: 1,
  testCaseNumber: 2,
}

// Seven Query fields on purpose — exercises the Request Input row cap
// (MAX_CARD_INPUT_FIELDS = 5) and the "+ N more" overflow indicator.
const TEST_CASE_3: TestCaseListItem = {
  testCaseKey: "tc3",
  apiId: "a1",
  environmentId: "e1",
  environmentName: "DEV",
  authType: "NONE",
  testAccountId: null,
  testAccountLabel: null,
  inputSummary: {
    pathValues: {},
    queryValues: {
      field1: "a",
      field2: "b",
      field3: "c",
      field4: "d",
      field5: "e",
      field6: "f",
      field7: "g",
    },
    headerValues: {},
    bodyValue: "",
  },
  lastRunAt: "2026-09-28T10:00:00.000Z",
  lastExecutionId: "ex4",
  lastResult: "INITIAL_RUN",
  runCount: 1,
  testCaseNumber: 3,
}

const RUN_AGAIN_RESULT: RunDetail = {
  runId: "r2",
  projectId: "p1",
  environmentId: "e1",
  createdBy: "admin@example.com",
  runType: "SINGLE",
  runStatus: "COMPLETED",
  createdAt: "2026-10-01T10:00:00.000Z",
  startedAt: "2026-10-01T10:00:00.000Z",
  endedAt: "2026-10-01T10:00:01.000Z",
  note: null,
  summary: {
    totalApis: 1,
    responseReceivedCount: 1,
    runErrorCount: 0,
    skippedCount: 0,
    unfinishedCount: 0,
  },
  testAccountId: "ta1",
  executions: [
    {
      executionId: "ex3",
      apiId: "a1",
      executionOrder: 1,
      executionStatus: "COMPLETED",
      executionOutcome: "RESPONSE_RECEIVED",
      skipReasonCode: null,
      httpStatus: 200,
      apiVersion: "v1",
      databaseVersion: "v1",
      startedAt: "2026-10-01T10:00:00.000Z",
      endedAt: "2026-10-01T10:00:01.000Z",
      durationMs: 100,
      testCaseKey: "tc1",
      authType: "LOGIN_FORM",
      rerunOfExecutionId: null,
    },
  ],
}

// Regression fixture for "View Differences" — a comparable (DIFFERENT) row
// must carry its sourced comparisonId so the drill-down can open the
// Comparison page directly instead of falling back to Execution Detail.
const EXECUTION_DIFFERENT: ApiRunExecutionListItem = {
  runId: "r1",
  executionId: "ex1",
  runType: "SINGLE",
  environmentId: "e1",
  executionStatus: "COMPLETED",
  executionOutcome: "RESPONSE_RECEIVED",
  httpStatus: 200,
  apiVersion: "v1",
  databaseVersion: "v1",
  createdAt: "2026-10-02T10:00:00.000Z",
  testCaseKey: "tc1",
  authType: "LOGIN_FORM",
  testAccountId: "ta1",
  rerunOfExecutionId: null,
  comparisonResult: "DIFFERENT",
  comparedWithAt: "2026-09-29T10:00:00.000Z",
  comparisonId: "cmp-1",
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(
  testCases: TestCaseListItem[] = [TEST_CASE_1, TEST_CASE_2],
  refetchTestCases?: TestCaseListItem[],
  executionItems: ApiRunExecutionListItem[] = [],
) {
  let testCasesCallCount = 0

  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/test-cases")) {
      testCasesCallCount += 1
      const body = testCasesCallCount > 1 && refetchTestCases ? refetchTestCases : testCases
      return Promise.resolve(mockJsonResponse(200, body))
    }

    if (url.includes("/run-again")) {
      return Promise.resolve(mockJsonResponse(200, RUN_AGAIN_RESULT))
    }

    if (
      url.includes("/run-executions") &&
      (!init || init.method === undefined || init.method === "GET")
    ) {
      return Promise.resolve(
        mockJsonResponse(200, {
          items: executionItems,
          page: 1,
          pageSize: 20,
          totalItems: executionItems.length,
          totalPages: 1,
        }),
      )
    }

    return Promise.resolve(mockJsonResponse(404, {}))
  })

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function renderArea(overrides: Partial<Parameters<typeof RunHistoryArea>[0]> = {}) {
  const onViewExecution = vi.fn()
  const onViewComparison = vi.fn()
  const onViewAllRuns = vi.fn()

  render(
    <RunHistoryArea
      projectId="p1"
      apiId="a1"
      accessToken="token-1"
      onViewExecution={onViewExecution}
      onViewComparison={onViewComparison}
      onViewAllRuns={onViewAllRuns}
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
      {...overrides}
    />,
  )

  return { onViewExecution, onViewComparison, onViewAllRuns }
}

function cardFor(headingText: string) {
  return screen.getByText(headingText).closest(".rounded-lg") as HTMLElement
}

describe("RunHistoryArea — Test Case cards represent a Test Case, not an Environment", () => {
  it("labels each card 'Test Case N' instead of the Environment name", async () => {
    stubFetch()

    renderArea()

    expect(await screen.findByText("Test Case 1")).toBeInTheDocument()
    expect(screen.getByText("Test Case 2")).toBeInTheDocument()

    // "DEV" still appears — both cards share that Environment — but only as
    // secondary identifying text underneath each heading, never as the
    // heading itself (the two "Test Case N" headings asserted above).
    const devMatches = screen.getAllByText("DEV")
    expect(devMatches).toHaveLength(2)
    for (const match of devMatches) {
      expect(match.closest("span.text-sm.font-semibold")).toBeNull()
    }
  })

  it("shows Environment, Account, Request Input summary, Last run, and Run count underneath the heading", async () => {
    stubFetch()

    renderArea()

    await screen.findByText("Test Case 1")

    const card = cardFor("Test Case 1")

    expect(card.textContent).toContain("Environment: DEV")
    expect(card.textContent).toContain("LOGIN FORM · QA Tester")
    expect(within(card).getByText(/Last run/)).toBeInTheDocument()
    expect(within(card).getByText("3 runs")).toBeInTheDocument()
  })

  it("renders a labeled Request Input section with one row per field instead of raw JSON", async () => {
    stubFetch()

    renderArea()

    await screen.findByText("Test Case 1")

    const card = within(cardFor("Test Case 1"))

    expect(card.getByText("Request Input")).toBeInTheDocument()
    expect(card.getByText("UI_FirstID")).toBeInTheDocument()
    expect(card.getByText("123456")).toBeInTheDocument()
    expect(card.getByText("UI_SecondID")).toBeInTheDocument()
    expect(card.getByText("789")).toBeInTheDocument()
    expect(card.queryByText(/\{"UI_FirstID"/)).not.toBeInTheDocument()
    expect(card.queryByText("UI_FirstID=123456, UI_SecondID=789")).not.toBeInTheDocument()
  })

  it("shows 'No input parameters.' under the Request Input label when a Test Case has none", async () => {
    stubFetch()

    renderArea()

    await screen.findByText("Test Case 2")

    const card = within(cardFor("Test Case 2"))

    expect(card.getByText("Request Input")).toBeInTheDocument()
    expect(card.getByText("No input parameters.")).toBeInTheDocument()
  })

  it("caps Request Input rows at 5 and shows a '+ N more' indicator for the rest", async () => {
    stubFetch([TEST_CASE_3])

    renderArea()

    await screen.findByText("Test Case 3")

    const card = within(cardFor("Test Case 3"))

    expect(card.getByText("field1")).toBeInTheDocument()
    expect(card.getByText("field5")).toBeInTheDocument()
    expect(card.queryByText("field6")).not.toBeInTheDocument()
    expect(card.queryByText("field7")).not.toBeInTheDocument()
    expect(card.getByText("+ 2 more")).toBeInTheDocument()
  })

  it("keeps Run Again wired to the same action after the card redesign", async () => {
    const fetchMock = stubFetch()

    const { onViewExecution } = renderArea()

    await screen.findByText("Test Case 1")

    const card = within(cardFor("Test Case 1"))

    fireEvent.click(card.getByText("Run Again"))

    await screen.findByText(/Running/)

    const runAgainCall = fetchMock.mock.calls.find((call: any[]) =>
      String(call[0]).includes("/run-executions/ex1/run-again"),
    )

    expect(runAgainCall).toBeTruthy()

    await screen.findByText("Test Case 1")

    expect(onViewExecution).toHaveBeenCalledWith("r2", "ex3")
  })

  it("keeps View History wired to the drill-down after the card redesign", async () => {
    stubFetch()

    renderArea()

    await screen.findByText("Test Case 1")

    const card = within(cardFor("Test Case 1"))

    fireEvent.click(card.getByText("View History"))

    expect(
      await screen.findByText("Chronological history for this Test Case."),
    ).toBeInTheDocument()
  })

  // Regression for the manual-testing bug report: clicking Run Again on a
  // card reorders the list (the acted-on card becomes most-recently-run and
  // moves to the front), but each card's "Test Case N" label is the
  // backend's stable testCaseNumber, not this component's old array-index
  // label — so the label must stay attached to the same logical Test Case
  // through that reorder, and the OTHER card's run count must not move.
  it("keeps 'Test Case N' labels attached to the same Test Case after Run Again reorders the list", async () => {
    const testCase2AfterRunAgain: TestCaseListItem = {
      ...TEST_CASE_2,
      lastRunAt: "2026-10-02T10:00:00.000Z",
      lastExecutionId: "ex3",
      runCount: 2,
    }
    // Refetch returns the acted-on card (testCaseNumber 2) first, since it
    // is now the most recently run — exactly the reorder the bug report
    // described.
    stubFetch([TEST_CASE_1, TEST_CASE_2], [testCase2AfterRunAgain, TEST_CASE_1])

    renderArea()

    await screen.findByText("Test Case 1")

    const card2Before = within(cardFor("Test Case 2"))
    expect(card2Before.getByText("1 run")).toBeInTheDocument()

    fireEvent.click(card2Before.getByText("Run Again"))

    await screen.findByText(/Running/)

    await waitFor(() => {
      expect(within(cardFor("Test Case 2")).getByText("2 runs")).toBeInTheDocument()
    })

    // TEST_CASE_1 was never touched — it must still read "Test Case 1" with
    // its original run count, not have absorbed Test Case 2's increment.
    expect(within(cardFor("Test Case 1")).getByText("3 runs")).toBeInTheDocument()
  })

  // Regression: "View Differences" on a comparable row must open the
  // Comparison page it actually sourced, not the execution's own detail
  // page — before comparisonId was threaded through, this button always
  // fell back to onViewExecution regardless of comparisonResult.
  it("opens the Comparison page (not Execution Detail) when 'View Differences' is clicked on a comparable row", async () => {
    stubFetch([TEST_CASE_1, TEST_CASE_2], undefined, [EXECUTION_DIFFERENT])

    const { onViewExecution, onViewComparison } = renderArea()

    await screen.findByText("Test Case 1")

    fireEvent.click(within(cardFor("Test Case 1")).getByText("View History"))

    const viewDifferencesButton = await screen.findByText("View Differences")

    fireEvent.click(viewDifferencesButton)

    expect(onViewComparison).toHaveBeenCalledWith("cmp-1")
    expect(onViewComparison).toHaveBeenCalledTimes(1)
    expect(onViewExecution).not.toHaveBeenCalled()
  })
})
