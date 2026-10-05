// Group 6/7 Comparison — reason-code metadata (AnD Database v0.3 Section 5,
// REQ-CMP-014 BR-CMP-014-09 first-stopping-gate precedence, REQ-CMP-016
// RS-CMP-016-07). Single source of truth for whether a terminal
// ComparisonAttempt bearing a given reason may ever be retried.
export type ComparisonAttemptReasonCode =
  | "CONTEXT_MISMATCH"
  | "ENVIRONMENT_MISMATCH"
  | "AUTH_CONTEXT_UNKNOWN"
  | "SNAPSHOT_INVALIDATED"
  | "SNAPSHOT_INCOMPLETE"
  | "INPUT_MISMATCH"
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_ENCODING"
  | "PAYLOAD_UNAVAILABLE"
  | "ENGINE_ERROR"
  | "PERSISTENCE_ERROR"
  | "TEST_ACCOUNT_MISMATCH"
  | "CONFIG_DRIFT_DETECTED";

// Retry eligibility per reason code (AnD Database/API §6.2 Retryability):
// - "never": an identity/eligibility/input-mismatch fact a retry cannot
//   change on its own (RS-CMP-014-09/BR-CMP-014-08) — CONTEXT_MISMATCH,
//   ENVIRONMENT_MISMATCH and AUTH_CONTEXT_UNKNOWN are permanent facts about
//   the Snapshot pair, SNAPSHOT_INVALIDATED can only be cleared by choosing a
//   different pair (never done by retry), INPUT_MISMATCH is a diagnosis, not
//   a transient failure.
// - "always": a technical failure, safely retryable once the prior attempt
//   is terminal.
// - "conditional": Snapshot data was unusable; retryable only once the
//   caller can affirmatively confirm the same bytes are now fully
//   readable/comparable. No policy/engine layer exists yet in this repo to
//   make that determination itself (DB-VERIFY-03), so ComparisonService
//   never assumes it — see ComparisonService.retryComparisonAttempt's
//   `payloadNowReadable` option.
//
// TEST_ACCOUNT_MISMATCH (Phase 3 Test Case History) joins the ELIGIBILITY
// family above it — a permanent fact about the pair, same as
// CONTEXT_MISMATCH/ENVIRONMENT_MISMATCH/AUTH_CONTEXT_UNKNOWN.
// CONFIG_DRIFT_DETECTED joins INPUT_MISMATCH for the same reason: it is a
// diagnosis (the resolved request drifted from the baseline despite
// matching Test Case Identity), not a transient failure a retry could
// resolve.
export const COMPARISON_ATTEMPT_RETRY_POLICY: Record<ComparisonAttemptReasonCode, "never" | "always" | "conditional"> = {
  CONTEXT_MISMATCH: "never",
  ENVIRONMENT_MISMATCH: "never",
  AUTH_CONTEXT_UNKNOWN: "never",
  SNAPSHOT_INVALIDATED: "never",
  INPUT_MISMATCH: "never",
  TEST_ACCOUNT_MISMATCH: "never",
  CONFIG_DRIFT_DETECTED: "never",
  SNAPSHOT_INCOMPLETE: "conditional",
  UNSUPPORTED_FORMAT: "conditional",
  UNSUPPORTED_ENCODING: "conditional",
  PAYLOAD_UNAVAILABLE: "conditional",
  ENGINE_ERROR: "always",
  PERSISTENCE_ERROR: "always",
};

// Case-insensitive RESPONSE_HEADER names the OUTPUT gate (comparison-output-
// gate.util.ts) never reports as a finding. Every one of these is injected by
// the server/CDN/edge and varies on every single request-response pair by
// design (a per-request trace id, the wall clock, a content validator that
// also encodes timing/compression, a cache/proxy's elapsed-seconds-since-
// cached counter, a per-response-signed error-reporting endpoint, a shared
// rate-limit counter/reset clock that any call — including the comparison's
// own two requests — necessarily decrements/advances) — comparing them
// produces a technically true but meaningless DIFFERENT finding, since
// neither side's actual API behavior changed. Every other response header
// (WWW-Authenticate, Vary, Content-Type, Set-Cookie, ...) is still compared
// with no exclusion.
export const VOLATILE_RESPONSE_HEADER_EXCLUSIONS = [
  "date",
  "etag",
  "age",
  "cf-ray",
  "cf-cache-status",
  "report-to",
  "x-request-id",
  "x-amzn-requestid",
  "x-amzn-trace-id",
  "x-amz-cf-id",
  "x-cache",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "server-timing",
  "x-runtime",
] as const;

// Comparison Detail read-time value re-derivation (comparison-finding-
// evidence.util.ts) — case-insensitive header names whose actual value is
// NEVER shown, even to a project member who already passed
// ComparisonAccessGuard. Distinct purpose from VOLATILE_RESPONSE_HEADER_
// EXCLUSIONS above: those headers are skipped entirely because comparing
// them is meaningless; these headers ARE still compared and reported as
// findings (a changed credential is a real difference worth flagging), but
// their A/B values are replaced with a fixed "[REDACTED]" marker instead of
// the actual secret bytes. Deliberately broader than run-dispatch.util.ts's
// redactHeaders (Authorization-only, for Run Result's trace) — that
// precedent exists for a different read path with a narrower documented
// scope, not a repo-wide sensitive-header policy this can defer to.
export const SENSITIVE_HEADER_NAMES = new Set<string>(["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"]);

