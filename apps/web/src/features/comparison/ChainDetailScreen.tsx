import { useMemo, useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { CopyableText } from "../../components/ui/CopyableText"
import { tdClass, thClass, thCenterClass, trHoverClass } from "../../components/ui/table"
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView"
import { useApiList } from "../apiEnvironment/useApiList"
import { useEnvironmentList } from "../apiEnvironment/useEnvironmentList"
import { formatSnapshotShortId } from "../snapshot/snapshot-id.util"
import {
  getClassificationDisplay,
  getProcessingStatusDisplay,
  getResultDisplay,
} from "./comparison-format.util"
import { useChainDetail } from "./useChainDetail"

const PAGE_SIZE = 20

// Flow 6 (plan) UI-CMP-04/05. Each pair keeps its own independent
// Status/Result/Classification — there is deliberately no aggregate
// chain-level SAME/DIFFERENT badge, and a BLOCKED/FAILED pair (e.g. a
// mid-chain invalidated Snapshot) never hides or short-circuits its siblings
// (AC-06). Polls (backoff, via useChainDetail) while any visible pair is
// non-terminal; a single stuck pair keeps the whole page polling since the
// predicate is "every pair terminal", not "any pair terminal".
export function ChainDetailScreen({
  projectId,
  comparisonChainId,
  accessToken,
  onBack,
  onViewComparison,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string
  comparisonChainId: string
  accessToken: string | null
  onBack: () => void
  onViewComparison: (comparisonId: string) => void
  onSessionExpired: () => void
  onAccessDenied: () => void
}) {
  const [page, setPage] = useState(1)
  const { chain, loading, notFound, timedOut, error, refetch } = useChainDetail(
    comparisonChainId,
    page,
    PAGE_SIZE,
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

  const rangeStart =
    !chain || chain.totalItems === 0 ? 0 : (chain.page - 1) * chain.pageSize + 1
  const rangeEnd = chain
    ? Math.min(chain.page * chain.pageSize, chain.totalItems)
    : 0

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <button
            onClick={onBack}
            className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline"
          >
            Back to Comparisons
          </button>

          <h2 className="m-0 mt-1.5 text-lg font-semibold text-gray-900">
            Comparison Chain
          </h2>

          {chain && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span>{apiById.get(chain.apiId)?.apiName ?? chain.apiId}</span>
              <span>·</span>
              <span>
                {envById.get(chain.environmentId)?.environmentName ??
                  chain.environmentId}
              </span>
              <span>·</span>
              <span>{chain.selectedSnapshotCount} Snapshots selected</span>
              <span>·</span>
              <span>
                {chain.totalItems} pair{chain.totalItems === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>Requested {formatTimestamp(chain.requestedAt)}</span>
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={refetch}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="p-5">
          <p className="m-0 text-sm text-muted">Loading…</p>
        </div>
      )}

      {!loading && notFound && (
        <div className="flex flex-col items-start gap-2 p-5">
          <p className="m-0 text-sm text-muted">
            This Comparison Chain no longer exists or you no longer have access
            to it.
          </p>
          <Button variant="secondary" size="sm" onClick={onBack}>
            ← Comparisons
          </Button>
        </div>
      )}

      {!loading && !notFound && error && (
        <div className="flex flex-col items-start gap-2 p-5">
          <p className="m-0 text-sm text-error">{error}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !notFound && !error && chain && (
        <div className="flex flex-col gap-3 p-5">
          {timedOut && (
            <div className="rounded-md border border-border bg-gray-50 p-3">
              <p className="m-0 text-xs text-gray-900">
                This Chain is taking longer than expected.{" "}
                <button
                  onClick={refetch}
                  className="cursor-pointer border-none bg-transparent p-0 text-xs text-primary underline"
                >
                  Refresh
                </button>{" "}
                to keep checking.
              </p>
            </div>
          )}

          {chain.pairs.length === 0 ? (
            <p className="m-0 text-sm text-muted">
              No pairs recorded for this Chain.
            </p>
          ) : (
            <>
              <div
                aria-live="polite"
                aria-atomic="true"
                className="overflow-auto"
              >
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={thClass}>Pair</th>
                      <th className={thClass}>Snapshot pair</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Result</th>
                      <th className={thClass}>Classification</th>
                      <th className={thClass}>Stopped at</th>
                      <th className={thClass}>Reason</th>
                      <th className={thCenterClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chain.pairs
                      .slice()
                      .sort((a, b) => a.pairOrdinal - b.pairOrdinal)
                      .map(({ pairOrdinal, comparison }) => {
                        const statusDisplay = getProcessingStatusDisplay(
                          comparison.processingStatus,
                          comparison.reasonCode,
                        )
                        const resultDisplay = getResultDisplay(
                          comparison.processingStatus,
                          comparison.result,
                        )
                        const classificationDisplay =
                          comparison.result === "DIFFERENT"
                            ? getClassificationDisplay(
                                comparison.classification,
                              )
                            : null
                        return (
                          <tr
                            key={comparison.comparisonId}
                            className={trHoverClass}
                          >
                            <td className={tdClass}>#{pairOrdinal}</td>
                            <td className={tdClass}>
                              <div className="flex items-center gap-1 font-mono text-xs">
                                <CopyableText
                                  value={comparison.baselineSnapshotId}
                                  display={formatSnapshotShortId(
                                    comparison.baselineSnapshotId,
                                  )}
                                />
                                <span className="text-muted">→</span>
                                <CopyableText
                                  value={comparison.targetSnapshotId}
                                  display={formatSnapshotShortId(
                                    comparison.targetSnapshotId,
                                  )}
                                />
                              </div>
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
                            <td className={tdClass}>
                              {comparison.stoppedAtGate ?? (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className={tdClass}>
                              {comparison.reasonDetailSafe ?? (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className={`${tdClass} text-center`}>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  onViewComparison(comparison.comparisonId)
                                }
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
                  Showing {rangeStart}–{rangeEnd} of {chain.totalItems}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <span className="text-xs text-muted">Page {page}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!chain.hasMore}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
