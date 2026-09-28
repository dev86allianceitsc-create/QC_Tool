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

// Shared response/query enums for the Group 6/7 API surface (AnD API v0.2
// §2.2/§3) — single source of truth reused by request DTOs (@IsIn) and
// response DTOs (@ApiProperty enum) alike.
export const COMPARISON_SOURCE_KIND_VALUES = ["AUTO_EXECUTION", "MANUAL_PAIR", "BASELINE_LATEST", "CHAIN_PAIR"] as const;
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

// AnD API v0.2 §3 CMP-009 leaves the classification note length "limit
// DESIGN PROPOSAL" (physical TBD) — same unresolved-length precedent as
// Snapshot invalidation's reason field. 2000 chars reuses that exact
// implementation default (snapshot.constants.ts
// SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH) for consistency, pending explicit
// confirmation; not a value taken verbatim from any REQ-CMP clause.
export const COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH = 2000;
