import { JsonNode, parseJsonRaw, tryParseJsonRaw } from "./json-raw-tokenizer.util";

function obj(node: JsonNode): Map<string, JsonNode> {
  if (node.kind !== "object" || !node.entries) {
    throw new Error(`expected object node, got ${node.kind}`);
  }
  return node.entries;
}

function arr(node: JsonNode): JsonNode[] {
  if (node.kind !== "array" || !node.items) {
    throw new Error(`expected array node, got ${node.kind}`);
  }
  return node.items;
}

describe("parseJsonRaw", () => {
  it("preserves the raw lexeme for each leaf kind", () => {
    const root = parseJsonRaw('{"s":"hello","n":42,"t":true,"f":false,"z":null}');
    const entries = obj(root);
    expect(entries.get("s")?.kind).toBe("string");
    expect(entries.get("s")?.raw).toBe('"hello"');
    expect(entries.get("n")?.kind).toBe("number");
    expect(entries.get("n")?.raw).toBe("42");
    expect(entries.get("t")?.kind).toBe("true");
    expect(entries.get("t")?.raw).toBe("true");
    expect(entries.get("f")?.kind).toBe("false");
    expect(entries.get("f")?.raw).toBe("false");
    expect(entries.get("z")?.kind).toBe("null");
    expect(entries.get("z")?.raw).toBe("null");
  });

  it("distinguishes numeric raw lexemes that are numerically equal (REQ-CMP-010)", () => {
    const variants = ["1", "1.0", "1e0", "1E+0", "10e-1"];
    const raws = variants.map((v) => parseJsonRaw(v).raw);
    expect(new Set(raws).size).toBe(new Set(variants).size);
    for (const v of variants) {
      expect(parseJsonRaw(v).raw).toBe(v);
    }
  });

  it("excludes surrounding insignificant whitespace from a value's raw span", () => {
    const root = parseJsonRaw('{ "a" : 1 , "b" : 2 }');
    const entries = obj(root);
    expect(entries.get("a")?.raw).toBe("1");
    expect(entries.get("b")?.raw).toBe("2");
  });

  it("keeps array items in source order and supports nested structures", () => {
    const root = parseJsonRaw('{"list":[1,"two",[3,4],{"k":"v"}]}');
    const items = arr(obj(root).get("list")!);
    expect(items.map((n) => n.kind)).toEqual(["number", "string", "array", "object"]);
    expect(items[0].raw).toBe("1");
    expect(items[1].raw).toBe('"two"');
    expect(arr(items[2]).map((n) => n.raw)).toEqual(["3", "4"]);
    expect(obj(items[3]).get("k")?.raw).toBe('"v"');
  });

  it("every node's raw text matches text.slice(start, end)", () => {
    const text = '{"a":[1,2,{"b":true}],"c":"x\\"y"}';
    const root = parseJsonRaw(text);
    function walk(node: JsonNode): void {
      expect(text.slice(node.start, node.end)).toBe(node.raw);
      if (node.entries) {
        for (const child of node.entries.values()) walk(child);
      }
      if (node.items) {
        for (const child of node.items) walk(child);
      }
    }
    walk(root);
  });

  it("keeps only the last value for a duplicate key, matching JSON.parse", () => {
    const root = parseJsonRaw('{"a":1,"a":2}');
    const entries = obj(root);
    expect(entries.size).toBe(1);
    expect(entries.get("a")?.raw).toBe("2");
  });

  it("indexes object entries by decoded key, not raw key lexeme", () => {
    const root = parseJsonRaw('{"a\\u0062c":1}');
    const entries = obj(root);
    expect(entries.has("abc")).toBe(true);
    expect(entries.get("abc")?.raw).toBe("1");
  });

  it("preserves escaped characters inside a string's raw lexeme", () => {
    const root = parseJsonRaw('"a\\"b\\\\c"');
    expect(root.kind).toBe("string");
    expect(root.raw).toBe('"a\\"b\\\\c"');
  });

  it("handles an empty object and an empty array", () => {
    expect(obj(parseJsonRaw("{}")).size).toBe(0);
    expect(arr(parseJsonRaw("[]")).length).toBe(0);
  });
});

describe("tryParseJsonRaw", () => {
  it("returns null for invalid JSON instead of throwing", () => {
    expect(tryParseJsonRaw("{not valid")).toBeNull();
    expect(tryParseJsonRaw("")).toBeNull();
    expect(tryParseJsonRaw("<xml/>")).toBeNull();
  });

  it("returns an equivalent tree to parseJsonRaw for valid JSON", () => {
    const text = '{"a":1,"b":[true,null]}';
    expect(tryParseJsonRaw(text)).toEqual(parseJsonRaw(text));
  });
});
