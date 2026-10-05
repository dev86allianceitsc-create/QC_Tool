import type { RunRequestValues } from "./requestInput.types"

// Browser-local "remember what I typed last" convenience for the Run API
// wizard's Request Values step. This is a client-only echo of the draft
// that already lives in RunApiArea's React state — it is never sent to the
// backend and never merged into RequestInputDefinition, so it does not
// cross the §20 Data Ownership Boundary that keeps RunRequestValues
// ephemeral/unpersisted server-side (requestInput.types.ts). It only saves
// the user from retyping the same values after a page reload or when
// reopening this API+Environment's Run tab later.
const STORAGE_KEY_PREFIX = "qc.runRequestValuesDraft"

function storageKey(apiId: string, environmentId: string | null): string {
  return `${STORAGE_KEY_PREFIX}:${apiId}:${environmentId ?? "none"}`
}

function isRunRequestValues(value: unknown): value is RunRequestValues {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.pathValues === "object" &&
    candidate.pathValues !== null &&
    typeof candidate.queryValues === "object" &&
    candidate.queryValues !== null &&
    typeof candidate.headerValues === "object" &&
    candidate.headerValues !== null &&
    typeof candidate.bodyValue === "string"
  )
}

export function loadRunRequestValuesDraft(
  apiId: string,
  environmentId: string | null,
): RunRequestValues | null {
  try {
    const raw = window.localStorage.getItem(storageKey(apiId, environmentId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isRunRequestValues(parsed) ? parsed : null
  } catch {
    // localStorage can be unavailable (private browsing, disabled site
    // data) or hold malformed/stale JSON — either way this is a pure
    // convenience, so fall back to blank fields rather than throwing.
    return null
  }
}

export function saveRunRequestValuesDraft(
  apiId: string,
  environmentId: string | null,
  values: RunRequestValues,
): void {
  try {
    window.localStorage.setItem(
      storageKey(apiId, environmentId),
      JSON.stringify(values),
    )
  } catch {
    // Best-effort only — see loadRunRequestValuesDraft.
  }
}
