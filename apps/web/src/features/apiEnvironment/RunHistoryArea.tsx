import { useMemo } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";
import { OUTCOME_TONE, STATUS_TONE, formatCode, formatTimestamp } from "./ExecutionResultView";
import { useApiRunHistory } from "./useApiRunHistory";
import { useEnvironmentList } from "./useEnvironmentList";

const selectClass = "rounded-md border border-border px-2.5 py-1.5 text-xs text-gray-900";
const labelClass = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted";

// UI-RUN-08 Run History — this API's past Run Executions (GET
// /projects/:projectId/apis/:apiId/run-executions, API-RUN-005), regardless
// of whether they came from a Single or a Batch Run. Each row is already one
// execution (ApiRunExecutionListItem carries both runId and executionId), so
// "View" goes straight to Execution Detail rather than through Run Result.
// ListApiRunExecutionsQueryDto only supports an Environment filter (no
// Type/Status/date-range like Project Test Runs), so the filter bar here is
// intentionally narrower than ProjectTestRunsScreen's (UI-RUN-07).
export function RunHistoryArea({
  projectId,
  apiId,
  accessToken,
  onViewExecution,
  onViewAllRuns,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string;
  apiId: string;
  accessToken: string | null;
  onViewExecution: (runId: string, executionId: string) => void;
  onViewAllRuns: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const { filters, updateFilters, clearFilters, page, setPage, items, totalItems, totalPages, loading, error, refetch } = useApiRunHistory(
    projectId,
    apiId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );
  const { environments } = useEnvironmentList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const envById = useMemo(() => new Map(environments.map((e) => [e.environmentId, e])), [environments]);

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, totalItems);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0 mb-1 text-base font-semibold text-gray-900">Run History</h3>
          <p className="m-0 text-xs text-muted">Past Run executions for this API.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onViewAllRuns}>
            All Test Runs →
          </Button>
          <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2.5">
            <label className={labelClass}>
              Environment
              <select className={selectClass} value={filters.environmentId} onChange={(e) => updateFilters({ environmentId: e.target.value })}>
                <option value="">All Environments</option>
                {environments.map((env) => (
                  <option key={env.environmentId} value={env.environmentId}>
                    {env.environmentName}
                  </option>
                ))}
              </select>
            </label>

            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
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
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 text-sm text-muted">No Run executions yet for this API.</p>
              {filters.environmentId && (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={thClass}>Run ID</th>
                      <th className={thClass}>Type</th>
                      <th className={thClass}>Env</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Outcome</th>
                      <th className={thClass}>HTTP</th>
                      <th className={thClass}>Version</th>
                      <th className={thClass}>Created</th>
                      <th className={`${thClass} text-center`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const env = envById.get(item.environmentId);
                      const showOutcomeBadge = item.executionOutcome !== null && item.executionOutcome !== item.executionStatus;
                      return (
                        <tr key={item.executionId} className={trHoverClass}>
                          <td className={`${tdClass} max-w-[110px] truncate font-mono`} title={item.runId}>
                            {item.runId}
                          </td>
                          <td className={tdClass}>
                            <Badge tone="neutral" label={item.runType === "BATCH" ? "Batch" : "Single"} />
                          </td>
                          <td className={tdClass}>{env?.environmentName ?? "(unknown)"}</td>
                          <td className={tdClass}>
                            <Badge tone={STATUS_TONE[item.executionStatus] ?? "neutral"} label={formatCode(item.executionStatus)} />
                          </td>
                          <td className={tdClass}>
                            {showOutcomeBadge ? (
                              <Badge tone={OUTCOME_TONE[item.executionOutcome!] ?? "neutral"} label={formatCode(item.executionOutcome!)} />
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                          <td className={tdClass}>{item.httpStatus ?? "—"}</td>
                          <td className={tdClass}>
                            <span className="font-mono text-xs">
                              {item.apiVersion || "UNKNOWN"} / {item.databaseVersion || "UNKNOWN"}
                            </span>
                          </td>
                          <td className={tdClass}>{formatTimestamp(item.createdAt)}</td>
                          <td className={`${tdClass} text-center`}>
                            <Button variant="secondary" size="sm" onClick={() => onViewExecution(item.runId, item.executionId)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  Showing {rangeStart}–{rangeEnd} of {totalItems}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
                    Prev
                  </Button>
                  <span className="text-xs text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
