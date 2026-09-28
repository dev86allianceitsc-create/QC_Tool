import { useMemo, useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { CopyableText } from "../../components/ui/CopyableText"
import { TabBar } from "../../components/ui/TabBar"
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView"
import { useApiList } from "../apiEnvironment/useApiList"
import { useEnvironmentList } from "../apiEnvironment/useEnvironmentList"
import { formatSnapshotShortId } from "../snapshot/snapshot-id.util"
import { ComparisonAttemptsTab } from "./ComparisonAttemptsTab"
import { ComparisonClassificationTab } from "./ComparisonClassificationTab"
import {
  getClassificationDisplay,
  getProcessingStatusDisplay,
  getResultDisplay,
  getSourceKindLabel,
} from "./comparison-format.util"
import { ComparisonFindingsTab } from "./ComparisonFindingsTab"
import { ComparisonOverviewTab } from "./ComparisonOverviewTab"
import type { ComparisonDetailDto } from "./comparison.types"
import { useComparisonDetail } from "./useComparisonDetail"

type DetailTab = "overview" | "output" | "input" | "attempts" | "classification"

const TABS: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "output", label: "Output differences" },
  { key: "input", label: "Input diagnosis" },
  { key: "attempts", label: "Attempt history" },
  { key: "classification", label: "Classification history" },
]

// Comparison is COMPLETED only after every gate it reached has finished, so a
// side invalidated *after* that point can never retroactively flip the stored
// Result — the banner is informational context alongside the historical
// Result, never a rewrite of it (a pre-completion invalidation would instead
// have produced BLOCKED/SNAPSHOT_INVALIDATED).
function isInvalidationStale(comparison: ComparisonDetailDto): boolean {
  return (
    comparison.processingStatus === "COMPLETED" &&
    (comparison.baselineSnapshot.isInvalidatedNow ||
      comparison.targetSnapshot.isInvalidatedNow)
  )
}

