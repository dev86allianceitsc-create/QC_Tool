import { useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { formatCode } from "../apiEnvironment/ExecutionResultView"
import { IgnoreFieldsConfirmDialog } from "./IgnoreFieldsConfirmDialog"
import {
  formatFindingLocation,
  getFindingDifferenceSummary,
  getFindingPresenceLabel,
  isFindingTypeMismatch,
  shouldShowSidePresenceLabel,
} from "./comparison-format.util"
import type {
  ComparisonFindingItemDto,
  ComparisonFindingPhase,
  ComparisonProcessingStatus,
  FindingSideDto,
} from "./comparison.types"
import type { BulkCreateIgnoreRulesResult } from "../projects/ignoreRules.types"
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

// A side's presence/content is now read-derived from the Snapshot pair
// (comparison-finding-evidence.util.ts on the backend), so safeText/hexPreview
// hold a real value whenever the finding's contract allows exposing one, and
// a fixed "[REDACTED]" marker (isRedacted:true) whenever it doesn't — never a
// universal placeholder. The generic presence label above is only shown when
// there's no content box following it (ABSENT/NULL/EMPTY), so it never reads
// as a second, contradictory value next to the real one.
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
      {shouldShowSidePresenceLabel(side) && (
        <p className="m-0 text-xs text-gray-900">
          {getFindingPresenceLabel(side.presenceKind, side.displayKind)}
        </p>
      )}
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

// Only RESPONSE_BODY findings with a path-type location can be suppressed by
// an Ignore Rule (ignore-rule-path-matcher.util.ts never matches HTTP_STATUS
// or RESPONSE_HEADER findings), so selection-mode checkboxes only ever
// appear on those — never implying a header/status diff could be ignored.
function getIgnorablePath(finding: ComparisonFindingItemDto): string | null {
  if (finding.component !== "RESPONSE_BODY") return null
  if (!finding.location || !("path" in finding.location)) return null
  return finding.location.path
}

function FindingCard({
  finding,
  ignoreMode,
  selected,
  onToggleSelected,
}: {
  finding: ComparisonFindingItemDto
  ignoreMode: boolean
  selected: boolean
  onToggleSelected: (path: string) => void
}) {
  const location = formatFindingLocation(finding.location)
  const differenceSummary = getFindingDifferenceSummary(finding.a, finding.b)
  const ignorablePath = getIgnorablePath(finding)
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {ignoreMode && ignorablePath && (
          <input
            type="checkbox"
            aria-label={`Select ${ignorablePath} to ignore`}
            checked={selected}
            onChange={() => onToggleSelected(ignorablePath)}
          />
        )}
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
      {differenceSummary && (
        <p className="m-0 mt-2 text-xs font-medium text-gray-900">
          {differenceSummary}
        </p>
      )}
      <p className="m-0 mt-2 text-[11px] text-muted">
        {finding.ruleCode} · {finding.ruleVersion}
      </p>
    </div>
  )
}

export function ComparisonFindingsTab({
  comparisonId,
  phase,
  projectId,
  apiId,
  accessToken,
  onSessionExpired,
  onAccessDenied,
  detailProcessingStatus,
}: {
  comparisonId: string
  phase: ComparisonFindingPhase
  projectId?: string
  apiId?: string
  accessToken: string | null
  onSessionExpired: () => void
  onAccessDenied: () => void
  detailProcessingStatus: ComparisonProcessingStatus | null
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
    detailProcessingStatus,
  )

  const [ignoreMode, setIgnoreMode] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalItems)

  const canIgnoreFields = phase === "OUTPUT" && !!projectId && !!apiId
  const ignorablePathsOnPage = items
    .map(getIgnorablePath)
    .filter((path): path is string => path !== null)
  const allOnPageSelected =
    ignorablePathsOnPage.length > 0 &&
    ignorablePathsOnPage.every((path) => selectedPaths.has(path))

  function toggleSelected(path: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  function handleSelectAll() {
    setSelectedPaths((prev) => {
      if (allOnPageSelected) {
        const next = new Set(prev)
        ignorablePathsOnPage.forEach((path) => next.delete(path))
        return next
      }
      return new Set([...prev, ...ignorablePathsOnPage])
    })
  }

  function handleCancelIgnoreMode() {
    setIgnoreMode(false)
    setSelectedPaths(new Set())
  }

  function handleDialogSuccess(result: BulkCreateIgnoreRulesResult) {
    setShowConfirmDialog(false)
    setIgnoreMode(false)
    setSelectedPaths(new Set())
    const skippedNote =
      result.skippedCount > 0 ? `, ${result.skippedCount} already existed` : ""
    setFeedback(
      `Created ${result.created.length} Ignore Rule${result.created.length === 1 ? "" : "s"}${skippedNote}.`,
    )
  }

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
          {feedback && (
            <p className="m-0 text-sm text-success">{feedback}</p>
          )}

          {canIgnoreFields && !ignoreMode && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFeedback(null)
                  setIgnoreMode(true)
                }}
              >
                Ignore fields
              </Button>
            </div>
          )}

          {canIgnoreFields && ignoreMode && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSelectAll}
                disabled={ignorablePathsOnPage.length === 0}
              >
                {allOnPageSelected ? "Deselect all" : "Select all"}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancelIgnoreMode}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowConfirmDialog(true)}
                disabled={selectedPaths.size === 0}
              >
                Ignore selected ({selectedPaths.size})
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {items.map((finding) => (
              <FindingCard
                key={finding.findingId}
                finding={finding}
                ignoreMode={ignoreMode}
                selected={selectedPaths.has(getIgnorablePath(finding) ?? "")}
                onToggleSelected={toggleSelected}
              />
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

      {showConfirmDialog && projectId && apiId && (
        <IgnoreFieldsConfirmDialog
          paths={[...selectedPaths]}
          projectId={projectId}
          apiId={apiId}
          accessToken={accessToken}
          onCancel={() => setShowConfirmDialog(false)}
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  )
}
