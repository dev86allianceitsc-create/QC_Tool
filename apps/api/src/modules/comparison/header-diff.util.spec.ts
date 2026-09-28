import type { HeaderPair } from "../run/run-dispatch.util";
import { compareHeaderPairs } from "./header-diff.util";

function h(key: string, value: string): HeaderPair {
  return { key, value };
}

describe("compareHeaderPairs", () => {
  it("returns no findings when both sides are empty", () => {
    expect(compareHeaderPairs([], [], "REQUEST_HEADER")).toEqual([]);
  });

  it("returns no findings when every header matches exactly", () => {
    const a = [h("Content-Type", "application/json"), h("X-Request-Id", "abc")];
    const b = [h("Content-Type", "application/json"), h("X-Request-Id", "abc")];
    expect(compareHeaderPairs(a, b, "REQUEST_HEADER")).toEqual([]);
  });

  it("matches header names case-insensitively", () => {
    const a = [h("Content-Type", "application/json")];
    const b = [h("content-type", "application/json")];
    expect(compareHeaderPairs(a, b, "REQUEST_HEADER")).toEqual([]);
  });

  it("derives phase INPUT for REQUEST_HEADER and OUTPUT for RESPONSE_HEADER", () => {
    const a = [h("X-Trace", "1")];
    const b = [h("X-Trace", "2")];
    expect(compareHeaderPairs(a, b, "REQUEST_HEADER")[0]).toMatchObject({ phase: "INPUT", component: "REQUEST_HEADER" });
    expect(compareHeaderPairs(a, b, "RESPONSE_HEADER")[0]).toMatchObject({ phase: "OUTPUT", component: "RESPONSE_HEADER" });
  });

  it("reports PRESENCE when a header exists only on side A", () => {
    const a = [h("X-Only-A", "1")];
    const b: HeaderPair[] = [];
    const findings = compareHeaderPairs(a, b, "RESPONSE_HEADER");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ differenceKind: "PRESENCE", locationPath: "x-only-a" });
    expect(findings[0].safeSummary).toContain("side A");
  });

  it("reports PRESENCE when a header exists only on side B", () => {
    const a: HeaderPair[] = [];
    const b = [h("X-Only-B", "1")];
    const findings = compareHeaderPairs(a, b, "REQUEST_HEADER");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ differenceKind: "PRESENCE", locationPath: "x-only-b" });
    expect(findings[0].safeSummary).toContain("side B");
  });

  it("reports LENGTH when the repeat count for a header differs", () => {
    const a = [h("Set-Cookie", "a=1"), h("Set-Cookie", "b=2")];
    const b = [h("Set-Cookie", "a=1")];
    const findings = compareHeaderPairs(a, b, "RESPONSE_HEADER");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ differenceKind: "LENGTH", locationPath: "set-cookie" });
  });

  it("reports ORDER when the same repeated values appear in a different sequence", () => {
    const a = [h("Vary", "Accept"), h("Vary", "Origin")];
    const b = [h("Vary", "Origin"), h("Vary", "Accept")];
    const findings = compareHeaderPairs(a, b, "RESPONSE_HEADER");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ differenceKind: "ORDER", locationPath: "vary" });
  });

  it("reports VALUE when a single-valued header differs", () => {
    const a = [h("X-Trace", "111")];
    const b = [h("X-Trace", "222")];
    const findings = compareHeaderPairs(a, b, "REQUEST_HEADER");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ differenceKind: "VALUE", locationPath: "x-trace" });
  });

  it("reports VALUE (not ORDER) when equal-length repeated values differ by content, not just position", () => {
    const a = [h("X-Tag", "a"), h("X-Tag", "a")];
    const b = [h("X-Tag", "a"), h("X-Tag", "b")];
    const findings = compareHeaderPairs(a, b, "REQUEST_HEADER");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ differenceKind: "VALUE", locationPath: "x-tag" });
  });

  it("evaluates every header name independently within one call", () => {
    const a = [h("A", "1"), h("B", "1"), h("C", "1")];
    const b = [h("A", "1"), h("B", "2"), h("D", "1")];
    const findings = compareHeaderPairs(a, b, "REQUEST_HEADER");
    const byPath = new Map(findings.map((f) => [f.locationPath, f.differenceKind]));
    expect(byPath.get("b")).toBe("VALUE");
    expect(byPath.get("c")).toBe("PRESENCE");
    expect(byPath.get("d")).toBe("PRESENCE");
    expect(findings).toHaveLength(3);
  });
});
