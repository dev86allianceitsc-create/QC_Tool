import type { ComparisonAttemptReasonCode } from "./comparison.constants";

// Group 6/7 Comparison — ELIGIBILITY gate (REQ-CMP-005/ENV-004, BR-CMP-014-09
// first-stopping-gate precedence: exactly one reason is ever reported, even
// when a pair fails more than one dimension). Runs once a Snapshot A/B pair
// has already been identified — baseline lookup, a manual pair, or a chain
// pair (see comparison.service.ts) — and strictly before the INPUT gate.
// Checked in the exact order the spec lists: Project/API/Environment ID,
// stable auth context, invalidation, then completeness.
//
// Deliberately takes a narrow, self-contained input shape rather than a
// Prisma Snapshot row, so this stays a pure function unit-testable without a
// database — same convention as header-diff.util.ts / body-diff.util.ts.
export interface EligibilitySnapshotInput {
  projectId: string;
  apiId: string;
  environmentId: string;
  // snapshots.auth_context_key is NOT NULL at the DB layer and always
  // computed by computeAuthContextKey at Snapshot-creation time (see
  // SnapshotService.tryCreateSnapshot) — a falsy value here can only occur
  // defensively (e.g. a hand-built caller), never for a real row. The
  // AUTH_CONTEXT_UNKNOWN branch below exists for that defensive case only.
  authContextKey: string;
  // True iff this Snapshot's `invalidation` relation is present — the row's
  // mere existence is the invalidated signal, there is no boolean column.
  isInvalidated: boolean;
  // True iff this Snapshot's `payload` relation (a snapshot_payloads row) is
  // present. SnapshotService always creates Snapshot+SnapshotPayload together
  // in one transaction, so a missing payload should never happen for a real
  // row — this is a defensive data-integrity check, matching the documented
  // invariant in schema.prisma's snapshot_payloads doc comment ("a partial
  // write can never produce a recognized-complete Snapshot without its
  // payload").
  hasPayload: boolean;
  // True iff snapshots.request_headers / response_headers is non-null.
  // Unlike a null request/response BODY (a legitimate, ongoing "no body was
  // sent/received" state — see body-diff.util.ts's findBodyDifferences),
  // schema.prisma documents null headers as meaning ONLY one thing: "Snapshot
  // created before the header columns existed"
  // (20260924130000_add_snapshot_headers) — every Snapshot written by today's
  // SnapshotService always stores an array (possibly empty). A null value is
  // therefore always a genuine data-completeness gap, never a confirmed
  // "zero headers" fact, so it is gated here rather than silently treated as
  // `[]` by the INPUT/OUTPUT header comparison.
  hasRequestHeaders: boolean;
  hasResponseHeaders: boolean;
  // Phase 3 Test Case History & Run Again (3C-R02 revert): a Login Form
  // Test Account is re-authenticated fresh per dispatch, so two Snapshots
  // sharing the same authContextKey can still legitimately belong to two
  // different Test Accounts — authContextKey alone cannot catch that, since
  // it is computed only from environmentId+authType+contextVersion, never
  // the account itself. Checked below only when authType is LOGIN_FORM;
  // BEARER_TOKEN/NONE have no Test Account concept at all.
  authType: string;
  testAccountId: string | null;
}

export type EligibilityOutcome = { eligible: true } | { eligible: false; reasonCode: ComparisonAttemptReasonCode; reasonDetailSafe: string };

export function checkComparisonEligibility(a: EligibilitySnapshotInput, b: EligibilitySnapshotInput): EligibilityOutcome {
  if (a.projectId !== b.projectId || a.apiId !== b.apiId) {
    return { eligible: false, reasonCode: "CONTEXT_MISMATCH", reasonDetailSafe: "Snapshot A and B belong to different Project/API scope" };
  }
  if (a.environmentId !== b.environmentId) {
    return { eligible: false, reasonCode: "ENVIRONMENT_MISMATCH", reasonDetailSafe: "Snapshot A and B were captured in different Environments" };
  }

  if (!a.authContextKey || !b.authContextKey) {
    return { eligible: false, reasonCode: "AUTH_CONTEXT_UNKNOWN", reasonDetailSafe: "Snapshot A or B has no computable authentication context" };
  }
  if (a.authContextKey !== b.authContextKey) {
    return { eligible: false, reasonCode: "CONTEXT_MISMATCH", reasonDetailSafe: "Snapshot A and B were captured under different authentication contexts" };
  }

  if (a.authType === "LOGIN_FORM" && a.testAccountId !== b.testAccountId) {
    return { eligible: false, reasonCode: "TEST_ACCOUNT_MISMATCH", reasonDetailSafe: "Snapshot A and B were captured using different Test Accounts" };
  }

  if (a.isInvalidated || b.isInvalidated) {
    return { eligible: false, reasonCode: "SNAPSHOT_INVALIDATED", reasonDetailSafe: "Snapshot A or B has been invalidated" };
  }

  if (!a.hasPayload || !b.hasPayload) {
    return { eligible: false, reasonCode: "SNAPSHOT_INCOMPLETE", reasonDetailSafe: "Snapshot A or B is missing its stored request/response payload" };
  }
  if (!a.hasRequestHeaders || !b.hasRequestHeaders || !a.hasResponseHeaders || !b.hasResponseHeaders) {
    return { eligible: false, reasonCode: "SNAPSHOT_INCOMPLETE", reasonDetailSafe: "Snapshot A or B predates header capture and has no recorded request/response headers" };
  }

  return { eligible: true };
}
