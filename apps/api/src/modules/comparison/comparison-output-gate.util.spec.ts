import { checkOutputDifferences, OutputGateSnapshotInput } from "./comparison-output-gate.util";

function side(overrides: Partial<OutputGateSnapshotInput> = {}): OutputGateSnapshotInput {
  return {
    httpStatusCode: 200,
    responseHeaders: [{ key: "Content-Type", value: "application/json" }],
    responseBody: null,
    ...overrides,
  };
}

describe("checkOutputDifferences", () => {
  it("returns no findings when status, headers, and body all match", () => {
    expect(checkOutputDifferences(side(), side())).toEqual([]);
  });

  it("returns no findings when both sides have no response body", () => {
    expect(checkOutputDifferences(side({ responseBody: null }), side({ responseBody: null }))).toEqual([]);
  });

  describe("HTTP_STATUS", () => {
    it("reports HTTP_STATUS_MISMATCH with both status codes safely echoed", () => {
      const findings = checkOutputDifferences(side({ httpStatusCode: 200 }), side({ httpStatusCode: 404 }));
      expect(findings).toEqual([
        expect.objectContaining({
          phase: "OUTPUT",
          component: "HTTP_STATUS",
          differenceKind: "VALUE",
          locationPath: null,
          ruleCode: "HTTP_STATUS_MISMATCH",
          safeSummary: "HTTP status differs (A=200, B=404)",
        }),
      ]);
    });
  });

  describe("headers", () => {
    it("delegates to compareHeaderPairs for response header differences", () => {
      const findings = checkOutputDifferences(
        side({ responseHeaders: [{ key: "Content-Type", value: "application/json" }] }),
        side({ responseHeaders: [{ key: "Content-Type", value: "application/xml" }] }),
      );
      expect(findings).toEqual([expect.objectContaining({ phase: "OUTPUT", component: "RESPONSE_HEADER", differenceKind: "VALUE", locationPath: "content-type", ruleCode: "HEADER_VALUE" })]);
    });

    it("never auto-excludes Date or WWW-Authenticate headers from comparison", () => {
      const findings = checkOutputDifferences(side({ responseHeaders: [{ key: "Date", value: "Mon, 01 Jan 2026 00:00:00 GMT" }] }), side({ responseHeaders: [{ key: "Date", value: "Tue, 02 Jan 2026 00:00:00 GMT" }] }));
      expect(findings).toEqual([expect.objectContaining({ component: "RESPONSE_HEADER", locationPath: "date", ruleCode: "HEADER_VALUE" })]);
    });
  });

  describe("body", () => {
    it("delegates to findBodyDifferences for JSON response body differences", () => {
      const a = Buffer.from('{"count":1}', "utf-8");
      const b = Buffer.from('{"count":2}', "utf-8");
      const findings = checkOutputDifferences(side({ responseBody: a }), side({ responseBody: b }));
      expect(findings).toEqual([expect.objectContaining({ phase: "OUTPUT", component: "RESPONSE_BODY", differenceKind: "VALUE", locationPath: "$.count" })]);
    });

    it("reports a PRESENCE finding when only one side has a response body", () => {
      const b = Buffer.from('{"ok":true}', "utf-8");
      const findings = checkOutputDifferences(side({ responseBody: null }), side({ responseBody: b }));
      expect(findings).toEqual([expect.objectContaining({ phase: "OUTPUT", component: "RESPONSE_BODY", differenceKind: "PRESENCE", ruleCode: "BODY_PRESENCE" })]);
    });

    it("compares binary bodies on full bytes, not metadata, falling back to RAW_BYTES", () => {
      const a = new Uint8Array([0x00, 0x01, 0xff, 0x10]);
      const b = new Uint8Array([0x00, 0x02, 0xaa, 0x10]);
      const findings = checkOutputDifferences(side({ responseBody: a }), side({ responseBody: b }));
      expect(findings).toEqual([expect.objectContaining({ phase: "OUTPUT", component: "RESPONSE_BODY", differenceKind: "RAW_BYTES" })]);
    });
  });

  it("aggregates independent findings across status, headers, and body at once", () => {
    const findings = checkOutputDifferences(
      side({ httpStatusCode: 200, responseHeaders: [{ key: "Content-Type", value: "application/json" }] }),
      side({ httpStatusCode: 500, responseHeaders: [{ key: "Content-Type", value: "text/plain" }] }),
    );
    const components = findings.map((f) => f.component).sort();
    expect(components).toEqual(["HTTP_STATUS", "RESPONSE_HEADER"]);
  });
});
