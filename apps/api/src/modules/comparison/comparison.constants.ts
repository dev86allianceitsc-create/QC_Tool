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
  | "PERSISTENCE_ERROR";

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
export const COMPARISON_ATTEMPT_RETRY_POLICY: Record<ComparisonAttemptReasonCode, "never" | "always" | "conditional"> = {
  CONTEXT_MISMATCH: "never",
  ENVIRONMENT_MISMATCH: "never",
  AUTH_CONTEXT_UNKNOWN: "never",
  SNAPSHOT_INVALIDATED: "never",
  INPUT_MISMATCH: "never",
  SNAPSHOT_INCOMPLETE: "conditional",
  UNSUPPORTED_FORMAT: "conditional",
  UNSUPPORTED_ENCODING: "conditional",
  PAYLOAD_UNAVAILABLE: "conditional",
  ENGINE_ERROR: "always",
  PERSISTENCE_ERROR: "always",
};

// comparison_attempts.applied_rule_manifest — no policy/rule-version master
// table exists yet in this repo (DB-VERIFY-03, migration doc comment); every
// attempt (including retries, each "recording its own rule manifest" per
// AnD §6.2) writes this same hardcoded default until one does. Documented
// known limitation, not modeled as a FK.
export const DEFAULT_APPLIED_RULE_MANIFEST = {
  ruleManifestVersion: 1,
  exclusions: [] as string[],
  representationBoundary: "DEFAULT",
} as const;
