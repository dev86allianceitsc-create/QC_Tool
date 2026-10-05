import { useState } from "react"

import { ApiError } from "../../services/api-client"

import { Badge } from "../../components/ui/Badge"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

import { thClass, tdClass, trHoverClass } from "../../components/ui/table"

import { formatCode, formatTimestamp } from "./ExecutionResultView"

import {
  getInputSummaryFields,
  getTestCaseResultDisplay,
} from "./test-case-format.util"

import { useApiRunHistory } from "./useApiRunHistory"

import { useTestCases } from "./useTestCases"

import type { TestCaseListItem } from "./run.types"

// A Test Case card shows only its first few Request Input fields, with the
// rest collapsed behind "+ N more" — keeps the card scannable for APIs with
// many parameters. The full set remains visible in the Execution Detail
// drill-through.
const MAX_CARD_INPUT_FIELDS = 5

// UI-RUN-08 Run History, redesigned for Phase 3 Test Case History & Run
// Again (§8). Default view is one card per distinct Test Case (testCaseKey)
// for this API — "one row per test case ever run," not a page of raw
// executions. "View History" drills into that one Test Case's chronological
// execution list (the previous flat-table view, now scoped to a single
// testCaseKey instead of showing every execution for the API at once).
export function RunHistoryArea({
  projectId,

  apiId,

  accessToken,

  onViewExecution,

  onViewComparison,

  onViewAllRuns,

  onSessionExpired,

  onAccessDenied,
}: {
  projectId: string

  apiId: string

  accessToken: string | null

  onViewExecution: (runId: string, executionId: string) => void

  onViewComparison?: (comparisonId: string) => void

  onViewAllRuns: () => void

  onSessionExpired: () => void

  onAccessDenied: () => void
}) {
  const [selectedTestCaseKey, setSelectedTestCaseKey] = useState<
    string | null
  >(null)

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0 mb-1 text-base font-semibold text-gray-900">
            Run History
          </h3>
          <p className="m-0 text-xs text-muted">
            {selectedTestCaseKey
              ? "Chronological history for this Test Case."
              : "One card per Test Case previously run against this API."}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAllRuns}>
          All Test Runs →
        </Button>
      </div>

      {selectedTestCaseKey ? (
        <TestCaseHistoryDrillDown
          projectId={projectId}
          apiId={apiId}
          accessToken={accessToken}
          testCaseKey={selectedTestCaseKey}
          onViewExecution={onViewExecution}
          onViewComparison={onViewComparison}
          onBack={() => setSelectedTestCaseKey(null)}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
        />
      ) : (
        <TestCaseCardsView
          projectId={projectId}
          apiId={apiId}
          accessToken={accessToken}
          onViewExecution={onViewExecution}
          onViewHistory={setSelectedTestCaseKey}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
        />
      )}
    </div>
  )
}

