// Mirrors apps/api/src/modules/run/run.constants.ts MAX_BATCH_EXECUTIONS.
// Application-enforced only, not exposed by any API response (DC-04) — keep
// this value in sync with the backend constant by hand. See
// document/implementation/GROUP_RUN_PROGRESS.md for the tradeoff record.
export const MAX_BATCH_EXECUTIONS = 20;

// Mirrors ListRunsQueryDto's IsIn lists (apps/api/src/modules/run/dto) — the
// Run-level (not per-execution) type/status vocabulary, for UI-RUN-07's
// Type/Status filters. Run-level status has no SKIPPED/NOT_EXECUTED — those
// exist only per-execution (REQ-RUN-007).
export const RUN_TYPE_VALUES = ["SINGLE", "BATCH"] as const;
export const RUN_STATUS_VALUES = ["PENDING", "RUNNING", "COMPLETED", "INTERRUPTED"] as const;
