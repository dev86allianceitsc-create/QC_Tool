// Group Run — shared constants. Batch max (DB-C01) is application-enforced
// only, not a DB CHECK (see migration header). Timeout/body-cap have no
// value specified by REQ-RUN-00x — reasonable engineering defaults for the
// Run Execution Engine (X-06 latitude, rule #10).

export const MAX_BATCH_EXECUTIONS = 20;
export const RUN_EXECUTION_TIMEOUT_MS = 30_000;
export const MAX_STORED_RESPONSE_BODY_BYTES = 1_000_000;