// Flow 3 (plan) shell for UI-CMP-03. Owns the header, the two side-by-side
// Processing status / Result boxes (deliberately never merged — each has its
// own null/undetermined vocabulary), and the 5-tab TabBar; every tab below
// only renders its own body. Processing status/Result live here, not inside
// Overview, because they must stay visible no matter which tab is active.
// notFound (comparison-access.guard.ts collapses every permission denial
// into the same 404 as "doesn't exist" — deviation #6) renders one shared
// "not found" state that covers both cases; useComparisonDetail's backoff
// poll keeps refreshing the boxes/tabs in place while non-terminal, with no
// loading flicker on background polls (loading is only true on first load).
export function ComparisonDetailScreen({
  projectId,
  comparisonId,
  accessToken,
  onBack,
  onViewChain,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string
  comparisonId: string
  accessToken: string | null
  onBack: () => void
  onViewChain: (comparisonChainId: string) => void
  onSessionExpired: () => void
  onAccessDenied: () => void
}) {
  const { comparison, loading, notFound, timedOut, error, refetch } =
    useComparisonDetail(
      comparisonId,
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
  const [tab, setTab] = useState<DetailTab>("overview")

  const apiById = useMemo(() => new Map(apis.map((a) => [a.apiId, a])), [apis])
  const envById = useMemo(
    () => new Map(environments.map((e) => [e.environmentId, e])),
    [environments],
  )

  const statusDisplay = comparison
    ? getProcessingStatusDisplay(
        comparison.processingStatus,
        comparison.reasonCode,
      )
    : null
  const resultDisplay = comparison
    ? getResultDisplay(comparison.processingStatus, comparison.result)
    : null
  const classificationDisplay =
    comparison && comparison.result === "DIFFERENT"
      ? getClassificationDisplay(comparison.classification)
      : null

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
            Comparison
          </h2>

          {comparison && (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>
                  {apiById.get(comparison.apiId)?.apiName ?? comparison.apiId}
                </span>
                <span>·</span>
                <span>
                  {envById.get(comparison.environmentId)?.environmentName ??
                    comparison.environmentId}
                </span>
                <span>·</span>
                <span>
                  {getSourceKindLabel(
                    comparison.sourceKind,
                    comparison.pairOrdinal,
                  )}
                </span>
                <span>·</span>
                <span>Created {formatTimestamp(comparison.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1 font-mono text-xs">
                <CopyableText
                  value={comparison.baselineSnapshotId}
                  display={formatSnapshotShortId(comparison.baselineSnapshotId)}
                />
                <span className="text-muted">→</span>
                <CopyableText
                  value={comparison.targetSnapshotId}
                  display={formatSnapshotShortId(comparison.targetSnapshotId)}
                />
              </div>
              {comparison.comparisonChainId && (
                <button
                  onClick={() =>
                    onViewChain(comparison.comparisonChainId as string)
                  }
                  className="mt-1.5 cursor-pointer border-none bg-transparent p-0 text-xs text-primary underline"
                >
                  Part of chain · pair #{comparison.pairOrdinal} · View chain
                </button>
              )}
            </>
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
            This Comparison no longer exists or you no longer have access to it.
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

      {!loading && !notFound && !error && comparison && (
        <>
          {timedOut && (
            <div className="mx-5 mt-4 rounded-md border border-border bg-gray-50 p-3">
              <p className="m-0 text-xs text-gray-900">
                This Comparison is taking longer than expected.{" "}
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

          {isInvalidationStale(comparison) && (
            <div className="mx-5 mt-4 rounded-md border border-border bg-gray-50 p-3">
              <p className="m-0 text-xs text-gray-900">
                One or both Snapshots used for this Comparison have since been
                invalidated. The Result below reflects what was true when this
                Comparison completed and is not rewritten by a later
                invalidation.
              </p>
            </div>
          )}

          <div
            aria-live="polite"
            aria-atomic="true"
            className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2"
          >
            <div className="rounded-md border border-border p-3">
              <h4 className="m-0 mb-2 text-xs font-semibold text-gray-900">
                Processing status
              </h4>
              <Badge tone={statusDisplay!.tone} label={statusDisplay!.label} />
              {comparison.stoppedAtGate && (
                <p className="m-0 mt-2 text-xs text-muted">
                  Stopped at {comparison.stoppedAtGate} gate
                  {comparison.reasonDetailSafe
                    ? `: ${comparison.reasonDetailSafe}`
                    : ""}
                </p>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <h4 className="m-0 mb-2 text-xs font-semibold text-gray-900">
                Result
              </h4>
              <div className="flex items-center gap-2">
                {resultDisplay ? (
                  <Badge
                    tone={resultDisplay.tone}
                    label={resultDisplay.label}
                  />
                ) : (
                  <span className="text-sm text-muted">Not concluded yet</span>
                )}
                {classificationDisplay && (
                  <Badge
                    tone={classificationDisplay.tone}
                    label={classificationDisplay.label}
                  />
                )}
              </div>
            </div>
          </div>

          <TabBar
            items={TABS}
            activeKey={tab}
            onSelect={(key) => setTab(key as DetailTab)}
            ariaLabel="Comparison Detail sections"
          />

          {tab === "overview" && (
            <ComparisonOverviewTab comparison={comparison} />
          )}
          {tab === "output" && (
            <ComparisonFindingsTab
              comparisonId={comparison.comparisonId}
              phase="OUTPUT"
              accessToken={accessToken}
              onSessionExpired={onSessionExpired}
              onAccessDenied={onAccessDenied}
            />
          )}
          {tab === "input" && (
            <ComparisonFindingsTab
              comparisonId={comparison.comparisonId}
              phase="INPUT"
              accessToken={accessToken}
              onSessionExpired={onSessionExpired}
              onAccessDenied={onAccessDenied}
            />
          )}
          {tab === "attempts" && (
            <ComparisonAttemptsTab
              comparison={comparison}
              accessToken={accessToken}
              onSessionExpired={onSessionExpired}
              onAccessDenied={onAccessDenied}
              onRetried={refetch}
            />
          )}
          {tab === "classification" && (
            <ComparisonClassificationTab
              comparison={comparison}
              accessToken={accessToken}
              onSessionExpired={onSessionExpired}
              onAccessDenied={onAccessDenied}
              onClassified={refetch}
            />
          )}
        </>
      )}
    </div>
  )
}
