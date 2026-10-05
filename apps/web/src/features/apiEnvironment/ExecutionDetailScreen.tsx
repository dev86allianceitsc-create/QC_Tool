import { useState } from "react"

import { useExecutionDetail } from "./useExecutionDetail"

import { ExecutionResultView } from "./ExecutionResultView"

import { Button } from "../../components/ui/Button"

import { ApiError } from "../../services/api-client"

import { rerunExecution } from "./run.api"

const UNFINISHED_STATUSES = new Set(["PENDING", "RUNNING"])

// UI-RUN-05 standalone Execution Detail screen, reached from Run Result's

// per-execution "View" link. Same ExecutionResultView the Single Run Execute

// step uses inline (REQ-SEC-002 — only the backend's own redacted trace is

// ever shown). "Run Again" (auto-chains to the latest baseline) lives on the

// Run History tab's Test Case card — this screen instead offers the

// advanced "Re-run this execution" action (Phase 3 §5), which forces the

// comparison baseline back to THIS specific execution rather than the

// latest one. Only offered once the execution has reached a terminal

// status — nothing to replay while still PENDING/RUNNING.

export function ExecutionDetailScreen({
  projectId,

  runId,

  executionId,

  accessToken,

  onBack,

  onViewSnapshot,

  onViewComparison,

  onRerunComplete,

  onSessionExpired,

  onAccessDenied,
}: {
  projectId: string

  runId: string

  executionId: string

  accessToken: string | null

  onBack: () => void

  onViewSnapshot?: (snapshotId: string) => void

  onViewComparison?: (comparisonId: string) => void

  onRerunComplete?: (runId: string, executionId: string) => void

  onSessionExpired: () => void

  onAccessDenied: () => void
}) {
  const { execution, executionDetail, loading, timedOut, error, refetch } =
    useExecutionDetail(
      projectId,

      runId,

      executionId,

      accessToken,

      onSessionExpired,

      onAccessDenied,
    )

  const [rerunning, setRerunning] = useState(false)
  const [rerunError, setRerunError] = useState<string | null>(null)

  async function handleRerun() {
    if (!execution || !accessToken) return

    setRerunning(true)
    setRerunError(null)
    try {
      const result = await rerunExecution(
        projectId,
        execution.apiId,
        executionId,
        accessToken,
      )
      const newExecution = result.executions[0]
      if (newExecution && onRerunComplete) {
        onRerunComplete(result.runId, newExecution.executionId)
      }
    } catch (err) {
      setRerunError(
        err instanceof ApiError
          ? err.message
          : "Unable to re-run this execution.",
      )
    } finally {
      setRerunning(false)
    }
  }

  const canRerun =
    !!execution && !UNFINISHED_STATUSES.has(execution.executionStatus)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <button
            onClick={onBack}
            className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline"
          >
            Back
          </button>
          <h2 className="m-0 mt-1 text-lg font-semibold text-gray-900">
            Execution Detail
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {canRerun && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRerun}
              disabled={rerunning}
            >
              {rerunning ? "Re-running…" : "Re-run this execution"}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-5">
        {rerunError && (
          <p className="m-0 mb-3 text-xs text-error">{rerunError}</p>
        )}
        {loading && <p className="m-0 text-sm text-muted">Loading…</p>}
        {!loading && !execution && (
          <p className="m-0 text-sm text-muted">
            {error ?? "Execution not found."}
          </p>
        )}
        {!loading && execution && (
          <ExecutionResultView
            execution={execution}
            executionDetail={executionDetail}
            timedOut={timedOut}
            error={error}
            onViewSnapshot={onViewSnapshot}
            onViewComparison={onViewComparison}
          />
        )}
      </div>
    </div>
  )
}
