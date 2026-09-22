// REQ-VER-001 — API Version and Database Version.
//
// Two independent, optional, free-form strings declared during Run
// Preparation (VER-BR-01/02). Group 3C covers the declaration UI only: no
// Run record exists yet to attach the values to, so nothing here persists
// anything (the mapping doc's REQ-VER-001 row: "UI designed; Run
// persistence deferred").
//
// Open Design Controls VER-OD-01/02 are not frozen. The rules below follow
// the requirement's own proposed direction and are deliberately kept in one
// place so the Run group can align API/DB with them — or override them —
// in a single edit:
//   VER-OD-01  free-form string, trimmed, no SemVer enforcement, length
//              capped so a stray paste cannot become a "version".
//   VER-OD-02  one canonical representation: an empty declaration is empty,
//              and UNKNOWN is how an empty declaration is *displayed*.
//              UNKNOWN is never stored as a literal by this layer, and per
//              VER-BR-08 it means "not declared" — not 0, not null, and not
//              "unchanged".
// VER-OD-03 (prefill) resolves to: no prefill — the fields start empty on
// every Run Preparation.

export const UNKNOWN_VERSION = "UNKNOWN";
export const MAX_VERSION_LENGTH = 100;

// The declared value, or null when nothing was declared. Whitespace-only
// input is "nothing declared" — not a version made of spaces.
export function normalizeVersion(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

// What the Run would record/display for this field right now (VER-BR-03).
export function displayVersion(raw: string): string {
  return normalizeVersion(raw) ?? UNKNOWN_VERSION;
}

// Length is the only constraint: VER-BR-03 forbids inferring or reshaping a
// declared version, so no SemVer or character-set rule is applied. A value
// that is too long is reported, never silently truncated.
export function validateVersion(raw: string, label: string): string | null {
  const normalized = normalizeVersion(raw);
  if (normalized !== null && normalized.length > MAX_VERSION_LENGTH) {
    return `${label} must be ${MAX_VERSION_LENGTH} characters or fewer.`;
  }
  return null;
}
