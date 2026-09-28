import type { HeaderPair } from "../run/run-dispatch.util";
import { COMPARISON_RULE_CODES } from "./comparison-finding.constants";
import type { ComparisonFindingInput } from "./comparison.service";
import { findBodyDifferences } from "./body-diff.util";
import { compareHeaderPairs } from "./header-diff.util";

// Group 6/7 Comparison — OUTPUT gate (REQ-CMP-007/008/010). Runs only after
// the INPUT gate (comparison-input-gate.util.ts) has already returned zero
// findings — never when INPUT was a MISMATCH, per the spec's "only if input
// compatible do we compare output" rule; that ordering is the caller's
// (engine orchestrator's) responsibility, not enforced here.
//
// httpStatusCode is typed as a plain number, never null: schema.prisma
// documents it as nullable only because RunExecution/other callers can be
// non-2xx, but SnapshotService.tryCreateSnapshot never creates a Snapshot
// (and therefore never a SnapshotPayload) for a non-2xx response — so any
// Snapshot that already passed ELIGIBILITY's hasPayload check is guaranteed
// to carry a real numeric status. responseHeaders is likewise non-null for
// the same reason ELIGIBILITY types it that way in
// comparison-eligibility.util.ts. responseBody stays nullable — an absent
// response body (e.g. a 204) is a legitimate ongoing state, not a gate gap.
//
// Deliberately a narrow, self-contained input shape rather than a Prisma
// Snapshot row — same pure-function convention as every other gate/diff
// utility in this module.
export interface OutputGateSnapshotInput {
  httpStatusCode: number;
  responseHeaders: readonly HeaderPair[];
  responseBody: Uint8Array | null;
}

// Compares the full actual OUTPUT (HTTP status, headers, body) per
// REQ-CMP-007/008/010. Same "emptiness is the compatibility signal"
// convention as checkInputCompatibility: the caller derives the final
// comparisonResult as `findings.length > 0 ? "DIFFERENT" : "SAME"` rather
// than this function duplicating that decision itself — publishing SAME/
// DIFFERENT and persisting these findings atomically is the engine
// orchestrator's job, not this pure comparison step's.
//
// Deliberately never filters/excludes any response header (Date, nonce,
// boundary, Authorization/WWW-Authenticate included) — same no-auto-
// exclusion rule as the INPUT gate, no approved policy/version exists yet.
export function checkOutputDifferences(a: OutputGateSnapshotInput, b: OutputGateSnapshotInput): ComparisonFindingInput[] {
  const findings: ComparisonFindingInput[] = [];

  if (a.httpStatusCode !== b.httpStatusCode) {
    findings.push(httpStatusMismatchFinding(a.httpStatusCode, b.httpStatusCode));
  }

  findings.push(...compareHeaderPairs(a.responseHeaders, b.responseHeaders, "RESPONSE_HEADER"));
  findings.push(...findBodyDifferences(a.responseBody, b.responseBody, "RESPONSE_BODY"));

  return findings;
}

// HTTP status codes are a small, fixed, non-secret vocabulary (100-599),
// safe to echo verbatim in safeSummary.
function httpStatusMismatchFinding(aStatus: number, bStatus: number): ComparisonFindingInput {
  return {
    phase: "OUTPUT",
    component: "HTTP_STATUS",
    differenceKind: "VALUE",
    locationPath: null,
    ruleCode: COMPARISON_RULE_CODES.HTTP_STATUS_MISMATCH,
    safeSummary: `HTTP status differs (A=${aStatus}, B=${bStatus})`,
  };
}
