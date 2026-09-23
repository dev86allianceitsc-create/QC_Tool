import { useMemo } from "react";
import { OUTCOME_TONE, STATUS_TONE, formatCode, formatTimestamp } from "./ExecutionResultView";
import { useApiList } from "./useApiList";
import { useRunPolling } from "./useRunPolling";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";

const UNFINISHED_RUN_STATUSES = new Set(["PENDING", "RUNNING"]);

// UI-RUN-06 Run Result — reached from Batch Run Preparation's Execute action
// and from Project Test Runs (UI-RUN-07). Reuses ExecutionResultView's status/outcome
// vocabulary so this screen and the per-execution detail never drift apart.
// Method/Path/Name per row come from a live API List join (Map by apiId), not
// from the execution record itself — an API can be deleted after a Run, so
// unresolved apiIds fall back to "(deleted API)" rather than breaking the row.
export function RunResultScreen({
  projectId,
  runId,
  accessToken,
  onBack,
  onViewAllRuns,
  onViewExecution,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string;
  runId: string;
  accessToken: string | null;
  onBack: () => void;
  onViewAllRuns: () => void;
  onViewExecution: (executionId: string) => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const { run, loading, timedOut, error, refetch } = useRunPolling(projectId, runId, accessToken, onSessionExpired, onAccessDenied);
  const { apis } = useApiList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const apiById = useMemo(() => new Map(apis.map((a) => [a.apiId, a])), [apis]);

  const running = !!run && UNFINISHED_RUN_STATUSES.has(run.runStatus);
  const orderedExecutions = useMemo(
    () => (run ? [...run.executions].sort((a, b) => a.executionOrder - b.executionOrder) : []),
    [run],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline">
              APIs
            </button>
            <span className="text-xs text-muted">·</span>
            <button onClick={onViewAllRuns} className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline">
              Test Runs
            </button>
          </div>
          <h2 className="m-0 mt-1 text-lg font-semibold text-gray-900">Run Result</h2>
          <p className="m-0 mt-1 font-mono text-xs text-muted">{runId}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="p-5">
        {loading && <p className="m-0 text-sm text-muted">Loading…</p>}
        {!loading && !run && <p className="m-0 text-sm text-error">{error ?? "Run not found."}</p>}

        {run && (
          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[run.runStatus] ?? "neutral"} label={formatCode(run.runStatus)} />
                <Badge tone="neutral" label={run.runType === "BATCH" ? "Batch Run" : "Single Run"} />
                {running && <span className="text-xs text-muted">Running…</span>}
              </div>
              {timedOut && (
                <p className="m-0 mt-2 text-xs text-warning">
                  Still not finished after a while — the server may be busy. You can keep waiting or refresh again later.
                </p>
              )}
              {error && <p className="m-0 mt-2 text-xs text-error">{error}</p>}
              {run.note && <p className="m-0 mt-2 text-xs text-muted">Note: {run.note}</p>}
              <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-900 sm:grid-cols-4">
                <div>
                  <dt className="text-muted">Created By</dt>
                  <dd className="m-0">{run.createdBy}</dd>
                </div>
                <div>
                  <dt className="text-muted">Created</dt>
                  <dd className="m-0">{formatTimestamp(run.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Started</dt>
                  <dd className="m-0">{formatTimestamp(run.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Ended</dt>
                  <dd className="m-0">{formatTimestamp(run.endedAt)}</dd>
                </div>
              </dl>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral" label={`${run.summary.totalApis} Total`} />
              <Badge tone="success" label={`${run.summary.responseReceivedCount} Response Received`} />
              <Badge tone="danger" label={`${run.summary.runErrorCount} Run Error`} />
              <Badge tone="warning" label={`${run.summary.skippedCount} Skipped`} />
              <Badge tone="info" label={`${run.summary.unfinishedCount} Unfinished`} />
            </div>

            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>Method</th>
                    <th className={thClass}>Path</th>
                    <th className={thClass}>Name</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Outcome</th>
                    <th className={thClass}>HTTP</th>
                    <th className={thClass}>Duration</th>
                    <th className={`${thClass} text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedExecutions.map((execution) => {
                    const apiInfo = apiById.get(execution.apiId);
                    const showOutcomeBadge = execution.executionOutcome !== null && execution.executionOutcome !== execution.executionStatus;
                    return (
                      <tr key={execution.executionId} className={trHoverClass}>
                        <td className={tdClass}>
                          {apiInfo ? <HttpMethodBadge method={apiInfo.httpMethod} /> : <span className="text-xs text-muted">—</span>}
                        </td>
                        <td className={`${tdClass} font-mono`}>{apiInfo?.path ?? "(deleted API)"}</td>
                        <td className={tdClass}>{apiInfo?.apiName ?? "—"}</td>
                        <td className={tdClass}>
                          <Badge tone={STATUS_TONE[execution.executionStatus] ?? "neutral"} label={formatCode(execution.executionStatus)} />
                        </td>
                        <td className={tdClass}>
                          {showOutcomeBadge ? (
                            <Badge tone={OUTCOME_TONE[execution.executionOutcome!] ?? "neutral"} label={formatCode(execution.executionOutcome!)} />
                          ) : execution.skipReasonCode ? (
                            <span className="text-xs text-muted">{formatCode(execution.skipReasonCode)}</span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className={tdClass}>{execution.httpStatus ?? "—"}</td>
                        <td className={tdClass}>{execution.durationMs !== null ? `${execution.durationMs} ms` : "—"}</td>
                        <td className={`${tdClass} text-center`}>
                          <Button variant="secondary" size="sm" onClick={() => onViewExecution(execution.executionId)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
