import { useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { tdClass, thClass, trHoverClass } from "../../components/ui/table"
import { ApiError } from "../../services/api-client"
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView"
import {
  getProcessingStatusDisplay,
  getResultDisplay,
  getTriggerKindLabel,
} from "./comparison-format.util"
import type { ComparisonDetailDto } from "./comparison.types"
import { useComparisonAttempts } from "./useComparisonAttempts"

// Retry only ever re-runs a terminal non-COMPLETED attempt (BLOCKED/FAILED —
// retryComparisonAttempt rejects COMPLETED with ALREADY_COMPLETED); COMPLETED
// has its own correct action (Re-evaluate, surfaced on the Detail screen's
// header), so Retry is intentionally not offered there.
const RETRYABLE_STATUSES = new Set(["BLOCKED", "FAILED"])

// Tab 4 of Comparison Detail (plan Flow 3/UI-CMP-03). Retry is shown whenever
// the Comparison's own processingStatus (which mirrors its latest attempt —
// comparison-query.service.ts's buildComparisonSummary) is terminal and
// non-COMPLETED — never hidden by mirroring the backend's 11-entry
// COMPARISON_ATTEMPT_RETRY_POLICY client-side (deviation #5); a rejected
// retry surfaces the server's 409 message instead of predicting rejection
// ahead of time.
export function ComparisonAttemptsTab({
  comparison,
  accessToken,
  onSessionExpired,
  onAccessDenied,
  onRetried,
}: {
  comparison: ComparisonDetailDto
  accessToken: string | null
  onSessionExpired: () => void
  onAccessDenied: () => void
  onRetried: () => void
}) {
  const {
    items,
    page,
    setPage,
    totalItems,
    hasMore,
    loading,
    error,
    refetch,
    retry,
  } = useComparisonAttempts(
    comparison.comparisonId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const canRetry = RETRYABLE_STATUSES.has(comparison.processingStatus)

  async function handleRetry() {
    setRetrying(true)
    setRetryError(null)
    try {
      await retry()
      setRetryError(null)
    } catch (err) {
      setRetryError(
        err instanceof ApiError
          ? err.message
          : "Unable to start a retry attempt.",
      )
    } finally {
      setRetrying(false)
      onRetried()
    }
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-xs font-semibold text-gray-900">
          Attempt history
        </h4>
        {canRetry && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? "Retrying..." : "Retry"}
          </Button>
        )}
      </div>

      {retryError && <p className="m-0 text-xs text-error">{retryError}</p>}

      {loading && <p className="m-0 text-sm text-muted">Loading…</p>}

      {!loading && error && (
        <div className="flex flex-col items-start gap-2">
          <p className="m-0 text-sm text-error">{error}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry loading
          </Button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="m-0 text-sm text-muted">No attempts recorded yet.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Attempt</th>
                  <th className={thClass}>Trigger</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Result</th>
                  <th className={thClass}>Stopped at</th>
                  <th className={thClass}>Reason</th>
                  <th className={thClass}>Started</th>
                  <th className={thClass}>Ended</th>
                </tr>
              </thead>
              <tbody>
                {items.map((attempt) => {
                  const statusDisplay = getProcessingStatusDisplay(
                    attempt.processingStatus,
                    attempt.reasonCode,
                  )
                  const resultDisplay = getResultDisplay(
                    attempt.processingStatus,
                    attempt.result,
                  )
                  return (
                    <tr
                      key={attempt.comparisonAttemptId}
                      className={trHoverClass}
                    >
                      <td className={tdClass}>#{attempt.attemptNumber}</td>
                      <td className={tdClass}>
                        {getTriggerKindLabel(attempt.triggerKind)}
                      </td>
                      <td className={tdClass}>
                        <Badge
                          tone={statusDisplay.tone}
                          label={statusDisplay.label}
                        />
                      </td>
                      <td className={tdClass}>
                        {resultDisplay ? (
                          <Badge
                            tone={resultDisplay.tone}
                            label={resultDisplay.label}
                          />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        {attempt.stoppedAtGate ?? (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        {attempt.reasonDetailSafe ?? (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        {attempt.startedAt ? (
                          formatTimestamp(attempt.startedAt)
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        {attempt.endedAt ? (
                          formatTimestamp(attempt.endedAt)
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {totalItems} attempt{totalItems === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <span className="text-xs text-muted">Page {page}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
