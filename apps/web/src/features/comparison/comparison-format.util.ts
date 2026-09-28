import type { BadgeTone } from "../../components/ui/Badge"
import type {
  ComparisonAvailabilityReasonCode,
  ComparisonClassificationValue,
  ComparisonInputCheckOutcome,
  ComparisonProcessingStatus,
  ComparisonResult,
  ComparisonSourceKind,
  FindingDisplayKind,
  FindingLocationDto,
  FindingPresenceKind,
} from "./comparison.types"

// Single source of truth for Comparison label/tone/format text — every
// screen and every UI-AC test imports from here rather than re-deriving
// strings, per AnD_UI_Group_6_7_Comparison_v0.1.md §3.2/§5.3/§5.4 (English
// copy, translated faithfully in meaning — see the plan's scope decision).

const ELIGIBILITY_REASON_CODES = new Set([
  "CONTEXT_MISMATCH",
  "ENVIRONMENT_MISMATCH",
  "AUTH_CONTEXT_UNKNOWN",
])
const DATA_UNAVAILABLE_REASON_CODES = new Set([
  "SNAPSHOT_INVALIDATED",
  "SNAPSHOT_INCOMPLETE",
  "UNSUPPORTED_FORMAT",
  "UNSUPPORTED_ENCODING",
  "PAYLOAD_UNAVAILABLE",
])

export interface StatusDisplay {
  label: string
  tone: BadgeTone
}

// §3.2 table. BLOCKED's label further depends on reasonCode (doc's three
// BLOCKED rows); reasonCode is null-safe since a BLOCKED row observed before
// the reason is persisted should still render *something* rather than throw.
export function getProcessingStatusDisplay(
  processingStatus: ComparisonProcessingStatus,
  reasonCode: string | null,
): StatusDisplay {
  switch (processingStatus) {
    case "QUEUED":
      return { label: "Pending", tone: "neutral" }
    case "RUNNING":
      return { label: "Comparing", tone: "info" }
    case "FAILED":
      return { label: "Comparison failed", tone: "danger" }
    case "COMPLETED":
      return { label: "Completed", tone: "success" }
    case "BLOCKED":
      if (reasonCode === "INPUT_MISMATCH")
        return { label: "Input incompatible", tone: "warning" }
      if (reasonCode && ELIGIBILITY_REASON_CODES.has(reasonCode))
        return { label: "Pair not eligible", tone: "warning" }
      if (reasonCode && DATA_UNAVAILABLE_REASON_CODES.has(reasonCode))
        return { label: "Cannot compare fully", tone: "warning" }
      return { label: "Blocked", tone: "warning" }
  }
}

// History table's Result column: "—" whenever not COMPLETED (doc §3.1).
// Detail screen's Result box uses its own "Not concluded yet" fallback
// instead of "—" — callers render the null case themselves for that reason.
export function getResultDisplay(
  processingStatus: ComparisonProcessingStatus,
  result: ComparisonResult | null,
): StatusDisplay | null {
  if (processingStatus !== "COMPLETED" || !result) return null
  return result === "SAME"
    ? { label: "SAME", tone: "success" }
    : { label: "DIFFERENT", tone: "danger" }
}

// §5.4: default "Not marked", no CLEAR option once classified.
export function getClassificationDisplay(
  classification: ComparisonClassificationValue | null,
): StatusDisplay {
  if (!classification) return { label: "Not marked", tone: "neutral" }
  return classification === "EXPECTED"
    ? { label: "Expected", tone: "success" }
    : { label: "Unexpected", tone: "warning" }
}

// §3.1 Nguồn column / CHAIN_PAIR shown with its ordinal ("Chuỗi #n").
export function getSourceKindLabel(
  sourceKind: ComparisonSourceKind,
  pairOrdinal: number | null,
): string {
  switch (sourceKind) {
    case "AUTO_EXECUTION":
      return "Automatic"
    case "MANUAL_PAIR":
      return "Two Snapshots"
    case "BASELINE_LATEST":
      return "Baseline vs latest"
    case "CHAIN_PAIR":
      return pairOrdinal !== null ? `Chain #${pairOrdinal}` : "Chain"
  }
}

