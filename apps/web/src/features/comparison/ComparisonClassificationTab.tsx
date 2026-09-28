import { useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Textarea } from "../../components/ui/Input"
import { tdClass, thClass, trHoverClass } from "../../components/ui/table"
import { ApiError } from "../../services/api-client"
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView"
import { getClassificationDisplay } from "./comparison-format.util"
import { COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH } from "./comparison.types"
import type {
  ComparisonClassificationValue,
  ComparisonDetailDto,
} from "./comparison.types"
import { useClassificationEvents } from "./useClassificationEvents"

const CLASSIFICATION_OPTIONS: {
  value: ComparisonClassificationValue
  label: string
}[] = [
  { value: "EXPECTED", label: "Expected" },
  { value: "UNEXPECTED", label: "Unexpected" },
]

// Tab 5 of Comparison Detail (plan Flow 7, CMP-002 Should). The create
// control only appears when result==="DIFFERENT" and is fully additive —
// every Must-priority screen works with it removed (§5.4: default "Not
// marked", no CLEAR option once classified). expectedRevision is always
// comparison.classificationRevision — the same revision the header chip
// currently displays — never re-derived from this tab's own history list.
// A 409 REVISION_CONFLICT means that prop is stale: the pending choice is
// cleared and the parent is asked to refetch so the next submit uses the
// real current revision, rather than silently resubmitting (AC-09).
export function ComparisonClassificationTab({
  comparison,
  accessToken,
  onSessionExpired,
  onAccessDenied,
  onClassified,
}: {
  comparison: ComparisonDetailDto
  accessToken: string | null
  onSessionExpired: () => void
  onAccessDenied: () => void
  onClassified: () => void
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
    create,
  } = useClassificationEvents(
    comparison.comparisonId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )
  const [selection, setSelection] =
    useState<ComparisonClassificationValue | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentDisplay = getClassificationDisplay(comparison.classification)

  async function handleSubmit() {
    if (!selection) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await create(
        selection,
        note.trim() || null,
        comparison.classificationRevision,
      )
      setSelection(null)
      setNote("")
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "REVISION_CONFLICT") {
        setSelection(null)
        setNote("")
      }
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Unable to save classification.",
      )
    } finally {
      setSubmitting(false)
      onClassified()
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h4 className="m-0 mb-1.5 text-xs font-semibold text-gray-900">
          Current classification
        </h4>
        <div className="flex items-center gap-2">
          <Badge tone={currentDisplay.tone} label={currentDisplay.label} />
          {comparison.classifiedBy && (
            <span className="text-xs text-muted">
              by {comparison.classifiedBy}
              {comparison.classifiedAt
                ? ` · ${formatTimestamp(comparison.classifiedAt)}`
                : ""}
            </span>
          )}
        </div>
      </div>

      {comparison.result === "DIFFERENT" && (
        <div className="rounded-md border border-border p-3">
          <h4 className="m-0 mb-2 text-xs font-semibold text-gray-900">
            Classify this difference
          </h4>
          <div
            role="radiogroup"
            aria-label="Classification"
            className="flex gap-4"
          >
            {CLASSIFICATION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-1.5 text-sm text-gray-900"
              >
                <input
                  type="radio"
                  name="classification"
                  value={opt.value}
                  checked={selection === opt.value}
                  onChange={() => setSelection(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="mt-3">
            <Textarea
              label="Note (optional)"
              value={note}
              onChange={(e) =>
                setNote(
                  e.target.value.slice(
                    0,
                    COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH,
                  ),
                )
              }
              maxLength={COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH}
              rows={3}
            />
            <p className="m-0 mt-1 text-right text-[11px] text-muted">
              {note.length} / {COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH}
            </p>
          </div>
          {submitError && (
            <p className="m-0 mb-2 text-xs text-error">{submitError}</p>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!selection || submitting}
          >
            {submitting ? "Saving..." : "Save classification"}
          </Button>
        </div>
      )}

      <div>
        <h4 className="m-0 mb-1.5 text-xs font-semibold text-gray-900">
          Classification history
        </h4>
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
            No classification events recorded yet.
          </p>
        )}
        {!loading && !error && items.length > 0 && (
          <>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>Revision</th>
                    <th className={thClass}>Classification</th>
                    <th className={thClass}>Note</th>
                    <th className={thClass}>By</th>
                    <th className={thClass}>At</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ev) => {
                    const display = getClassificationDisplay(ev.classification)
                    return (
                      <tr
                        key={ev.classificationEventId}
                        className={trHoverClass}
                      >
                        <td className={tdClass}>#{ev.revision}</td>
                        <td className={tdClass}>
                          <Badge tone={display.tone} label={display.label} />
                        </td>
                        <td className={tdClass}>
                          {ev.note ?? <span className="text-muted">—</span>}
                        </td>
                        <td className={tdClass}>{ev.classifiedBy}</td>
                        <td className={tdClass}>
                          {formatTimestamp(ev.classifiedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                {totalItems} event{totalItems === 1 ? "" : "s"}
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
    </div>
  )
}
