import type { HeaderPair } from "../run/run-dispatch.util";
import { COMPARISON_RULE_CODES } from "./comparison-finding.constants";
import type { ComparisonFindingInput } from "./comparison.service";
import { findBodyDifferences } from "./body-diff.util";
import { compareHeaderPairs } from "./header-diff.util";

// Group 6/7 Comparison — INPUT gate (REQ-CMP-006). Runs once ELIGIBILITY
// (comparison-eligibility.util.ts) has already passed, so both sides are
// guaranteed a real, complete authContextKey/payload/requestHeaders —
// requestHeaders is therefore typed as a plain array here, never null;
// requestBody stays nullable since an absent request body (e.g. a GET) is a
// legitimate ongoing state, not an eligibility gap (see
// body-diff.util.ts's findBodyDifferences doc comment).
//
// Deliberately a narrow, self-contained input shape rather than a Prisma
// Snapshot row — same pure-function convention as
// comparison-eligibility.util.ts / header-diff.util.ts / body-diff.util.ts.
export interface InputGateSnapshotInput {
  httpMethod: string;
  requestUrl: string;
  requestHeaders: readonly HeaderPair[];
  requestBody: Uint8Array | null;
}

// Compares actual INPUT (method, URL, headers, body) per REQ-CMP-006/RS-CMP-
// 006: method and URL by exact string equality, headers via
// compareHeaderPairs (case-insensitive names, ordered repeated values), body
// via findBodyDifferences (raw-byte-primary, JSON-structural-secondary).
// Deliberately never filters/excludes any header (Date, nonce, boundary,
// Authorization included) — no approved exclusion policy/version exists in
// the current spec, so the safe default is to compare everything actually
// sent, per RS-CMP-006's explicit prohibition on auto-exclusion.
//
// Returns the flat list of INPUT-phase findings, empty when fully
// compatible — same "emptiness is the compatibility signal" convention as
// compareHeaderPairs/compareBodies/findBodyDifferences, so callers (the
// engine orchestrator) derive comparison_attempts.input_check_outcome as
// simply `findings.length > 0 ? "MISMATCH" : "COMPATIBLE"` rather than this
// function duplicating that enum itself.
export function checkInputCompatibility(a: InputGateSnapshotInput, b: InputGateSnapshotInput): ComparisonFindingInput[] {
  const findings: ComparisonFindingInput[] = [];

  if (a.httpMethod !== b.httpMethod) {
    findings.push(methodMismatchFinding(a.httpMethod, b.httpMethod));
  }
  if (a.requestUrl !== b.requestUrl) {
    findings.push(urlMismatchFinding());
  }

  findings.push(...compareHeaderPairs(a.requestHeaders, b.requestHeaders, "REQUEST_HEADER"));
  findings.push(...findBodyDifferences(a.requestBody, b.requestBody, "REQUEST_BODY"));

  return findings;
}

// HTTP methods are a small, fixed, non-secret vocabulary (GET/POST/PUT/...),
// safe to echo verbatim in safeSummary — unlike URL below.
function methodMismatchFinding(aMethod: string, bMethod: string): ComparisonFindingInput {
  return {
    phase: "INPUT",
    component: "METHOD",
    differenceKind: "VALUE",
    locationPath: null,
    ruleCode: COMPARISON_RULE_CODES.METHOD_MISMATCH,
    safeSummary: `Method differs (A=${aMethod}, B=${bMethod})`,
  };
}

// Unlike method, the URL's query string can carry secrets/tokens (e.g. an
// API key or signed URL parameter), so safeSummary must never echo either
// side's actual value — only the fact that they differ.
function urlMismatchFinding(): ComparisonFindingInput {
  return {
    phase: "INPUT",
    component: "URL",
    differenceKind: "VALUE",
    locationPath: null,
    ruleCode: COMPARISON_RULE_CODES.URL_MISMATCH,
    safeSummary: "URL differs",
  };
}
