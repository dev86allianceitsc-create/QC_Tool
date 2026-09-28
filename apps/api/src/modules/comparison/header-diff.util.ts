import type { HeaderPair } from "../run/run-dispatch.util";
import { ComparisonComponent, ComparisonDifferenceKind, COMPARISON_RULE_CODES } from "./comparison-finding.constants";
import type { ComparisonFindingInput } from "./comparison.service";

// Case-insensitive per-name comparison of two ordered HeaderPair lists
// (REQ-CMP-007 RS-CMP-007-06: repeated values sharing a header name are
// compared as an ORDERED sequence, never a set). `component` selects both
// the finding's component and its phase (REQUEST_HEADER -> INPUT,
// RESPONSE_HEADER -> OUTPUT) so a caller cannot pass a mismatched pair.
//
// ORDER is reported only when the exact same multiset of values appears in a
// different sequence — this repo's one designated use of ORDER (JSON arrays
// are always strictly positional, never order-normalized, so they use
// LENGTH/VALUE/PRESENCE only). A changed repeat count is always LENGTH: once
// the two sequences have different lengths they can no longer be aligned
// position-by-position at all, so LENGTH takes priority over ORDER/VALUE.
// Anything else (equal length, not a pure reorder) is VALUE.
//
// Unlike the JSON array walk (B1/B3), a LENGTH mismatch here does NOT recurse
// into the shared index range or emit PRESENCE for the extra tail — header
// value lists are a narrow, flat, typically single-valued list, so one
// summary finding per header name is sufficient detail. Deliberate scope
// difference from the JSON body walk, not an oversight.
export function compareHeaderPairs(aHeaders: readonly HeaderPair[], bHeaders: readonly HeaderPair[], component: Extract<ComparisonComponent, "REQUEST_HEADER" | "RESPONSE_HEADER">): ComparisonFindingInput[] {
  const phase: "INPUT" | "OUTPUT" = component === "REQUEST_HEADER" ? "INPUT" : "OUTPUT";
  const aByName = groupByLowerName(aHeaders);
  const bByName = groupByLowerName(bHeaders);

  const names = new Map<string, true>();
  for (const name of aByName.keys()) names.set(name, true);
  for (const name of bByName.keys()) names.set(name, true);

  const findings: ComparisonFindingInput[] = [];
  for (const name of names.keys()) {
    const aValues = aByName.get(name);
    const bValues = bByName.get(name);

    if (!aValues || !bValues) {
      const presentSide = aValues ? "A" : "B";
      findings.push(finding(phase, component, "PRESENCE", name, COMPARISON_RULE_CODES.HEADER_PRESENCE, `Header "${name}" present only on side ${presentSide}`));
      continue;
    }

    if (aValues.length !== bValues.length) {
      findings.push(finding(phase, component, "LENGTH", name, COMPARISON_RULE_CODES.HEADER_LENGTH, `Header "${name}" repeat count differs (A=${aValues.length}, B=${bValues.length})`));
      continue;
    }

    if (aValues.every((v, i) => v === bValues[i])) {
      continue;
    }

    if (isPermutation(aValues, bValues)) {
      findings.push(finding(phase, component, "ORDER", name, COMPARISON_RULE_CODES.HEADER_ORDER, `Header "${name}" values reordered`));
      continue;
    }

    findings.push(finding(phase, component, "VALUE", name, COMPARISON_RULE_CODES.HEADER_VALUE, `Header "${name}" value differs`));
  }
  return findings;
}

function finding(phase: "INPUT" | "OUTPUT", component: ComparisonComponent, differenceKind: ComparisonDifferenceKind, locationPath: string, ruleCode: string, safeSummary: string): ComparisonFindingInput {
  return { phase, component, differenceKind, locationPath, ruleCode, safeSummary };
}

// Groups by lowercased header name (case-insensitive per RFC 7230 §3.2),
// preserving each value's original relative order — the array a header name
// maps to IS the ordered sequence RS-CMP-007-06 requires comparing.
function groupByLowerName(headers: readonly HeaderPair[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { key, value } of headers) {
    const name = key.toLowerCase();
    const list = map.get(name);
    if (list) {
      list.push(value);
    } else {
      map.set(name, [value]);
    }
  }
  return map;
}

// Same multiset of values regardless of position. Only called once lengths
// are already confirmed equal.
function isPermutation(a: readonly string[], b: readonly string[]): boolean {
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}