// §5.3: a missing side is "No data", never 0; delta stays blank, never 0.
export function formatLatencyMs(latencyMs: number | null): string {
  return latencyMs === null ? "No data" : `${latencyMs} ms`
}

export function formatLatencyDeltaMs(latencyDeltaMs: number | null): string {
  if (latencyDeltaMs === null) return ""
  return `${latencyDeltaMs > 0 ? "+" : ""}${latencyDeltaMs} ms`
}

export type VersionChangedDisplay = { kind: "changed" } | {
  kind: "unchanged"
} | { kind: "undetermined" }

// §5.3: "Version changed" only when both sides are known AND differ;
// UNKNOWN/missing is "Undetermined" — never treated as confirmed-equal.
export function getVersionChangedDisplay(
  changed: boolean | null,
): VersionChangedDisplay {
  if (changed === null) return { kind: "undetermined" }
  return changed ? { kind: "changed" } : { kind: "unchanged" }
}

// §4 no-pair messages (BASELINE_LATEST 200 ComparisonAvailabilityResult).
export function getAvailabilityReasonMessage(
  reasonCode: ComparisonAvailabilityReasonCode,
): string {
  switch (reasonCode) {
    case "NO_LATEST_SNAPSHOT":
      return "No latest Snapshot in the selected scope yet."
    case "NO_BASELINE":
      return "The latest Snapshot's Execution has no baseline yet."
    case "BASELINE_INVALIDATED":
      return "The baseline has been invalidated; the system won't automatically choose another one."
  }
}

export function getInputCheckOutcomeLabel(
  outcome: ComparisonInputCheckOutcome | null,
): string {
  if (!outcome) return "Not yet determined"
  return outcome === "COMPATIBLE" ? "Compatible" : "Mismatch"
}

// §5.2 Absent/null/empty/type row, reconciled against the real 4-value
// FindingPresenceKind (the doc's "Chuỗi rỗng" vs "Mảng rỗng" split isn't a
// distinct backend presenceKind — EMPTY covers both, disambiguated here via
// the finding side's own displayKind rather than inventing a 5th value).
export function getFindingPresenceLabel(
  presenceKind: FindingPresenceKind,
  displayKind: FindingDisplayKind,
): string {
  switch (presenceKind) {
    case "ABSENT":
      return "Does not exist"
    case "NULL":
      return "JSON null"
    case "EMPTY":
      if (displayKind === "array") return "Empty array"
      if (displayKind === "string") return "Empty string"
      return "Empty"
    case "VALUE":
      return "Has value"
  }
}

// §5.2's "Kiểu khác" (different type) is a cross-side comparison, not a
// single side's presenceKind — surfaced separately so callers can flag it
// without conflating it with the four presence labels above.
export function isFindingTypeMismatch(
  a: { displayKind: FindingDisplayKind },
  b: { displayKind: FindingDisplayKind },
): boolean {
  return a.displayKind !== b.displayKind
}

// A finding's location is either a JSON path, a pair of byte-range
// descriptors (raw/binary), or absent entirely (e.g. the single HTTP-status
// finding) — never implies the two sides were parsed/matched against each
// other, just where each was read from.
export function formatFindingLocation(
  location: FindingLocationDto,
): string | null {
  if (!location) return null
  if ("path" in location) return location.path
  const parts: string[] = []
  if (location.aByteOffset !== null || location.aByteLength !== null) {
    parts.push(
      `A: offset ${location.aByteOffset ?? "?"}, length ${location.aByteLength ?? "?"}`,
    )
  }
  if (location.bByteOffset !== null || location.bByteLength !== null) {
    parts.push(
      `B: offset ${location.bByteOffset ?? "?"}, length ${location.bByteLength ?? "?"}`,
    )
  }
  return parts.length > 0 ? parts.join(" · ") : null
}
