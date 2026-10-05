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

    it("excludes known-volatile response headers (Date, ETag, Age, cf-ray, Report-To, X-RateLimit-*, ...) from comparison, case-insensitively", () => {
      const findings = checkOutputDifferences(
        side({
          responseHeaders: [
            { key: "Date", value: "Mon, 01 Jan 2026 00:00:00 GMT" },
            { key: "ETag", value: '"abc"' },
            { key: "Age", value: "123" },
            { key: "CF-RAY", value: "1111-SIN" },
            { key: "X-Request-Id", value: "req-a" },
            { key: "Report-To", value: '{"group":"cf-nel","endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=aaa"}]}' },
            { key: "X-RateLimit-Remaining", value: "98" },
            { key: "X-RateLimit-Reset", value: "1790576121" },
          ],
        }),
        side({
          responseHeaders: [
            { key: "Date", value: "Tue, 02 Jan 2026 00:00:00 GMT" },
            { key: "ETag", value: '"xyz"' },
            { key: "Age", value: "167" },
            { key: "CF-RAY", value: "2222-SIN" },
            { key: "X-Request-Id", value: "req-b" },
            { key: "Report-To", value: '{"group":"cf-nel","endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=bbb"}]}' },
            { key: "X-RateLimit-Remaining", value: "99" },
            { key: "X-RateLimit-Reset", value: "1790580731" },
          ],
        }),
      );
      expect(findings).toEqual([]);
    });

    it("still compares WWW-Authenticate (and other non-excluded headers) normally", () => {
      const findings = checkOutputDifferences(side({ responseHeaders: [{ key: "WWW-Authenticate", value: "Bearer realm=a" }] }), side({ responseHeaders: [{ key: "WWW-Authenticate", value: "Bearer realm=b" }] }));
      expect(findings).toEqual([expect.objectContaining({ component: "RESPONSE_HEADER", locationPath: "www-authenticate", ruleCode: "HEADER_VALUE" })]);
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
