import { ComparisonComponent, COMPARISON_RULE_CODES } from "./comparison-finding.constants";
import type { ComparisonFindingInput } from "./comparison.service";
import { JsonNode, tryParseJsonRaw } from "./json-raw-tokenizer.util";

// Body comparison (REQ-CMP-007/008/010). Gate code (comparison-input-gate.util.ts
// / comparison-output-gate.util.ts) should call findBodyDifferences below, not
// this function directly: compareBodies invoke this ONLY once a prior full
// raw-byte comparison has already found the two bodies to differ (see
// json-raw-tokenizer.util.ts's own module doc comment: raw bytes are always
// the primary SAME/DIFFERENT signal) — this function never re-decides
// SAME/DIFFERENT, it only tries to produce a richer structural diagnosis of
// an already-known difference. It always falls back to a single whole-body
// RAW_BYTES finding when that richer diagnosis is not possible: non-JSON
// text, invalid JSON on either side, binary/multipart content (decoding
// never throws — Buffer's UTF-8 decoder substitutes U+FFFD for invalid
// sequences — so binary content simply fails the JSON.parse check like any
// other non-JSON text), or any unexpected exception during the structural
// walk (json-raw-tokenizer.util.ts's documented exception contract).
export function compareBodies(aBytes: Uint8Array, bBytes: Uint8Array, component: Extract<ComparisonComponent, "REQUEST_BODY" | "RESPONSE_BODY">): ComparisonFindingInput[] {
  const phase = derivePhase(component);

  try {
    const aText = Buffer.from(aBytes).toString("utf-8");
    const bText = Buffer.from(bBytes).toString("utf-8");
    const aRoot = tryParseJsonRaw(aText);
    const bRoot = tryParseJsonRaw(bText);
    if (aRoot && bRoot) {
      const findings: ComparisonFindingInput[] = [];
      walk(aRoot, bRoot, "$", phase, component, aText, bText, findings);
      return findings;
    }
  } catch {
    // Falls through to the raw-bytes finding below.
  }

  return [rawBytesFinding(phase, component, aBytes.length, bBytes.length)];
}

// Safe, unconditional entry point for gate code (INPUT/OUTPUT) to call: unlike
// compareBodies above, this never assumes the caller already knows the two
// bodies differ. It performs the raw-byte-equality check that compareBodies's
// own doc comment requires of its caller, then only escalates to compareBodies
// once that check has actually found a difference — calling compareBodies
// directly on two byte-identical non-JSON/binary bodies would otherwise
// produce a false RAW_BYTES finding (compareBodies' fallback path triggers
// unconditionally whenever either side fails JSON.parse, with no awareness of
// whether the bytes are equal).
//
// Accepts null on either side — schema.prisma documents null as one of three
// distinct, legitimate SnapshotPayload body states (NULL = absent, zero-length
// = empty, 4-byte "null" = JSON null content), e.g. a GET request's absent
// body or a 204 response's absent body. Exactly one side null is therefore a
// real, reportable PRESENCE difference, not a data-completeness gap (contrast
// with null request/response HEADERS, which comparison-eligibility.util.ts
// gates on instead because that null means "never recorded", not "confirmed
// absent").
export function findBodyDifferences(aBytes: Uint8Array | null, bBytes: Uint8Array | null, component: Extract<ComparisonComponent, "REQUEST_BODY" | "RESPONSE_BODY">): ComparisonFindingInput[] {
  if (aBytes === null && bBytes === null) {
    return [];
  }
  if (aBytes === null || bBytes === null) {
    return [bodyPresenceFinding(component, aBytes, bBytes)];
  }
  if (Buffer.from(aBytes).equals(Buffer.from(bBytes))) {
    return [];
  }
  return compareBodies(aBytes, bBytes, component);
}

