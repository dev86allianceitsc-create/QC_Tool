import { useMemo, useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { CopyableText } from "../../components/ui/CopyableText"
import { thClass, thCenterClass, tdClass, trHoverClass } from "../../components/ui/table"
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView"
import { useApiList } from "../apiEnvironment/useApiList"
import { useEnvironmentList } from "../apiEnvironment/useEnvironmentList"
import { formatSnapshotShortId } from "../snapshot/snapshot-id.util"
import { CreateComparisonModal } from "./CreateComparisonModal"
import {
  getClassificationDisplay,
  getProcessingStatusDisplay,
  getResultDisplay,
  getSourceKindLabel,
} from "./comparison-format.util"
import type {
  ComparisonProcessingStatus,
  ComparisonResult,
  ComparisonSourceKind,
} from "./comparison.types"
import { useComparisonList } from "./useComparisonList"

const selectClass =
  "rounded-md border border-border px-2.5 py-1.5 text-xs text-gray-900"
const labelClass =
  "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
const PAGE_SIZE = 20

const SOURCE_KIND_VALUES: ComparisonSourceKind[] = [
  "AUTO_EXECUTION",
  "MANUAL_PAIR",
  "BASELINE_LATEST",
  "CHAIN_PAIR",
]
const PROCESSING_STATUS_VALUES: ComparisonProcessingStatus[] = [
  "QUEUED",
  "RUNNING",
  "BLOCKED",
  "FAILED",
  "COMPLETED",
]
const RESULT_VALUES: ComparisonResult[] = ["SAME", "DIFFERENT"]

// UI-CMP-01 (plan Flow 1) — flat filtered table, same template as
// ProjectTestRunsScreen, adapted for Comparison's {items,hasMore} pager
// instead of Snapshot/Run's {...,totalPages} (deviation #1: no totalPages
// field exists here, so Prev/Next gate on hasMore and the footer never shows
// "Page X of Y"). List-screen owns the Create Comparison modal, same
// pattern as ApiListScreen.
export function ComparisonHistoryScreen({
  projectId,
  accessToken,
  onViewComparison,
  onViewChain,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string
  accessToken: string | null
  onViewComparison: (comparisonId: string) => void
  onViewChain: (comparisonChainId: string) => void
  onSessionExpired: () => void
  onAccessDenied: () => void
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const {
    filters,
    updateFilters,
    clearFilters,
    page,
    setPage,
    items,
    totalItems,
    hasMore,
    loading,
    error,
    refetch,
  } = useComparisonList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )
  const { apis } = useApiList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )
  const { environments } = useEnvironmentList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )
  const apiById = useMemo(() => new Map(apis.map((a) => [a.apiId, a])), [apis])
  const envById = useMemo(
    () => new Map(environments.map((e) => [e.environmentId, e])),
    [environments],
  )

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalItems)

  function handleComparisonCreated(comparisonId: string) {
    setShowCreateModal(false)
    onViewComparison(comparisonId)
  }

  function handleChainCreated(comparisonChainId: string) {
    setShowCreateModal(false)
    onViewChain(comparisonChainId)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="m-0 text-lg font-semibold text-gray-900">
            Comparisons
          </h2>
          <p className="m-0 mt-1 text-xs text-muted">
            Snapshot-pair comparisons for this Project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            Create Comparison
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className={labelClass}>
            API
            <select
              className={selectClass}
              value={filters.apiId}
              onChange={(e) => updateFilters({ apiId: e.target.value })}
            >
              <option value="">All APIs</option>
              {apis.map((a) => (
                <option key={a.apiId} value={a.apiId}>
                  {a.apiName}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Snapshot ID
            <input
              type="text"
              className={`${selectClass} font-mono`}
              value={filters.snapshotId}
              onChange={(e) => updateFilters({ snapshotId: e.target.value })}
              placeholder="Matches A or B"
            />
          </label>

          <label className={labelClass}>
            Execution ID
            <input
              type="text"
              className={`${selectClass} font-mono`}
              value={filters.executionId}
              onChange={(e) => updateFilters({ executionId: e.target.value })}
            />
          </label>

          <label className={labelClass}>
            Source
            <select
              className={selectClass}
              value={filters.sourceKind}
              onChange={(e) =>
                updateFilters({
                  sourceKind: e.target.value as ComparisonSourceKind | "",
                })
              }
            >
              <option value="">All Sources</option>
              {SOURCE_KIND_VALUES.map((k) => (
                <option key={k} value={k}>
                  {getSourceKindLabel(k, null)}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Status
            <select
              className={selectClass}
              value={filters.processingStatus}
              onChange={(e) =>
                updateFilters({
                  processingStatus: e.target
                    .value as ComparisonProcessingStatus | "",
                })
              }
            >
              <option value="">All Statuses</option>
              {PROCESSING_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {getProcessingStatusDisplay(s, null).label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Result
            <select
              className={selectClass}
              value={filters.result}
              onChange={(e) =>
                updateFilters({
                  result: e.target.value as ComparisonResult | "",
                })
              }
            >
              <option value="">Any Result</option>
              {RESULT_VALUES.map((r) => (
                <option key={r} value={r}>
                  {r}
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
            <p className="m-0 text-sm text-muted">
              No Comparisons match your filters.
            </p>
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
                    <th className={thClass}>Compared</th>
                    <th className={thClass}>API / Environment</th>
                    <th className={thClass}>Source</th>
                    <th className={thClass}>Created</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Result</th>
                    <th className={thClass}>Classification</th>
                    <th className={thCenterClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const apiInfo = apiById.get(item.apiId)
                    const envInfo = envById.get(item.environmentId)
                    const statusDisplay = getProcessingStatusDisplay(
                      item.processingStatus,
                      item.reasonCode,
                    )
                    const resultDisplay = getResultDisplay(
                      item.processingStatus,
                      item.result,
                    )
                    const classificationDisplay =
                      item.result === "DIFFERENT"
                        ? getClassificationDisplay(item.classification)
                        : null
                    return (
                      <tr key={item.comparisonId} className={trHoverClass}>
                        <td className={tdClass}>
                          <div className="text-xs text-gray-900">
                            {formatTimestamp(
                              item.baselineSnapshot.executionCompletedAt,
                            )}
                            <span className="text-muted"> → </span>
                            {formatTimestamp(
                              item.targetSnapshot.executionCompletedAt,
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted">
                            <CopyableText
                              value={item.baselineSnapshotId}
                              display={formatSnapshotShortId(
                                item.baselineSnapshotId,
                              )}
                            />
                            <span>→</span>
                            <CopyableText
                              value={item.targetSnapshotId}
                              display={formatSnapshotShortId(
                                item.targetSnapshotId,
                              )}
                            />
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div>{apiInfo?.apiName ?? item.apiId}</div>
                          <div className="text-xs text-muted">
                            {envInfo?.environmentName ?? item.environmentId}
                          </div>
                        </td>
                        <td className={tdClass}>
                          {getSourceKindLabel(
                            item.sourceKind,
                            item.pairOrdinal,
                          )}
                        </td>
                        <td className={tdClass}>
                          {formatTimestamp(item.createdAt)}
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
                          {classificationDisplay && (
                            <Badge
                              tone={classificationDisplay.tone}
                              label={classificationDisplay.label}
                            />
                          )}
                        </td>
                        <td className={`${tdClass} text-center`}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onViewComparison(item.comparisonId)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                Showing {rangeStart}–{rangeEnd} of {totalItems}
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

      {showCreateModal && (
        <CreateComparisonModal
          projectId={projectId}
          accessToken={accessToken}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
          onCreated={handleComparisonCreated}
          onChainCreated={handleChainCreated}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}
