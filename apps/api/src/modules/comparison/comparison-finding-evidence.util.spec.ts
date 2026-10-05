import { deriveFindingSides, isSensitiveJsonPath, FindingEvidenceRow, SnapshotSideEvidence } from "./comparison-finding-evidence.util";

function evidence(overrides: Partial<SnapshotSideEvidence> = {}): SnapshotSideEvidence {
  return {
    httpMethod: "GET",
    requestUrl: "https://api-uat.example.com/users/1",
    httpStatusCode: 200,
    requestHeaders: [],
    responseHeaders: [],
    requestBody: null,
    responseBody: null,
    ...overrides,
  };
}

function row(overrides: Partial<FindingEvidenceRow> = {}): FindingEvidenceRow {
  return {
    component: "RESPONSE_HEADER",
    locationPath: null,
    aByteOffset: null,
    aByteLength: null,
    bByteOffset: null,
    bByteLength: null,
    aValueKind: null,
    bValueKind: null,
    ...overrides,
  };
}

describe("deriveFindingSides", () => {
  describe("HTTP_STATUS", () => {
    it("shows the real numeric status on both sides, unredacted", () => {
      const { a, b } = deriveFindingSides(row({ component: "HTTP_STATUS" }), evidence({ httpStatusCode: 200 }), evidence({ httpStatusCode: 404 }));
      expect(a).toEqual({ presenceKind: "VALUE", displayKind: "number", safeText: "200", hexPreview: null, isRedacted: false, hasMore: false });
      expect(b).toEqual({ presenceKind: "VALUE", displayKind: "number", safeText: "404", hexPreview: null, isRedacted: false, hasMore: false });
    });
  });

  describe("METHOD", () => {
    it("shows the real method on both sides, unredacted", () => {
      const { a, b } = deriveFindingSides(row({ component: "METHOD" }), evidence({ httpMethod: "GET" }), evidence({ httpMethod: "POST" }));
      expect(a).toEqual({ presenceKind: "VALUE", displayKind: "text", safeText: "GET", hexPreview: null, isRedacted: false, hasMore: false });
      expect(b).toEqual({ presenceKind: "VALUE", displayKind: "text", safeText: "POST", hexPreview: null, isRedacted: false, hasMore: false });
    });

    it("reports 'not available' instead of ABSENT when the Snapshot row is missing", () => {
      const { a } = deriveFindingSides(row({ component: "METHOD" }), evidence({ httpMethod: null }), evidence({}));
      expect(a).toMatchObject({ presenceKind: "VALUE", safeText: "Value not available in stored finding" });
    });
  });

  describe("URL", () => {
    it("shows only the path, stripping the query string, on both sides", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "URL" }),
        evidence({ requestUrl: "https://api-uat.example.com/users/12345?api_key=sk_live_9f8a2b7c&page=1" }),
        evidence({ requestUrl: "https://api-uat.example.com/users/67890?api_key=sk_live_9f8a2b7c&page=1" }),
      );
      expect(a).toEqual({ presenceKind: "VALUE", displayKind: "text", safeText: "/users/12345", hexPreview: null, isRedacted: false, hasMore: false });
      expect(b).toEqual({ presenceKind: "VALUE", displayKind: "text", safeText: "/users/67890", hexPreview: null, isRedacted: false, hasMore: false });
      expect(JSON.stringify({ a, b })).not.toContain("api_key");
      expect(JSON.stringify({ a, b })).not.toContain("sk_live_9f8a2b7c");
    });

    it("strips the query string from a relative URL that has no scheme/host", () => {
      const { a } = deriveFindingSides(row({ component: "URL" }), evidence({ requestUrl: "/users/1?token=secret" }), evidence({}));
      expect(a.safeText).toBe("/users/1");
      expect(a.safeText).not.toContain("token");
    });

    it("reports 'not available' instead of ABSENT when the Snapshot row is missing", () => {
      const { a } = deriveFindingSides(row({ component: "URL" }), evidence({ requestUrl: null }), evidence({}));
      expect(a).toMatchObject({ presenceKind: "VALUE", safeText: "Value not available in stored finding" });
    });

    it("shows origin+path when the path matches but the host differs (e.g. cross-environment)", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "URL" }),
        evidence({ requestUrl: "https://api-uat.example.com/api/v1/projects" }),
        evidence({ requestUrl: "https://api-prod.example.com/api/v1/projects" }),
      );
      expect(a).toEqual({ presenceKind: "VALUE", displayKind: "text", safeText: "https://api-uat.example.com/api/v1/projects", hexPreview: null, isRedacted: false, hasMore: false });
      expect(b).toEqual({ presenceKind: "VALUE", displayKind: "text", safeText: "https://api-prod.example.com/api/v1/projects", hexPreview: null, isRedacted: false, hasMore: false });
    });

    it("explains the hidden difference instead of showing two identical strings when only the query string/fragment differs", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "URL" }),
        evidence({ requestUrl: "https://api-uat.example.com/api/v1/projects?page=1" }),
        evidence({ requestUrl: "https://api-uat.example.com/api/v1/projects?page=2" }),
      );
      expect(a.safeText).toBe(b.safeText);
      expect(a.safeText).toContain("/api/v1/projects");
      expect(a.safeText).toContain("query string");
      expect(JSON.stringify({ a, b })).not.toContain("page=1");
      expect(JSON.stringify({ a, b })).not.toContain("page=2");
    });
  });

  describe("headers — non-sensitive", () => {
    it("shows the real A/B values for a differing response header (age example)", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "RESPONSE_HEADER", locationPath: "age" }),
        evidence({ responseHeaders: [{ key: "age", value: "123" }] }),
        evidence({ responseHeaders: [{ key: "age", value: "167" }] }),
      );
      expect(a).toMatchObject({ presenceKind: "VALUE", safeText: "123", isRedacted: false });
      expect(b).toMatchObject({ presenceKind: "VALUE", safeText: "167", isRedacted: false });
    });

    it("reports ABSENT when a header exists on only one side", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "RESPONSE_HEADER", locationPath: "x-custom" }),
        evidence({ responseHeaders: [{ key: "x-custom", value: "present" }] }),
        evidence({ responseHeaders: [] }),
      );
      expect(a).toMatchObject({ presenceKind: "VALUE", safeText: "present" });
      expect(b).toMatchObject({ presenceKind: "ABSENT", safeText: null });
    });

    it("preserves every value and order for a repeated non-sensitive header", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "RESPONSE_HEADER", locationPath: "x-tag" }),
        evidence({ responseHeaders: [{ key: "x-tag", value: "a=1" }, { key: "x-tag", value: "b=2" }] }),
        evidence({ responseHeaders: [{ key: "x-tag", value: "a=1" }] }),
      );
      expect(a.safeText).toBe(JSON.stringify(["a=1", "b=2"]));
      expect(b.safeText).toBe("a=1");
    });

    it("looks up REQUEST_HEADER findings in requestHeaders, not responseHeaders", () => {
      const { a } = deriveFindingSides(
        row({ component: "REQUEST_HEADER", locationPath: "x-env" }),
        evidence({ requestHeaders: [{ key: "x-env", value: "staging" }], responseHeaders: [{ key: "x-env", value: "wrong-side" }] }),
        evidence({}),
      );
      expect(a.safeText).toBe("staging");
    });
  });

  describe("headers — sensitive", () => {
    it("redacts Authorization on both sides and never leaks the token text", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "REQUEST_HEADER", locationPath: "authorization" }),
        evidence({ requestHeaders: [{ key: "Authorization", value: "Bearer secret-a" }] }),
        evidence({ requestHeaders: [{ key: "Authorization", value: "Bearer secret-b" }] }),
      );
      expect(a).toEqual({ presenceKind: "VALUE", displayKind: "text", safeText: "[REDACTED]", hexPreview: null, isRedacted: true, hasMore: false });
      expect(b.safeText).toBe("[REDACTED]");
      expect(JSON.stringify(a)).not.toContain("secret-a");
      expect(JSON.stringify(b)).not.toContain("secret-b");
    });

    it("redacts Cookie/Set-Cookie case-insensitively", () => {
      const { a } = deriveFindingSides(row({ component: "RESPONSE_HEADER", locationPath: "set-cookie" }), evidence({ responseHeaders: [{ key: "Set-Cookie", value: "session=abc123" }] }), evidence({}));
      expect(a.safeText).toBe("[REDACTED]");
      expect(JSON.stringify(a)).not.toContain("abc123");
    });
  });

  describe("body — JSON scalar", () => {
    it("slices the real raw token text for a differing numeric field ($.count example)", () => {
      const a = evidence({ responseBody: Buffer.from('{"count":1}', "utf-8") });
      const b = evidence({ responseBody: Buffer.from('{"count":2}', "utf-8") });
      const { a: sideA, b: sideB } = deriveFindingSides(
        row({ component: "RESPONSE_BODY", locationPath: "$.count", aByteOffset: 9n, aByteLength: 1n, bByteOffset: 9n, bByteLength: 1n, aValueKind: "number", bValueKind: "number" }),
        a,
        b,
      );
      expect(sideA).toMatchObject({ presenceKind: "VALUE", displayKind: "number", safeText: "1", isRedacted: false });
      expect(sideB).toMatchObject({ presenceKind: "VALUE", displayKind: "number", safeText: "2", isRedacted: false });
    });

    it("distinguishes a number from a string for a TYPE mismatch, both sides visible", () => {
      const a = evidence({ responseBody: Buffer.from('{"v":42}', "utf-8") });
      const b = evidence({ responseBody: Buffer.from('{"v":"ab"}', "utf-8") });
      const { a: sideA, b: sideB } = deriveFindingSides(
        row({ component: "RESPONSE_BODY", locationPath: "$.v", aByteOffset: 5n, aByteLength: 2n, bByteOffset: 5n, bByteLength: 4n, aValueKind: "number", bValueKind: "string" }),
        a,
        b,
      );
      expect(sideA).toMatchObject({ displayKind: "number", safeText: "42" });
      expect(sideB).toMatchObject({ displayKind: "string", safeText: '"ab"' });
    });

    it("distinguishes JSON null from an empty string", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "RESPONSE_BODY", locationPath: "$.v", aByteOffset: 5n, aByteLength: 4n, bByteOffset: 5n, bByteLength: 0n, aValueKind: "null", bValueKind: "string" }),
        evidence({ responseBody: Buffer.from('{"v":null}', "utf-8") }),
        evidence({ responseBody: Buffer.from('{"v":""}', "utf-8") }),
      );
      expect(a).toMatchObject({ presenceKind: "NULL", safeText: null });
      expect(b).toMatchObject({ presenceKind: "EMPTY", displayKind: "string", safeText: null });
    });

    it("reports ABSENT when the finding carries no byte-span evidence for a side", () => {
      const { b } = deriveFindingSides(
        row({ component: "RESPONSE_BODY", locationPath: "$.v", aByteOffset: 5n, aByteLength: 2n, bByteOffset: null, bByteLength: null, aValueKind: "number", bValueKind: null }),
        evidence({ responseBody: Buffer.from('{"v":42}', "utf-8") }),
        evidence({ responseBody: Buffer.from("{}", "utf-8") }),
      );
      expect(b).toMatchObject({ presenceKind: "ABSENT", safeText: null });
    });

    it("does not decode or preview whole-body (non-JSON-path) findings, only their byte span is implied", () => {
      const { a } = deriveFindingSides(row({ component: "RESPONSE_BODY", locationPath: null, aByteOffset: 0n, aByteLength: 4n, aValueKind: null }), evidence({ responseBody: Buffer.from("\x00\x01\x02\x03") }), evidence({}));
      expect(a.isRedacted).toBe(true);
      expect(a.safeText).toBe("[Binary/raw body content not shown]");
    });
  });

  describe("body — sensitive JSON field", () => {
    it("redacts a top-level sensitive field and never leaks its value", () => {
      const { a, b } = deriveFindingSides(
        row({ component: "RESPONSE_BODY", locationPath: "$.token", aByteOffset: 9n, aByteLength: 10n, bByteOffset: 9n, bByteLength: 10n, aValueKind: "string", bValueKind: "string" }),
        evidence({ responseBody: Buffer.from('{"token":"aaaaaaaa"}', "utf-8") }),
        evidence({ responseBody: Buffer.from('{"token":"bbbbbbbb"}', "utf-8") }),
      );
      expect(a.safeText).toBe("[REDACTED]");
      expect(b.safeText).toBe("[REDACTED]");
      expect(JSON.stringify({ a, b })).not.toContain("aaaaaaaa");
      expect(JSON.stringify({ a, b })).not.toContain("bbbbbbbb");
    });

    it("redacts a sensitive field nested at any depth ($.credentials.password)", () => {
      const body = Buffer.from('{"credentials":{"password":"hunter2"}}', "utf-8");
      const offset = body.toString("utf-8").indexOf('"hunter2"');
      const { a } = deriveFindingSides(
        row({ component: "REQUEST_BODY", locationPath: "$.credentials.password", aByteOffset: BigInt(offset), aByteLength: 9n, aValueKind: "string" }),
        evidence({ requestBody: body }),
        evidence({}),
      );
      expect(a.safeText).toBe("[REDACTED]");
    });
  });

  describe("historical finding missing stored evidence", () => {
    it("reports 'not available' instead of inventing a value when the Snapshot payload is missing", () => {
      const { a } = deriveFindingSides(
        row({ component: "RESPONSE_BODY", locationPath: "$.count", aByteOffset: 9n, aByteLength: 1n, aValueKind: "number" }),
        evidence({ responseBody: null }),
        evidence({}),
      );
      expect(a).toMatchObject({ presenceKind: "VALUE", safeText: "Value not available in stored finding", isRedacted: false });
    });
  });
});

describe("isSensitiveJsonPath", () => {
  it.each(["$.token", "$.credentials.password", "$.a[3].accessToken", "$.client_secret", "$.access-token"])("flags %s as sensitive", (path) => {
    expect(isSensitiveJsonPath(path)).toBe(true);
  });

  it.each(["$.count", "$.a.b.c", "$"])("does not flag %s as sensitive", (path) => {
    expect(isSensitiveJsonPath(path)).toBe(false);
  });
});