function bodyPresenceFinding(component: Extract<ComparisonComponent, "REQUEST_BODY" | "RESPONSE_BODY">, aBytes: Uint8Array | null, bBytes: Uint8Array | null): ComparisonFindingInput {
  const presentSide = aBytes !== null ? "A" : "B";
  return {
    phase: derivePhase(component),
    component,
    differenceKind: "PRESENCE",
    locationPath: null,
    aByteOffset: aBytes !== null ? 0n : null,
    aByteLength: aBytes !== null ? BigInt(aBytes.byteLength) : null,
    bByteOffset: bBytes !== null ? 0n : null,
    bByteLength: bBytes !== null ? BigInt(bBytes.byteLength) : null,
    ruleCode: COMPARISON_RULE_CODES.BODY_PRESENCE,
    safeSummary: `Body present only on side ${presentSide}`,
  };
}

function derivePhase(component: Extract<ComparisonComponent, "REQUEST_BODY" | "RESPONSE_BODY">): "INPUT" | "OUTPUT" {
  return component === "REQUEST_BODY" ? "INPUT" : "OUTPUT";
}

function rawBytesFinding(phase: "INPUT" | "OUTPUT", component: ComparisonComponent, aByteLength: number, bByteLength: number): ComparisonFindingInput {
  return {
    phase,
    component,
    differenceKind: "RAW_BYTES",
    locationPath: null,
    aByteOffset: 0n,
    aByteLength: BigInt(aByteLength),
    bByteOffset: 0n,
    bByteLength: BigInt(bByteLength),
    ruleCode: COMPARISON_RULE_CODES.BODY_RAW_BYTES,
    safeSummary: "Body differs (raw byte comparison; structural diagnosis unavailable)",
  };
}

// Structural walk over two already-parsed JsonNode trees, assumed to
// correspond to the same JSON Pointer-shaped document. `path` is a
// human-readable, display-only location (JSONPath-flavored: "$", "$.a",
// "$.a[3].b") — it is NOT escaped for keys containing "." or "[", a known
// limitation acceptable because locationPath is a safe diagnostic string for
// display, never re-parsed back into a path by any consumer in this repo.
//
// Recursion depth tracks JSON nesting depth 1:1 with parseJsonRaw (B1) — a
// pathologically deep body can in principle exhaust the call stack here just
// as it could in parseJsonRaw itself; the resulting RangeError is caught by
// compareBodies's try/catch above and degrades to the same RAW_BYTES
// fallback already used for non-JSON bodies, per json-raw-tokenizer.util.ts's
// documented "any exception" contract. Not otherwise capped or optimized
// (e.g. the repeated `Buffer.byteLength(text.slice(0, i))` prefix scan in
// byteOffsetOf is O(n) per call, not O(1)) — this is a Detail-only diagnostic
// path over typical API body sizes, not a hot path worth the extra
// complexity of a surrogate-pair-safe prefix index.
function walk(aNode: JsonNode, bNode: JsonNode, path: string, phase: "INPUT" | "OUTPUT", component: ComparisonComponent, aText: string, bText: string, findings: ComparisonFindingInput[]): void {
  if (aNode.kind !== bNode.kind) {
    findings.push(nodeFinding(phase, component, "TYPE", path, COMPARISON_RULE_CODES.JSON_TYPE, `Type differs at ${path} (A=${aNode.kind}, B=${bNode.kind})`, aNode, bNode, aText, bText));
    return;
  }

  if (aNode.kind === "object") {
    const aEntries = aNode.entries!;
    const bEntries = bNode.entries!;
    const keys = new Map<string, true>();
    for (const key of aEntries.keys()) keys.set(key, true);
    for (const key of bEntries.keys()) keys.set(key, true);

    for (const key of keys.keys()) {
      const childPath = `${path}.${key}`;
      const aChild = aEntries.get(key);
      const bChild = bEntries.get(key);
      if (!aChild || !bChild) {
        findings.push(presenceFinding(phase, component, childPath, aChild, bChild, aText, bText));
        continue;
      }
      walk(aChild, bChild, childPath, phase, component, aText, bText, findings);
    }
    return;
  }

  if (aNode.kind === "array") {
    const aItems = aNode.items!;
    const bItems = bNode.items!;
    const shared = Math.min(aItems.length, bItems.length);

    if (aItems.length !== bItems.length) {
      findings.push(nodeFinding(phase, component, "LENGTH", path, COMPARISON_RULE_CODES.JSON_LENGTH, `Array length differs at ${path} (A=${aItems.length}, B=${bItems.length})`, aNode, bNode, aText, bText));
    }

    for (let i = 0; i < shared; i++) {
      walk(aItems[i], bItems[i], `${path}[${i}]`, phase, component, aText, bText, findings);
    }

    const aLonger = aItems.length > bItems.length;
    const longer = aLonger ? aItems : bItems;
    for (let i = shared; i < longer.length; i++) {
      findings.push(presenceFinding(phase, component, `${path}[${i}]`, aLonger ? longer[i] : undefined, aLonger ? undefined : longer[i], aText, bText));
    }
    return;
  }

  // Leaf: string | number | true | false | null. Raw-lexeme comparison
  // (never parsed-value comparison) is what correctly distinguishes `1` from
  // `1.0`/`1e0`/`1E+0` (REQ-CMP-010) — see json-raw-tokenizer.util.ts.
  if (aNode.raw !== bNode.raw) {
    findings.push(nodeFinding(phase, component, "VALUE", path, COMPARISON_RULE_CODES.JSON_VALUE, `Value differs at ${path}`, aNode, bNode, aText, bText));
  }
}

