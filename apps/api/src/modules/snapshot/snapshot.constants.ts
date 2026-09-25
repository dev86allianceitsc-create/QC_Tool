// Group 5 Snapshot — shared constants. REQ-SNP-004 BR-07 leaves the payload
// size cap to implementation design; 25 MB (Q4 decision) is applied
// independently to the request body and the response body (not a combined
// sum) — an oversized body is rejected outright rather than truncated
// (EXC-01).

export const SNAPSHOT_MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;

// AnD API Group 5 Snapshot §6.1 leaves the Invalidate `reason` length cap as
// "physical TBD" (Claude Review Gate #3). 2000 chars is an implementation
// default pending explicit confirmation — not a value taken verbatim from
// any REQ-SNP clause.
export const SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH = 2000;

// AnD API Group 5 Snapshot Claude Review Gate #2 leaves the Detail preview
// length undefined ("Định nghĩa preview limit..."). 2000 chars is an
// implementation default pending explicit confirmation — the preview is a
// display-only truncation of already-stored bytes and never rewrites what
// GET Content (API-SNP-003) returns.
export const SNAPSHOT_PREVIEW_MAX_CHARS = 2000;
