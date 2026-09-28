import { compareBodies, findBodyDifferences } from "./body-diff.util";

function bytes(text: string): Uint8Array {
  return Buffer.from(text, "utf-8");
}

describe("compareBodies", () => {
  it("returns no findings for two structurally identical bodies", () => {
    const text = '{"list":[],"nested":{"a":null,"b":""}}';
    expect(compareBodies(bytes(text), bytes(text), "REQUEST_BODY")).toEqual([]);
  });

  it("derives phase INPUT for REQUEST_BODY and OUTPUT for RESPONSE_BODY", () => {
    const a = bytes('{"n":1}');
    const b = bytes('{"n":2}');
    expect(compareBodies(a, b, "REQUEST_BODY")[0]).toMatchObject({ phase: "INPUT", component: "REQUEST_BODY" });
    expect(compareBodies(a, b, "RESPONSE_BODY")[0]).toMatchObject({ phase: "OUTPUT", component: "RESPONSE_BODY" });
  });

  describe("falls back to a whole-body RAW_BYTES finding", () => {
    it("when neither side is valid JSON", () => {
      const a = bytes("plain text body");
      const b = bytes("a different plain text body");
      const findings = compareBodies(a, b, "RESPONSE_BODY");
      expect(findings).toEqual([
        expect.objectContaining({
          phase: "OUTPUT",
          component: "RESPONSE_BODY",
          differenceKind: "RAW_BYTES",
          locationPath: null,
          aByteOffset: 0n,
          aByteLength: BigInt(a.length),
          bByteOffset: 0n,
          bByteLength: BigInt(b.length),
        }),
      ]);
    });

    it("when only one side is valid JSON", () => {
      const a = bytes('{"a":1}');
      const b = bytes("not json at all");
      const findings = compareBodies(a, b, "REQUEST_BODY");
      expect(findings).toHaveLength(1);
      expect(findings[0].differenceKind).toBe("RAW_BYTES");
    });

    it("for binary content that does not decode into valid JSON", () => {
      const a = new Uint8Array([0x00, 0x01, 0xff, 0xfe, 0x10, 0x20]);
      const b = new Uint8Array([0x00, 0x02, 0xaa, 0xbb, 0x10, 0x20, 0x30]);
      const findings = compareBodies(a, b, "RESPONSE_BODY");
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ differenceKind: "RAW_BYTES", aByteLength: BigInt(a.length), bByteLength: BigInt(b.length) });
    });
  });

  describe("TYPE", () => {
    it("is reported at the root when the two bodies are different JSON shapes, without recursing further", () => {
      const findings = compareBodies(bytes('{"a":1}'), bytes("[1,2,3]"), "REQUEST_BODY");
      expect(findings).toEqual([expect.objectContaining({ locationPath: "$", differenceKind: "TYPE" })]);
    });

    it("is reported for a nested field whose kind changes", () => {
      const findings = compareBodies(bytes('{"a":{"nested":1}}'), bytes('{"a":"not an object"}'), "REQUEST_BODY");
      expect(findings).toEqual([expect.objectContaining({ locationPath: "$.a", differenceKind: "TYPE" })]);
    });
  });

  describe("PRESENCE", () => {
    it("is reported with aValueKind set and bValueKind null when a key exists only on side A", () => {
      const findings = compareBodies(bytes('{"a":1,"extra":true}'), bytes('{"a":1}'), "REQUEST_BODY");
      expect(findings).toEqual([expect.objectContaining({ locationPath: "$.extra", differenceKind: "PRESENCE", aValueKind: "true", bValueKind: null, bByteOffset: null, bByteLength: null })]);
    });

    it("is reported with bValueKind set and aValueKind null when a key exists only on side B", () => {
      const findings = compareBodies(bytes('{"a":1}'), bytes('{"a":1,"extra":true}'), "REQUEST_BODY");
      expect(findings).toEqual([expect.objectContaining({ locationPath: "$.extra", differenceKind: "PRESENCE", bValueKind: "true", aValueKind: null, aByteOffset: null, aByteLength: null })]);
    });
  });

  describe("VALUE", () => {
    it("distinguishes numerically-equal-but-differently-written numbers (REQ-CMP-010)", () => {
      const findings = compareBodies(bytes('{"n":1}'), bytes('{"n":1.0}'), "REQUEST_BODY");
      expect(findings).toEqual([expect.objectContaining({ locationPath: "$.n", differenceKind: "VALUE", aValueKind: "number", bValueKind: "number" })]);
    });

    it("computes byte offsets in UTF-8 bytes, not UTF-16 code units, across a preceding multi-byte character", () => {
      const aText = '{"a":"€","b":1}';
      const bText = '{"a":"€","b":2}';
      const findings = compareBodies(bytes(aText), bytes(bText), "REQUEST_BODY");
      expect(findings).toHaveLength(1);
      const expectedOffset = BigInt(Buffer.byteLength('{"a":"€","b":', "utf-8"));
      expect(findings[0]).toMatchObject({ locationPath: "$.b", differenceKind: "VALUE", aByteOffset: expectedOffset, bByteOffset: expectedOffset, aByteLength: 1n, bByteLength: 1n });
    });
  });

  describe("JSON arrays", () => {
    it("reports LENGTH for a length mismatch, still recursing the shared range and PRESENCE for the extra tail", () => {
      const findings = compareBodies(bytes('{"list":[1,2,3]}'), bytes('{"list":[1,9]}'), "RESPONSE_BODY");
      const byPath = new Map(findings.map((f) => [f.locationPath, f.differenceKind]));
      expect(byPath.get("$.list")).toBe("LENGTH");
      expect(byPath.get("$.list[1]")).toBe("VALUE");
      expect(byPath.get("$.list[2]")).toBe("PRESENCE");
      expect(findings).toHaveLength(3);
    });

    it("are always strictly positional, never reporting ORDER for a reordered array", () => {
      const findings = compareBodies(bytes('{"list":[1,2,3]}'), bytes('{"list":[3,2,1]}'), "REQUEST_BODY");
      expect(findings.some((f) => f.differenceKind === "ORDER")).toBe(false);
      expect(findings.map((f) => f.locationPath).sort()).toEqual(["$.list[0]", "$.list[2]"]);
    });

    it("builds a dotted/bracketed locationPath through nested objects and arrays", () => {
      const findings = compareBodies(bytes('{"list":[{"name":"x"},{"name":"y"}]}'), bytes('{"list":[{"name":"x"},{"name":"z"}]}'), "RESPONSE_BODY");
      expect(findings).toEqual([expect.objectContaining({ locationPath: "$.list[1].name", differenceKind: "VALUE" })]);
    });
  });
});

