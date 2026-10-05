import { createHash } from "node:crypto";

// Phase 3 Test Case History & Run Again — Test Case Identity (concept A: "is
// this logically the same test?"). A pure grouping/history key: determines
// which RunExecutions chain together into one Test Case card and which
// execution is "the previous one" tried as a baseline candidate
// (ComparisonService.selectBaselineSnapshot). Does NOT by itself decide
// whether a comparison is safe or what it shows — that is Comparison
// Eligibility/Safety (concept B, comparison-eligibility.util.ts +
// comparison-input-gate.util.ts) and Output Comparison (concept C,
// comparison-output-gate.util.ts) respectively.
//
// Deliberately composed of:
//   - apiId + environmentId: the API/Environment pairing under test.
//   - authType + testAccountId: "what identity is this test run as" — but
//     never authContextVersion/authContextKey (computeAuthContextKey). An
//     Authentication Configuration edit or secret rotation bumps
//     context_version but is an implementation-level fact, not a change to
//     "what is being tested" — including it here would silently fork a
//     user's continuous history every time an admin edits auth config.
//   - the raw submitted Request Input (pathValues/queryValues/headerValues/
//     bodyValue, exactly as a CreateRunDto execution carries them) — not the
//     resolved URL. Immune to a later edit of the API's own Full URL
//     mapping, and matches how a user actually thinks about "the same test"
//     (e.g. "projectId=123, screen=HOME"), not an implementation detail of
//     how that input gets resolved into a wire request.
//
// Authorization is excluded from headerValues case-insensitively, mirroring
// comparison-input-gate.util.ts's excludeAuthorizationHeader: a Login Form
// Test Account's Authorization value is re-authenticated fresh per dispatch
// and never part of "what test case this is" (testAccountId above already
// captures the account identity).
//
// Each record's keys are sorted before hashing so key insertion order never
// changes the key (a Record's own iteration order is otherwise
// insertion-dependent and has no bearing on "is this the same input").
export interface TestCaseIdentityInput {
  apiId: string;
  environmentId: string;
  authType: string;
  testAccountId: string | null;
  pathValues: Record<string, string>;
  queryValues: Record<string, string>;
  headerValues: Record<string, string>;
  bodyValue: string;
}

const COMPONENT_SEPARATOR = "\u0000";

function normalizeRecord(record: Record<string, string>, excludeKeyLower?: string): string {
  const keys = Object.keys(record)
    .filter((key) => !excludeKeyLower || key.toLowerCase() !== excludeKeyLower)
    .sort();
  return keys.map((key) => `${key}=${record[key]}`).join("&");
}

export function computeTestCaseKey(input: TestCaseIdentityInput): string {
  const components = [
    input.apiId,
    input.environmentId,
    input.authType,
    input.testAccountId ?? "",
    normalizeRecord(input.pathValues),
    normalizeRecord(input.queryValues),
    normalizeRecord(input.headerValues, "authorization"),
    input.bodyValue,
  ];
  return createHash("sha256").update(components.join(COMPONENT_SEPARATOR)).digest("hex");
}
