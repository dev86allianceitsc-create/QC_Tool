// Hand-rolled JSON tokenizer that preserves each node's exact raw source
// substring instead of JSON.parse's already-decoded value, so leaf
// comparison in the OUTPUT/INPUT body diff (REQ-CMP-008/010) can be a
// raw-lexeme string comparison rather than a parsed-value comparison — the
// only way to correctly distinguish `1` from `1.0`/`1e0`/`1E+0`, or the same
// number written with different surrounding whitespace. apps/api has no
// existing JSON-with-source-position dependency (no jsonc-parser,
// json-source-map, etc. — checked in package.json), so this file exists to
// fill that one narrow gap rather than pulling in a general-purpose parser.
//
// Contract: this is a SECONDARY, Detail-only diagnosis step. The primary
// SAME/DIFFERENT signal always comes from a full raw-byte comparison done by
// the caller before this is ever invoked (REQ-CMP-007/010/017's raw-strict
// requirement) — this module only ever runs to annotate a body pair already
// known to differ at the byte level. Use tryParseJsonRaw, which validates
// well-formedness with the native JSON.parse first: this hand-rolled walker
// itself assumes valid JSON grammar and does NOT attempt error recovery or
// report parse errors. Callers must treat any exception it throws (an
// unanticipated edge case, not a validation failure — those are already
// filtered out by the JSON.parse pre-check) as a signal to fall back to a
// whole-body RAW_BYTES finding, the same fallback already used for
// non-JSON/invalid-JSON bodies.
export type JsonNodeKind = "object" | "array" | "string" | "number" | "true" | "false" | "null";

export interface JsonNode {
  kind: JsonNodeKind;
  // Exact raw source substring for this node, e.g. `"abc\n"`, `1.0e5`, `true`.
  raw: string;
  // JS string (UTF-16 code unit) indices into the text passed to
  // parseJsonRaw/tryParseJsonRaw — NOT byte offsets. A caller that needs a
  // byte offset (comparison_findings.a_byte_offset/a_byte_length) must
  // convert with Buffer.byteLength(text.slice(0, index), "utf-8"), since a
  // body may contain multi-byte UTF-8 characters.
  start: number;
  end: number;
  // "object" only. Keyed by the decoded property name (not the raw key
  // lexeme) — two differently-escaped spellings of the same key (e.g. "a"
  // and "a") are the same property per JSON semantics, so key identity
  // must use the decoded string. Duplicate keys keep only the last
  // occurrence, matching JSON.parse's own last-write-wins behavior.
  entries?: Map<string, JsonNode>;
  // "array" only, in source order — array comparison is always strictly
  // positional (RS-CMP-008-05/09), never order-normalized.
  items?: JsonNode[];
}

// Validates well-formedness with the native JSON.parse first (authoritative
// and battle-tested for that one job), then re-walks the same text with the
// raw-lexeme-preserving tokenizer below. Returns null when the text is not
// valid JSON — the caller's signal to fall back to whole-body RAW_BYTES.
export function tryParseJsonRaw(text: string): JsonNode | null {
  try {
    JSON.parse(text);
  } catch {
    return null;
  }
  return parseJsonRaw(text);
}

// Parses `text` as a single JSON value, assuming it is already known to be
// well-formed (see tryParseJsonRaw). Throws if it is not.
export function parseJsonRaw(text: string): JsonNode {
  let pos = 0;

  function skipWhitespace(): void {
    while (pos < text.length) {
      const ch = text[pos];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        pos++;
      } else {
        break;
      }
    }
  }

  function parseValue(): JsonNode {
    skipWhitespace();
    const ch = text[pos];
    if (ch === "{") return parseObject();
    if (ch === "[") return parseArray();
    if (ch === '"') return parseString();
    if (ch === "t" || ch === "f") return parseBoolean();
    if (ch === "n") return parseNull();
    return parseNumber();
  }

  function parseObject(): JsonNode {
    const start = pos;
    pos++; // consume '{'
    const entries = new Map<string, JsonNode>();
    skipWhitespace();
    if (text[pos] === "}") {
      pos++;
      return { kind: "object", raw: text.slice(start, pos), start, end: pos, entries };
    }
    for (;;) {
      skipWhitespace();
      const keyNode = parseString();
      const key = JSON.parse(keyNode.raw) as string;
      skipWhitespace();
      pos++; // consume ':'
      const value = parseValue();
      entries.set(key, value);
      skipWhitespace();
      if (text[pos] === ",") {
        pos++;
        continue;
      }
      break;
    }
    skipWhitespace();
    pos++; // consume '}'
    return { kind: "object", raw: text.slice(start, pos), start, end: pos, entries };
  }

  function parseArray(): JsonNode {
    const start = pos;
    pos++; // consume '['
    const items: JsonNode[] = [];
    skipWhitespace();
    if (text[pos] === "]") {
      pos++;
      return { kind: "array", raw: text.slice(start, pos), start, end: pos, items };
    }
    for (;;) {
      items.push(parseValue());
      skipWhitespace();
      if (text[pos] === ",") {
        pos++;
        continue;
      }
      break;
    }
    skipWhitespace();
    pos++; // consume ']'
    return { kind: "array", raw: text.slice(start, pos), start, end: pos, items };
  }

  function parseString(): JsonNode {
    skipWhitespace();
    const start = pos;
    pos++; // consume opening quote
    while (text[pos] !== '"') {
      if (text[pos] === "\\") {
        pos += 2;
      } else {
        pos++;
      }
    }
    pos++; // consume closing quote
    return { kind: "string", raw: text.slice(start, pos), start, end: pos };
  }

  function parseNumber(): JsonNode {
    const start = pos;
    if (text[pos] === "-") pos++;
    while (pos < text.length && text[pos] >= "0" && text[pos] <= "9") pos++;
    if (text[pos] === ".") {
      pos++;
      while (pos < text.length && text[pos] >= "0" && text[pos] <= "9") pos++;
    }
    if (text[pos] === "e" || text[pos] === "E") {
      pos++;
      if (text[pos] === "+" || (text[pos] as string) === "-") pos++;
      while (pos < text.length && text[pos] >= "0" && text[pos] <= "9") pos++;
    }
    return { kind: "number", raw: text.slice(start, pos), start, end: pos };
  }

  function parseBoolean(): JsonNode {
    const start = pos;
    if (text.startsWith("true", pos)) {
      pos += 4;
      return { kind: "true", raw: "true", start, end: pos };
    }
    pos += 5;
    return { kind: "false", raw: "false", start, end: pos };
  }

  function parseNull(): JsonNode {
    const start = pos;
    pos += 4;
    return { kind: "null", raw: "null", start, end: pos };
  }

  return parseValue();
}