// TYPE/LENGTH/VALUE: both sides exist and are being compared against each
// other, so both byte spans are always populated.
function nodeFinding(phase: "INPUT" | "OUTPUT", component: ComparisonComponent, differenceKind: "TYPE" | "LENGTH" | "VALUE", path: string, ruleCode: string, safeSummary: string, aNode: JsonNode, bNode: JsonNode, aText: string, bText: string): ComparisonFindingInput {
  return {
    phase,
    component,
    differenceKind,
    locationPath: path,
    aByteOffset: BigInt(byteOffsetOf(aText, aNode.start)),
    aByteLength: BigInt(Buffer.byteLength(aNode.raw, "utf-8")),
    bByteOffset: BigInt(byteOffsetOf(bText, bNode.start)),
    bByteLength: BigInt(Buffer.byteLength(bNode.raw, "utf-8")),
    aValueKind: aNode.kind,
    bValueKind: bNode.kind,
    ruleCode,
    safeSummary,
  };
}

// PRESENCE: a key/item exists on exactly one side — exactly one of
// aNode/bNode is defined.
function presenceFinding(phase: "INPUT" | "OUTPUT", component: ComparisonComponent, path: string, aNode: JsonNode | undefined, bNode: JsonNode | undefined, aText: string, bText: string): ComparisonFindingInput {
  const presentSide = aNode ? "A" : "B";
  return {
    phase,
    component,
    differenceKind: "PRESENCE",
    locationPath: path,
    aByteOffset: aNode ? BigInt(byteOffsetOf(aText, aNode.start)) : null,
    aByteLength: aNode ? BigInt(Buffer.byteLength(aNode.raw, "utf-8")) : null,
    bByteOffset: bNode ? BigInt(byteOffsetOf(bText, bNode.start)) : null,
    bByteLength: bNode ? BigInt(Buffer.byteLength(bNode.raw, "utf-8")) : null,
    aValueKind: aNode ? aNode.kind : null,
    bValueKind: bNode ? bNode.kind : null,
    ruleCode: COMPARISON_RULE_CODES.JSON_PRESENCE,
    safeSummary: `Present only on side ${presentSide} at ${path}`,
  };
}

// Converts a JS string (UTF-16 code unit) index into a UTF-8 byte offset.
// Always exact for indices that fall on a JSON token boundary (as
// parseJsonRaw's start/end always do): JSON only allows non-ASCII characters
// inside a quoted string body, strictly between that string's own open/close
// quotes, so no token boundary can ever land inside a surrogate pair.
function byteOffsetOf(text: string, charIndex: number): number {
  return Buffer.byteLength(text.slice(0, charIndex), "utf-8");
}
