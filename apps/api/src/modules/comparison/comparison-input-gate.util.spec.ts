import { checkInputCompatibility, InputGateSnapshotInput } from "./comparison-input-gate.util";

function side(overrides: Partial<InputGateSnapshotInput> = {}): InputGateSnapshotInput {
  return {
    httpMethod: "GET",
    requestUrl: "https://api.example.com/v1/widgets?limit=10",
    requestHeaders: [{ key: "Accept", value: "application/json" }],
    requestBody: null,
    ...overrides,
  };
}

describe("checkInputCompatibility", () => {
  it("returns no findings when method, URL, headers, and body all match", () => {
    expect(checkInputCompatibility(side(), side())).toEqual([]);
  });

  it("returns no findings when both sides have no request body", () => {
    expect(checkInputCompatibility(side({ requestBody: null }), side({ requestBody: null }))).toEqual([]);
  });

  describe("METHOD", () => {
    it("reports METHOD_MISMATCH with the actual method values safely echoed", () => {
      const findings = checkInputCompatibility(side({ httpMethod: "GET" }), side({ httpMethod: "POST" }));
      expect(findings).toEqual([
        expect.objectContaining({
          phase: "INPUT",
          component: "METHOD",
          differenceKind: "VALUE",
          locationPath: null,
          ruleCode: "METHOD_MISMATCH",
          safeSummary: "Method differs (A=GET, B=POST)",
        }),
      ]);
    });
  });

  describe("URL", () => {
    it("reports URL_MISMATCH without echoing either side's actual URL value", () => {
      const aUrl = "https://api.example.com/v1/widgets?token=secret-a";
      const bUrl = "https://api.example.com/v1/widgets?token=secret-b";
      const findings = checkInputCompatibility(side({ requestUrl: aUrl }), side({ requestUrl: bUrl }));
      expect(findings).toEqual([expect.objectContaining({ phase: "INPUT", component: "URL", differenceKind: "VALUE", locationPath: null, ruleCode: "URL_MISMATCH", safeSummary: "URL differs" })]);
      const summaries = JSON.stringify(findings);
      expect(summaries).not.toContain("secret-a");
      expect(summaries).not.toContain("secret-b");
    });
  });

  describe("headers", () => {
    it("delegates to compareHeaderPairs for header differences", () => {
      const findings = checkInputCompatibility(side({ requestHeaders: [{ key: "Accept", value: "application/json" }] }), side({ requestHeaders: [{ key: "Accept", value: "application/xml" }] }));
      expect(findings).toEqual([expect.objectContaining({ phase: "INPUT", component: "REQUEST_HEADER", differenceKind: "VALUE", locationPath: "accept", ruleCode: "HEADER_VALUE" })]);
    });

    it("excludes the Authorization header from comparison so different Test Accounts remain comparable", () => {
      const findings = checkInputCompatibility(side({ requestHeaders: [{ key: "Authorization", value: "Bearer token-a" }] }), side({ requestHeaders: [{ key: "Authorization", value: "Bearer token-b" }] }));
      expect(findings).toEqual([]);
    });

    it("excludes Authorization case-insensitively while still comparing other headers", () => {
      const findings = checkInputCompatibility(
        side({
          requestHeaders: [
            { key: "authorization", value: "Bearer token-a" },
            { key: "Accept", value: "application/json" },
          ],
        }),
        side({
          requestHeaders: [
            { key: "AUTHORIZATION", value: "Bearer token-b" },
            { key: "Accept", value: "application/xml" },
          ],
        }),
      );
      expect(findings).toEqual([expect.objectContaining({ component: "REQUEST_HEADER", locationPath: "accept", ruleCode: "HEADER_VALUE" })]);
    });
  });

  describe("body", () => {
    it("delegates to findBodyDifferences for JSON body differences", () => {
      const a = Buffer.from('{"n":1}', "utf-8");
      const b = Buffer.from('{"n":2}', "utf-8");
      const findings = checkInputCompatibility(side({ requestBody: a }), side({ requestBody: b }));
      expect(findings).toEqual([expect.objectContaining({ phase: "INPUT", component: "REQUEST_BODY", differenceKind: "VALUE", locationPath: "$.n" })]);
    });

    it("reports a PRESENCE finding when only one side has a request body", () => {
      const a = Buffer.from('{"n":1}', "utf-8");
      const findings = checkInputCompatibility(side({ requestBody: a }), side({ requestBody: null }));
      expect(findings).toEqual([expect.objectContaining({ phase: "INPUT", component: "REQUEST_BODY", differenceKind: "PRESENCE", ruleCode: "BODY_PRESENCE" })]);
    });
  });

  it("aggregates independent findings across all four dimensions at once", () => {
    const findings = checkInputCompatibility(
      side({ httpMethod: "GET", requestHeaders: [{ key: "Accept", value: "application/json" }] }),
      side({ httpMethod: "POST", requestHeaders: [{ key: "Accept", value: "application/xml" }] }),
    );
    const components = findings.map((f) => f.component).sort();
    expect(components).toEqual(["METHOD", "REQUEST_HEADER"]);
  });
});
