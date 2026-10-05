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
//
// One deliberate, approved exclusion (REVISION 3C-R02): the Authorization
// header is stripped from both sides before diffing. Runs being compared may
// now legitimately use different Login Form Test Accounts against the same
// Environment/Authentication, so their Authorization header is expected to
// differ even when everything else about the request is identical — the
// user's explicit instruction is that such Runs must remain comparable.
// Every other header (Date, nonce, boundary, ...) still follows RS-CMP-006's
// original no-auto-exclusion default.
export function checkInputCompatibility(a: InputGateSnapshotInput, b: InputGateSnapshotInput): ComparisonFindingInput[] {
  const findings: ComparisonFindingInput[] = [];

  if (a.httpMethod !== b.httpMethod) {
    findings.push(methodMismatchFinding(a.httpMethod, b.httpMethod));
  }
  if (a.requestUrl !== b.requestUrl) {
    findings.push(urlMismatchFinding());
  }

  findings.push(...compareHeaderPairs(excludeAuthorizationHeader(a.requestHeaders), excludeAuthorizationHeader(b.requestHeaders), "REQUEST_HEADER"));
  findings.push(...findBodyDifferences(a.requestBody, b.requestBody, "REQUEST_BODY"));

  return findings;
}

function excludeAuthorizationHeader(headers: readonly HeaderPair[]): HeaderPair[] {
  return headers.filter((h) => h.key.toLowerCase() !== "authorization");
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
