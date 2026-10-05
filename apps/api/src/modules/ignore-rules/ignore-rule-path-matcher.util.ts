// Output Ignore Rules — narrow, purpose-built path matcher. Matches an
// IgnoreRule.path against ComparisonFinding-shaped locationPath values
// produced only by body-diff.util.ts, in its exact "$", "$.a", "$.a[3].b"
// display format (see that file's own doc comment: never escaped, never
// re-parsed elsewhere in the repo). Deliberately NOT a general JSONPath
// engine (explicit spec scope) — supports exactly two constructs:
//   - a literal dotted/indexed path ($.Data.Status, $.Data[0].id)
//   - a single-level array wildcard ($.Data[*].updatedAt), matching any
//     numeric index at that position (body-diff.util.ts always emits a
//     concrete numeric index, e.g. $.Data[3].updatedAt, never "[*]" itself)
//
// Compilation splits the rule path on the literal "[*]" marker, escapes
// every regex-special character in each literal segment, and rejoins the
// segments with \[\d+\] (exactly one array index), anchored with ^...$ so
// "$.Data.Status" can never partially match "$.Data.StatusCode".
const WILDCARD = "[*]";

export function compileIgnorePathPattern(rulePath: string): RegExp {
  const segments = rulePath.split(WILDCARD).map(escapeRegExp);
  return new RegExp(`^${segments.join("\\[\\d+\\]")}$`);
}

export function matchesIgnorePath(rulePath: string, locationPath: string): boolean {
  return compileIgnorePathPattern(rulePath).test(locationPath);
}

function escapeRegExp(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface IgnoreRuleRef {
  ignoreRuleId: string;
  scope: string;
  path: string;
}

export interface AppliedIgnoreRuleRecord {
  ignoreRuleId: string;
  scope: string;
  path: string;
  suppressedFindingCount: number;
}

export interface IgnorableFinding {
  component: string;
  // Optional (not just nullable) to match ComparisonFindingInput's own
  // `locationPath?: string | null` field shape exactly, so engine callers
  // can pass ComparisonFindingInput[] straight through with no cast.
  locationPath?: string | null;
}

// Only RESPONSE_BODY findings with a non-null locationPath are ever
// ignorable (spec: "Affects Comparison OUTPUT-gate body-diff findings only")
// — HTTP_STATUS and RESPONSE_HEADER findings always pass through unchanged,
// regardless of their own locationPath shape (RESPONSE_HEADER findings carry
// the header name as locationPath, e.g. "content-type" — never a "$"-rooted
// JSON path, so it would never match a rule's pattern anyway, but the
// component check makes that an explicit guarantee rather than an accident
// of string shape).
//
// Returns the findings NOT suppressed by any active rule, plus one
// AppliedIgnoreRuleRecord per rule that actually suppressed at least one
// finding (never a record for a rule that matched nothing) — the audit trail
// persisted onto the attempt's applied_rule_manifest (see
// comparison.service.ts's completeAttempt).
export function filterIgnoredFindings<F extends IgnorableFinding>(
  findings: readonly F[],
  activeRules: readonly IgnoreRuleRef[],
): { remaining: F[]; applied: AppliedIgnoreRuleRecord[] } {
  if (activeRules.length === 0 || findings.length === 0) {
    return { remaining: [...findings], applied: [] };
  }

  const compiled = activeRules.map((rule) => ({ rule, pattern: compileIgnorePathPattern(rule.path) }));
  const suppressedCounts = new Map<string, number>();
  const remaining: F[] = [];

  for (const finding of findings) {
    if (finding.component !== "RESPONSE_BODY" || finding.locationPath == null) {
      remaining.push(finding);
      continue;
    }

    const match = compiled.find(({ pattern }) => pattern.test(finding.locationPath as string));
    if (match) {
      suppressedCounts.set(match.rule.ignoreRuleId, (suppressedCounts.get(match.rule.ignoreRuleId) ?? 0) + 1);
    } else {
      remaining.push(finding);
    }
  }

  const applied: AppliedIgnoreRuleRecord[] = compiled
    .filter(({ rule }) => suppressedCounts.has(rule.ignoreRuleId))
    .map(({ rule }) => ({
      ignoreRuleId: rule.ignoreRuleId,
      scope: rule.scope,
      path: rule.path,
      suppressedFindingCount: suppressedCounts.get(rule.ignoreRuleId)!,
    }));

  return { remaining, applied };
}
