// Mirrors apps/api/src/modules/snapshot/snapshot.constants.ts values that the
// UI needs to enforce client-side before hitting the API.
export const SNAPSHOT_STATUS_VALUES = ["NORMAL", "INVALIDATED"] as const;
export const SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH = 2000;
