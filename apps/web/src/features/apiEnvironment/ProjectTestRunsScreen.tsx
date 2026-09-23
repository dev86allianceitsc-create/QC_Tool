import { useMemo } from "react";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";
import { STATUS_TONE, formatCode, formatTimestamp } from "./ExecutionResultView";
import { RUN_STATUS_VALUES, RUN_TYPE_VALUES } from "./run.constants";
import type { RunExecutionSummary } from "./run.types";
import { useApiList } from "./useApiList";
import { useEnvironmentList } from "./useEnvironmentList";
import { useRunList } from "./useRunList";

const selectClass = "rounded-md border border-border px-2.5 py-1.5 text-xs text-gray-900";
const labelClass = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted";

function OutcomeSummaryCell({ summary }: { summary: RunExecutionSummary }) {
  const parts: { key: string; tone: BadgeTone; label: string }[] = [
    summary.responseReceivedCount > 0 ? { key: "ok", tone: "success" as BadgeTone, label: `${summary.responseReceivedCount} OK` } : null,
    summary.runErrorCount > 0 ? { key: "err", tone: "danger" as BadgeTone, label: `${summary.runErrorCount} Error` } : null,
    summary.skippedCount > 0 ? { key: "skip", tone: "warning" as BadgeTone, label: `${summary.skippedCount} Skipped` } : null,
    summary.unfinishedCount > 0 ? { key: "unf", tone: "info" as BadgeTone, label: `${summary.unfinishedCount} Unfinished` } : null,
  ].filter((p): p is { key: string; tone: BadgeTone; label: string } => p !== null);

  if (parts.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p) => (
        <Badge key={p.key} tone={p.tone} label={p.label} />
      ))}
    </div>
  );
}

// UI-RUN-07 Project Test Runs — Single and Batch Run history for the whole
// Project, sharing one table/data source (GET /projects/:projectId/runs).
// "View" always goes to the shared Run Result route (/runs/:runId), which
// already renders correctly for both Single (1-row table) and Batch (N-row
// table) and already offers its own per-execution "View" into Execution
// Detail — so this screen does not need a second, executionId-based route
// for Single rows (RunListItem has no executionId; only RunDetail does).
export function ProjectTestRunsScreen({
  projectId,
  accessToken,
  onViewRun,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string;
  accessToken: string | null;
  onViewRun: (runId: string) => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const { filters, updateFilters, clearFilters, page, setPage, items, totalItems, totalPages, loading, error, refetch } = useRunList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );
  const { apis } = useApiList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const { environments } = useEnvironmentList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const apiById = useMemo(() => new Map(apis.map((a) => [a.apiId, a])), [apis]);
  const envById = useMemo(() => new Map(environments.map((e) => [e.environmentId, e])), [environments]);

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, totalItems);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="m-0 text-lg font-semibold text-gray-900">Test Runs</h2>
          <p className="m-0 mt-1 text-xs text-muted">Single and Batch Run history for this Project.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className={labelClass}>
            API
            <select className={selectClass} value={filters.apiId} onChange={(e) => updateFilters({ apiId: e.target.value })}>
              <option value="">All APIs</option>
              {apis.map((a) => (
                <option key={a.apiId} value={a.apiId}>
                  {a.httpMethod} {a.path}
                </option>
              ))}
            </select>
          </label>

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

          <label className={labelClass}>
            Type
            <select className={selectClass} value={filters.runType} onChange={(e) => updateFilters({ runType: e.target.value })}>
              <option value="">All Types</option>
              {RUN_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t === "BATCH" ? "Batch" : "Single"}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Status
            <select className={selectClass} value={filters.runStatus} onChange={(e) => updateFilters({ runStatus: e.target.value })}>
              <option value="">All Statuses</option>
              {RUN_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {formatCode(s)}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            From
            <input
              type="date"
              className={selectClass}
              value={filters.createdFrom}
              onChange={(e) => updateFilters({ createdFrom: e.target.value })}
            />
          </label>

          <label className={labelClass}>
            To
            <input type="date" className={selectClass} value={filters.createdTo} onChange={(e) => updateFilters({ createdTo: e.target.value })} />
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
            <p className="m-0 text-sm text-muted">No Runs match your filters.</p>
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
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
                    <th className={thClass}>API</th>
                    <th className={thClass}>Env</th>
                    <th className={thClass}>Initiator</th>
                    <th className={thClass}>Created / Started</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Outcome</th>
                    <th className={`${thClass} text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((run) => {
                    const apiInfo = run.apiId ? apiById.get(run.apiId) : undefined;
                    const env = envById.get(run.environmentId);
                    return (
                      <tr key={run.runId} className={trHoverClass}>
                        <td className={`${tdClass} max-w-[110px] truncate font-mono`} title={run.runId}>
                          {run.runId}
                        </td>
                        <td className={tdClass}>
                          <Badge tone="neutral" label={run.runType === "BATCH" ? "Batch" : "Single"} />
                        </td>
                        <td className={tdClass}>
                          {run.runType === "SINGLE" ? (
                            <div className="flex items-center gap-1.5">
                              {apiInfo && <HttpMethodBadge method={apiInfo.httpMethod} />}
                              <span className="font-mono text-xs">{apiInfo?.path ?? "(deleted API)"}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-900">{run.summary.totalApis} APIs</span>
                          )}
                        </td>
                        <td className={tdClass}>{env?.environmentName ?? "(unknown)"}</td>
                        <td className={`${tdClass} max-w-[110px] truncate font-mono`} title={run.createdBy}>
                          {run.createdBy}
                        </td>
                        <td className={tdClass}>
                          <div>{formatTimestamp(run.createdAt)}</div>
                          {run.startedAt && <div className="text-xs text-muted">Started: {formatTimestamp(run.startedAt)}</div>}
                        </td>
                        <td className={tdClass}>
                          <Badge tone={STATUS_TONE[run.runStatus] ?? "neutral"} label={formatCode(run.runStatus)} />
                        </td>
                        <td className={tdClass}>
                          <OutcomeSummaryCell summary={run.summary} />
                        </td>
                        <td className={`${tdClass} text-center`}>
                          <Button variant="secondary" size="sm" onClick={() => onViewRun(run.runId)}>
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
    </div>
  );
}
