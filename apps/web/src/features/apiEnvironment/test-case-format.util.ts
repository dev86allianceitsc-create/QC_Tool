import type { BadgeTone } from "../../components/ui/Badge"

import type { RunRequestValuesPayload } from "./run.types"

export type TestCaseResult = "SAME" | "DIFFERENT" | "INITIAL_RUN" | "UNAVAILABLE"

// Phase 3 Test Case History & Run Again (§8) — SAME/DIFFERENT reuse the same
// warning/danger tone convention as comparison-format.util.ts's
// getResultDisplay (SAME is intentionally "warning"/amber, not "success").
// INITIAL_RUN/UNAVAILABLE are both neutral but must never render with
// SAME/DIFFERENT wording — concept A/B outcomes are never conflated with
// concept C's actual output comparison.
export function getTestCaseResultDisplay(result: TestCaseResult): {
  label: string
  tone: BadgeTone
} {
  switch (result) {
    case "SAME":
      return { label: "Same", tone: "warning" }
    case "DIFFERENT":
      return { label: "Different", tone: "danger" }
    case "INITIAL_RUN":
      return { label: "Initial run", tone: "neutral" }
    case "UNAVAILABLE":
      return { label: "Comparison unavailable", tone: "neutral" }
  }
}

export interface InputSummaryField {
  key: string
  value: string
}

// A Test Case card's saved Request Input, as compact key/value rows — path
// + query values, plus a JSON body's top-level fields (e.g. two POSTs with
// no path/query params but different payloads must not both render as "no
// parameters," which would make them indistinguishable on the card).
// Headers stay secondary/technical detail, available via the full Execution
// Detail drill-through. The card decides how many of these rows to show and
// how to label the rest as "+ N more" — this just returns every field.
const MAX_SUMMARY_VALUE_LENGTH = 30

export function getInputSummaryFields(
  input: RunRequestValuesPayload | null,
): InputSummaryField[] {
  if (!input) return []

  const entries = [
    ...Object.entries(input.pathValues ?? {}),
    ...Object.entries(input.queryValues ?? {}),
  ].filter(([, value]) => value.trim() !== "")

  const fields = entries.map(([key, value]) => ({
    key,
    value: truncateValue(value),
  }))

  const body = input.bodyValue?.trim()
  if (body) {
    fields.push(...summarizeBody(body))
  }

  return fields
}

// Most bodies here are a flat JSON object keyed by the API's own payload
// fields (e.g. {"UI_FirstID": "..."}) — expanding those into the same
// key/value rows as Path/Query keeps the card human-readable instead of
// showing raw JSON. Anything else (a JSON array/primitive, or a non-JSON
// body such as form-urlencoded or XML) falls back to one truncated "body"
// row.
function summarizeBody(body: string): InputSummaryField[] {
  try {
    const parsed: unknown = JSON.parse(body)

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>).map(
        ([key, value]) => ({
          key,
          value: truncateValue(stringifyJsonValue(value)),
        }),
      )
    }
  } catch {
    // Not JSON — fall through to the raw truncated preview below.
  }

  return [{ key: "body", value: truncateValue(body.replace(/\s+/g, " ").trim()) }]
}

function stringifyJsonValue(value: unknown): string {
  if (typeof value === "string") return value
  if (value === null) return "null"
  if (typeof value === "object") return Array.isArray(value) ? "[…]" : "{…}"
  return String(value)
}

function truncateValue(value: string): string {
  return value.length > MAX_SUMMARY_VALUE_LENGTH
    ? `${value.slice(0, MAX_SUMMARY_VALUE_LENGTH)}…`
    : value
}
