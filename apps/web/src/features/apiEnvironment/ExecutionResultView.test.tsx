import { fireEvent, render, screen } from "@testing-library/react"

import { describe, expect, it, vi } from "vitest"

import { ExecutionResultView } from "./ExecutionResultView"

import type { RunExecutionDetail, RunExecutionListItem } from "./run.types"

function makeExecution(
  overrides: Partial<RunExecutionListItem> = {},
): RunExecutionListItem {
  return {
    executionId: "exec-1",
    apiId: "api-1",
    executionOrder: 1,
    executionStatus: "COMPLETED",
    executionOutcome: "RESPONSE_RECEIVED",
    skipReasonCode: null,
    httpStatus: 200,
    apiVersion: "1.0.0",
    databaseVersion: "db-1.0",
    startedAt: "2026-09-01T00:00:00.000Z",
    endedAt: "2026-09-01T00:00:01.000Z",
    durationMs: 1000,
    testCaseKey: null,
    authType: null,
    rerunOfExecutionId: null,
    ...overrides,
  }
}

function makeExecutionDetail(
  overrides: Partial<RunExecutionDetail> = {},
): RunExecutionDetail {
  return {
    runId: "run-1",
    executionId: "exec-1",
    apiId: "api-1",
    environmentId: "env-1",
    executionOrder: 1,
    executionStatus: "COMPLETED",
    executionOutcome: "RESPONSE_RECEIVED",
    actualRequest: null,
    httpResponse: null,
    executionError: null,
    skipReason: null,
    apiVersion: "1.0.0",
    databaseVersion: "db-1.0",
    createdAt: "2026-09-01T00:00:00.000Z",
    startedAt: "2026-09-01T00:00:00.000Z",
    endedAt: "2026-09-01T00:00:01.000Z",
    durationMs: 1000,
    snapshotSave: null,
    comparisonAvailability: null,
    testCaseKey: null,
    authType: null,
    testAccountId: null,
    rerunOfExecutionId: null,
    ...overrides,
  }
}

function renderView(
  overrides: Partial<{
    execution: RunExecutionListItem
    executionDetail: RunExecutionDetail | null
    onViewSnapshot: (snapshotId: string) => void
    onViewComparison: (comparisonId: string) => void
  }> = {},
) {
  return render(
    <ExecutionResultView
      execution={overrides.execution ?? makeExecution()}
      executionDetail={
        "executionDetail" in overrides
          ? (overrides.executionDetail ?? null)
          : makeExecutionDetail()
      }
      onViewSnapshot={overrides.onViewSnapshot}
      onViewComparison={overrides.onViewComparison}
    />,
  )
}

describe("ExecutionResultView — ComparisonAvailabilityBlock (UI-CMP-05)", () => {
  it("renders no Comparison section when comparisonAvailability is null", () => {
    renderView({
      executionDetail: makeExecutionDetail({ comparisonAvailability: null }),
    })

    expect(
      screen.queryByRole("heading", { name: "Comparison" }),
    ).not.toBeInTheDocument()
  })

  it("renders no Comparison section when executionDetail itself is null (still pending)", () => {
    renderView({
      execution: makeExecution({
        executionStatus: "PENDING",
        executionOutcome: null,
      }),
      executionDetail: null,
    })

    expect(
      screen.queryByRole("heading", { name: "Comparison" }),
    ).not.toBeInTheDocument()
  })

  it("shows 'Comparison linked' with a View Comparison button wired to the comparisonId, taking precedence over a stale reasonCode", () => {
    const onViewComparison = vi.fn()
    renderView({
      executionDetail: makeExecutionDetail({
        comparisonAvailability: {
          comparisonId: "cmp-9",
          reasonCode: "NO_BASELINE",
          baselineSnapshotId: null,
        },
      }),
      onViewComparison,
    })

    expect(screen.getByText("Comparison linked")).toBeInTheDocument()
    expect(screen.queryByText("NO BASELINE")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "View Comparison" }))
    expect(onViewComparison).toHaveBeenCalledWith("cmp-9")
    expect(onViewComparison).toHaveBeenCalledTimes(1)
  })

  it("shows 'Comparison linked' without a button when onViewComparison isn't provided", () => {
    renderView({
      executionDetail: makeExecutionDetail({
        comparisonAvailability: {
          comparisonId: "cmp-9",
          reasonCode: null,
          baselineSnapshotId: null,
        },
      }),
    })

    expect(screen.getByText("Comparison linked")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "View Comparison" }),
    ).not.toBeInTheDocument()
  })

  it("shows the reasonCode and a View baseline Snapshot button when a baseline exists (AC-01)", () => {
    const onViewSnapshot = vi.fn()
    renderView({
      executionDetail: makeExecutionDetail({
        comparisonAvailability: {
          comparisonId: null,
          reasonCode: "BASELINE_INVALIDATED",
          baselineSnapshotId: "snap-1",
        },
      }),
      onViewSnapshot,
    })

    expect(screen.getByText("BASELINE INVALIDATED")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "View baseline Snapshot" }),
    )
    expect(onViewSnapshot).toHaveBeenCalledWith("snap-1")
    expect(onViewSnapshot).toHaveBeenCalledTimes(1)
  })

  it("shows the raw baselineSnapshotId as plain text when onViewSnapshot isn't provided", () => {
    renderView({
      executionDetail: makeExecutionDetail({
        comparisonAvailability: {
          comparisonId: null,
          reasonCode: "BASELINE_INVALIDATED",
          baselineSnapshotId: "snap-1",
        },
      }),
    })

    expect(screen.getByText("snap-1")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "View baseline Snapshot" }),
    ).not.toBeInTheDocument()
  })

  it("shows 'No baseline' — never a fabricated Comparison row — when reasonCode is NO_BASELINE (AC-01)", () => {
    renderView({
      executionDetail: makeExecutionDetail({
        comparisonAvailability: {
          comparisonId: null,
          reasonCode: "NO_BASELINE",
          baselineSnapshotId: null,
        },
      }),
    })

    expect(screen.getByText("NO BASELINE")).toBeInTheDocument()
    expect(screen.getByText("No baseline")).toBeInTheDocument()
    expect(screen.queryByText("Comparison linked")).not.toBeInTheDocument()
  })

  it("shows the 'Comparison pending' message when both comparisonId and reasonCode are null", () => {
    renderView({
      executionDetail: makeExecutionDetail({
        comparisonAvailability: {
          comparisonId: null,
          reasonCode: null,
          baselineSnapshotId: null,
        },
      }),
    })

    expect(
      screen.getByText(
        "Comparison pending — the Snapshot save hasn't caught up yet.",
      ),
    ).toBeInTheDocument()
  })
})