// Comparison Detail read-time value re-derivation — property-name segments
// (case-insensitive, punctuation-insensitive: "access_token" and
// "accessToken" both match "accesstoken") anywhere in a JSON body finding's
// locationPath that force that side's value to "[REDACTED]" rather than the
// real slice of stored body bytes, no matter how deep the field sits (a
// secret nested under a sensitive parent key must stay hidden too). Same
// "no approved broader policy exists yet" situation as
// VOLATILE_RESPONSE_HEADER_EXCLUSIONS' comment on comparison-output-
// gate.util.ts — this is a narrow, named carve-out for the field names the
// user-facing spec explicitly calls out (token/password/secret/cookie
// family), not a general content-sniffing redaction engine.
export const SENSITIVE_JSON_FIELD_NAMES = new Set<string>([
  "password",
  "passwd",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "apikey",
  "secret",
  "clientsecret",
  "privatekey",
  "authorization",
  "cookie",
]);

// comparison_attempts.applied_rule_manifest — no policy/rule-version master
// table exists yet in this repo (DB-VERIFY-03, migration doc comment); every
// attempt (including retries, each "recording its own rule manifest" per
// AnD §6.2) writes this same hardcoded default until one does. `exclusions`
// is the actual list the OUTPUT gate applies (VOLATILE_RESPONSE_HEADER_
// EXCLUSIONS above), not a separate informational copy — so the persisted
// manifest and the gate's real behavior can never drift apart. Documented
// known limitation, not modeled as a FK.
export const DEFAULT_APPLIED_RULE_MANIFEST = {
  ruleManifestVersion: 1,
  exclusions: [...VOLATILE_RESPONSE_HEADER_EXCLUSIONS] as string[],
  representationBoundary: "DEFAULT",
} as const;

// Shared response/query enums for the Group 6/7 API surface (AnD API v0.2
// §2.2/§3) — single source of truth reused by request DTOs (@IsIn) and
// response DTOs (@ApiProperty enum) alike. RERUN_EXECUTION (Phase 3 Test
// Case History) is the advanced "Re-run this execution" action's own kind —
// automatic/system-originated like AUTO_EXECUTION, but kept distinct since
// it forces a specific baseline rather than auto-selecting one.
export const COMPARISON_SOURCE_KIND_VALUES = ["AUTO_EXECUTION", "MANUAL_PAIR", "BASELINE_LATEST", "CHAIN_PAIR", "RERUN_EXECUTION"] as const;
export type ComparisonSourceKind = (typeof COMPARISON_SOURCE_KIND_VALUES)[number];

export const COMPARISON_PROCESSING_STATUS_VALUES = ["QUEUED", "RUNNING", "BLOCKED", "FAILED", "COMPLETED"] as const;
export type ComparisonProcessingStatus = (typeof COMPARISON_PROCESSING_STATUS_VALUES)[number];

export const COMPARISON_RESULT_VALUES = ["SAME", "DIFFERENT"] as const;
export type ComparisonResult = (typeof COMPARISON_RESULT_VALUES)[number];

export const COMPARISON_FINDING_PHASE_VALUES = ["INPUT", "OUTPUT"] as const;
export type ComparisonFindingPhase = (typeof COMPARISON_FINDING_PHASE_VALUES)[number];

export const COMPARISON_CLASSIFICATION_VALUES = ["EXPECTED", "UNEXPECTED"] as const;
export type ComparisonClassificationValue = (typeof COMPARISON_CLASSIFICATION_VALUES)[number];

// API-CMP-001 BASELINE_LATEST 200 "no pair constructed" outcome (AnD API §3,
// CMP-001 Success) — distinct from Run's own NO_BASELINE/NO_NEW_SNAPSHOT
// availability codes, never unified with them.
export const COMPARISON_AVAILABILITY_REASON_CODE_VALUES = ["NO_LATEST_SNAPSHOT", "NO_BASELINE", "BASELINE_INVALIDATED"] as const;
export type ComparisonAvailabilityReasonCode = (typeof COMPARISON_AVAILABILITY_REASON_CODE_VALUES)[number];

export const COMPARISON_SELECTION_MODE_VALUES = ["PAIR", "BASELINE_LATEST"] as const;
export type ComparisonSelectionMode = (typeof COMPARISON_SELECTION_MODE_VALUES)[number];

// Which action created a given ComparisonAttempt (ck_comparison_attempts_trigger_kind):
// INITIAL is a Comparison's first attempt; RETRY re-runs a terminal
// non-COMPLETED attempt; REEVALUATION recomputes an already-COMPLETED
// attempt's gates against the same stored Snapshots under whatever Ignore
// Rules are active now, without touching the original attempt or calling
// the API-under-test again.
export const COMPARISON_ATTEMPT_TRIGGER_KIND_VALUES = ["INITIAL", "RETRY", "REEVALUATION"] as const;
export type ComparisonAttemptTriggerKind = (typeof COMPARISON_ATTEMPT_TRIGGER_KIND_VALUES)[number];

// AnD API v0.2 §3 CMP-009 leaves the classification note length "limit
// DESIGN PROPOSAL" (physical TBD) — same unresolved-length precedent as
// Snapshot invalidation's reason field. 2000 chars reuses that exact
// implementation default (snapshot.constants.ts
// SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH) for consistency, pending explicit
// confirmation; not a value taken verbatim from any REQ-CMP clause.
export const COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH = 2000;

// A healthy attempt reaches a terminal state within milliseconds (in-process
// gate computation, no external I/O beyond DB reads) — this threshold only
// exists to catch an attempt orphaned by a dropped fire-and-forget dispatch
// (e.g. process restart mid-flight) or an engine crash before it could mark
// itself terminal. getComparison() re-dispatches any non-terminal attempt
// older than this on read (safe no-op if it's actually still in flight or
// already terminal by the time it runs).
export const COMPARISON_ATTEMPT_STALE_MS = 30_000;