function TestCaseCardsView({
  projectId,
  apiId,
  accessToken,
  onViewExecution,
  onViewHistory,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string
  apiId: string
  accessToken: string | null
  onViewExecution: (runId: string, executionId: string) => void
  onViewHistory: (testCaseKey: string) => void
  onSessionExpired: () => void
  onAccessDenied: () => void
}) {
  const { items, loading, error, refetch, runTestCaseAgain } = useTestCases(
    projectId,
    apiId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [runAgainError, setRunAgainError] = useState<string | null>(null)

  async function handleRunAgain(item: TestCaseListItem) {
    setRunningKey(item.testCaseKey)
    setRunAgainError(null)
    try {
      const result = await runTestCaseAgain(item.lastExecutionId)
      const newExecution = result.executions[0]
      if (newExecution) {
        onViewExecution(result.runId, newExecution.executionId)
      }
    } catch (err) {
      setRunAgainError(
        err instanceof ApiError ? err.message : "Unable to run this Test Case again.",
      )
    } finally {
      setRunningKey(null)
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-end">
          <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
        </div>

        {runAgainError && <p className="m-0 text-xs text-error">{runAgainError}</p>}

        {loading && <p className="m-0 text-sm text-muted">Loading…</p>}

        {!loading && error && (
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="m-0 text-sm text-muted">
            No Test Case history yet for this API — run it once from Run API
            to start one.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const resultDisplay = getTestCaseResultDisplay(item.lastResult)
              const isRunning = runningKey === item.testCaseKey
              const inputFields = getInputSummaryFields(item.inputSummary)
              const visibleInputFields = inputFields.slice(
                0,
                MAX_CARD_INPUT_FIELDS,
              )
              const hiddenInputFieldCount =
                inputFields.length - visibleInputFields.length

              return (
                <div
                  key={item.testCaseKey}
                  className="flex flex-col gap-2 rounded-lg border border-border p-4"
                >
                  {/* The card represents a Test Case (API + Environment + Auth +
                  Test Account + Request Input), not just an Environment — two
                  different Test Cases can share the same Environment, so
                  Environment is identifying detail below, never the heading.
                  "Test Case N" renders the backend's stable testCaseNumber
                  (ranked by first-ever run), never the array index — this
                  list is sorted most-recently-run first, so index position
                  shifts on every Run Again while the number must not. */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      Test Case {item.testCaseNumber}
                    </span>
                    <Badge tone={resultDisplay.tone} label={resultDisplay.label} />
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-muted">
                    <span>
                      <span className="text-gray-700">Environment:</span>{" "}
                      {item.environmentName}
                    </span>
                    <span>
                      <span className="text-gray-700">Auth:</span>{" "}
                      {item.authType ? formatCode(item.authType) : "No auth"}
                      {item.testAccountLabel && ` · ${item.testAccountLabel}`}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-gray-700">
                      Request Input
                    </span>

                    {visibleInputFields.length === 0 ? (
                      <span className="text-xs text-muted">
                        No input parameters.
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {visibleInputFields.map((field, fieldIndex) => (
                          <div
                            key={`${field.key}-${fieldIndex}`}
                            className="flex items-baseline justify-between gap-2 text-xs"
                          >
                            <span className="shrink-0 font-mono text-gray-700">
                              {field.key}
                            </span>
                            <span className="truncate font-mono text-muted">
                              {field.value}
                            </span>
                          </div>
                        ))}
                        {hiddenInputFieldCount > 0 && (
                          <span className="text-[11px] text-muted">
                            + {hiddenInputFieldCount} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Last run {formatTimestamp(item.lastRunAt)}</span>
                    <span>
                      {item.runCount} run{item.runCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleRunAgain(item)}
                      disabled={isRunning}
                    >
                      {isRunning ? "Running…" : "Run Again"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onViewHistory(item.testCaseKey)}
                    >
                      View History
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

function TestCaseHistoryDrillDown({
  projectId,
  apiId,
  accessToken,
  testCaseKey,
  onViewExecution,
  onViewComparison,
  onBack,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string
  apiId: string
  accessToken: string | null
  testCaseKey: string
  onViewExecution: (runId: string, executionId: string) => void
  onViewComparison?: (comparisonId: string) => void
  onBack: () => void
  onSessionExpired: () => void
  onAccessDenied: () => void
}) {
  const { page, setPage, items, totalItems, totalPages, loading, error, refetch } =
    useApiRunHistory(
      projectId,
      apiId,
      accessToken,
      onSessionExpired,
      onAccessDenied,
      testCaseKey,
    )

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back to Test Cases
          </Button>
          <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading && <p className="m-0 text-sm text-muted">Loading…</p>}

        {!loading && error && (
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="m-0 text-sm text-muted">No executions found.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>Timestamp</th>
                    <th className={thClass}>Result</th>
                    <th className={thClass}>Compared with</th>
                    <th className={thClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const resultDisplay = getTestCaseResultDisplay(
                      item.comparisonResult,
                    )
                    const isComparable =
                      item.comparisonResult === "SAME" ||
                      item.comparisonResult === "DIFFERENT"

                    return (
                      <tr key={item.executionId} className={trHoverClass}>
                        <td className={tdClass}>
                          {formatTimestamp(item.createdAt)}
                        </td>
                        <td className={tdClass}>
                          <Badge
                            tone={resultDisplay.tone}
                            label={resultDisplay.label}
                          />
                        </td>
                        <td className={tdClass}>
                          {item.comparedWithAt ? (
                            formatTimestamp(item.comparedWithAt)
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className={tdClass}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              isComparable && item.comparisonId && onViewComparison
                                ? onViewComparison(item.comparisonId)
                                : onViewExecution(item.runId, item.executionId)
                            }
                          >
                            {isComparable ? "View Differences" : "View"}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{totalItems} total</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </Button>
                <span className="text-xs text-muted">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
