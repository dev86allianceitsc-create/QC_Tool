import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { formatCode } from "../apiEnvironment/ExecutionResultView"
import {
  formatFindingLocation,
  getFindingPresenceLabel,
  isFindingTypeMismatch,
} from "./comparison-format.util"
import type {
  ComparisonFindingItemDto,
  ComparisonFindingPhase,
  ComparisonProcessingStatus,
  FindingSideDto,
} from "./comparison.types"
import { useComparisonFindings } from "./useComparisonFindings"

const PAGE_SIZE = 20

// Tabs 2/3 of Comparison Detail (plan Flow 4), parametrized by phase. Empty
// items never render a bare "no differences" text — that phrase is only
// trustworthy once processingStatus is COMPLETED (AC-02/AC-03/AC-07): while
// QUEUED/RUNNING it says "still processing", and BLOCKED/FAILED says the
// comparison never reached this stage rather than implying a clean result.
function getEmptyStateMessage(
  phase: ComparisonFindingPhase,
  processingStatus: ComparisonProcessingStatus | null,
): string {
  if (
    processingStatus === null ||
    processingStatus === "QUEUED" ||
    processingStatus === "RUNNING"
  ) {
    return "Still processing — this tab will update once the comparison finishes."
  }
  if (processingStatus === "COMPLETED") {
    return phase === "OUTPUT"
      ? "No output differences found."
      : "No input issues found."
  }
  return phase === "OUTPUT"
    ? "The comparison did not reach the output-comparison stage."
    : "No input diagnosis recorded for this comparison."
}

// Every side is isRedacted:true today (deviation #2) — safeText/hexPreview
// are themselves the intended display value, not a placeholder hiding a raw
// payload, so there is deliberately no "Redacted" indicator or raw/download
// control here.
function FindingSideBlock({
  label,
  side,
}: {
  label: string
  side: FindingSideDto
}) {
  return (
    <div className="rounded-md border border-border bg-gray-50 p-2">
      <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="m-0 text-xs text-gray-900">
        {getFindingPresenceLabel(side.presenceKind, side.displayKind)}
      </p>
      {side.presenceKind === "VALUE" &&
        (side.safeText !== null || side.hexPreview !== null) && (
          <>
            <pre className="m-0 mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-1.5 text-[11px] text-gray-900">
              {side.safeText ?? side.hexPreview}
            </pre>
            {side.hasMore && (
              <p className="m-0 mt-1 text-[11px] text-muted">
                Truncated — more content not shown.
              </p>
            )}
          </>
        )}
    </div>
  )
}

function FindingCard({ finding }: { finding: ComparisonFindingItemDto }) {
  const location = formatFindingLocation(finding.location)
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-900">
          {formatCode(finding.component)}
        </span>
        {isFindingTypeMismatch(finding.a, finding.b) && (
          <Badge tone="warning" label="Type mismatch" />
        )}
        <span className="text-xs text-muted">
          {formatCode(finding.differenceKind)}
        </span>
      </div>
      {finding.safeSummary && (
        <p className="m-0 mt-1.5 text-sm text-gray-900">
          {finding.safeSummary}
        </p>
      )}
      {location && (
        <p className="m-0 mt-1 font-mono text-xs text-muted">{location}</p>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FindingSideBlock label="Side A" side={finding.a} />
        <FindingSideBlock label="Side B" side={finding.b} />
      </div>
      <p className="m-0 mt-2 text-[11px] text-muted">
        {finding.ruleCode} · {finding.ruleVersion}
      </p>
    </div>
  )
}

export function ComparisonFindingsTab({
  comparisonId,
  phase,
  accessToken,
  onSessionExpired,
  onAccessDenied,
}: {
  comparisonId: string
  phase: ComparisonFindingPhase
  accessToken: string | null
  onSessionExpired: () => void
  onAccessDenied: () => void
}) {
  const {
    items,
    page,
    setPage,
    totalItems,
    hasMore,
    processingStatus,
    loading,
    error,
    refetch,
  } = useComparisonFindings(
    comparisonId,
    phase,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalItems)

  return (
    <div className="flex flex-col gap-3 p-5">
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
          {getEmptyStateMessage(phase, processingStatus)}
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="flex flex-col gap-2.5">
            {items.map((finding) => (
              <FindingCard key={finding.findingId} finding={finding} />
            ))}
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
  )
}