describe("findBodyDifferences", () => {
  it("returns no findings when both sides are absent (null)", () => {
    expect(findBodyDifferences(null, null, "REQUEST_BODY")).toEqual([]);
  });

  it("reports a whole-body PRESENCE finding when only side A is present, with byte length populated for A only", () => {
    const a = bytes('{"a":1}');
    const findings = findBodyDifferences(a, null, "REQUEST_BODY");
    expect(findings).toEqual([
      expect.objectContaining({
        phase: "INPUT",
        component: "REQUEST_BODY",
        differenceKind: "PRESENCE",
        locationPath: null,
        ruleCode: "BODY_PRESENCE",
        aByteOffset: 0n,
        aByteLength: BigInt(a.length),
        bByteOffset: null,
        bByteLength: null,
      }),
    ]);
  });

  it("reports a whole-body PRESENCE finding when only side B is present, with byte length populated for B only", () => {
    const b = bytes('{"b":2}');
    const findings = findBodyDifferences(null, b, "RESPONSE_BODY");
    expect(findings).toEqual([
      expect.objectContaining({
        phase: "OUTPUT",
        component: "RESPONSE_BODY",
        differenceKind: "PRESENCE",
        locationPath: null,
        ruleCode: "BODY_PRESENCE",
        bByteOffset: 0n,
        bByteLength: BigInt(b.length),
        aByteOffset: null,
        aByteLength: null,
      }),
    ]);
  });

  it("returns no findings for byte-identical non-JSON bodies, never falling through to a false RAW_BYTES finding", () => {
    const text = "plain text body, not JSON at all";
    expect(findBodyDifferences(bytes(text), bytes(text), "RESPONSE_BODY")).toEqual([]);
  });

  it("returns no findings for byte-identical JSON bodies", () => {
    const text = '{"a":1,"list":[1,2,3]}';
    expect(findBodyDifferences(bytes(text), bytes(text), "REQUEST_BODY")).toEqual([]);
  });

  it("delegates to compareBodies's structural diagnosis once a byte difference is confirmed", () => {
    const findings = findBodyDifferences(bytes('{"n":1}'), bytes('{"n":2}'), "REQUEST_BODY");
    expect(findings).toEqual([expect.objectContaining({ locationPath: "$.n", differenceKind: "VALUE" })]);
  });

  it("falls back to RAW_BYTES via compareBodies when differing bytes are not valid JSON", () => {
    const findings = findBodyDifferences(bytes("plain text"), bytes("different text"), "RESPONSE_BODY");
    expect(findings).toEqual([expect.objectContaining({ differenceKind: "RAW_BYTES" })]);
  });
});
