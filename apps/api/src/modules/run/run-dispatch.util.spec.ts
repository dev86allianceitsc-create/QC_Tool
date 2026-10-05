import { findAccessToken, redactHeaders, setHeader, setHeaderIfAbsent, toSnapshotRequestHeaderPairs, toSnapshotResponseHeaderPairs } from "./run-dispatch.util";

describe("toSnapshotRequestHeaderPairs", () => {
  it("preserves the Record's own key insertion order", () => {
    const headers = { "x-b": "2", "x-a": "1", "x-c": "3" };

    expect(toSnapshotRequestHeaderPairs(headers)).toEqual([
      { key: "x-b", value: "2" },
      { key: "x-a", value: "1" },
      { key: "x-c", value: "3" },
    ]);
  });

  it("deliberately does NOT mask Authorization — Snapshot stores the exact value sent on the wire", () => {
    const headers = { Authorization: "Bearer secret-token-abc" };

    expect(toSnapshotRequestHeaderPairs(headers)).toEqual([{ key: "Authorization", value: "Bearer secret-token-abc" }]);
  });

  it("leaves every header value untouched regardless of key name or casing", () => {
    const headers = { "Content-Type": "application/json", "X-Api-Key": "plain-value", authorization: "Basic dXNlcjpwYXNz" };

    expect(toSnapshotRequestHeaderPairs(headers)).toEqual([
      { key: "Content-Type", value: "application/json" },
      { key: "X-Api-Key", value: "plain-value" },
      { key: "authorization", value: "Basic dXNlcjpwYXNz" },
    ]);
  });

  it("returns an empty array for no headers", () => {
    expect(toSnapshotRequestHeaderPairs({})).toEqual([]);
  });

  it("diverges from redactHeaders on the same input: Run Result masks Authorization, Snapshot's capture does not", () => {
    const headers = { Authorization: "Bearer secret-token-abc", "Content-Type": "application/json" };

    const runResultHeaders = redactHeaders(headers);
    const snapshotHeaders = toSnapshotRequestHeaderPairs(headers);

    expect(runResultHeaders["Authorization"]).toBe("Bearer [REDACTED]");
    expect(snapshotHeaders.find((p) => p.key === "Authorization")?.value).toBe("Bearer secret-token-abc");
  });
});

describe("toSnapshotResponseHeaderPairs", () => {
  it("reports every entry from Headers#entries() unmasked, including Content-Type", () => {
    const headers = new Headers({ "content-type": "application/json", "x-request-id": "abc-123" });

    const pairs = toSnapshotResponseHeaderPairs(headers);

    expect(pairs).toEqual(expect.arrayContaining([{ key: "content-type", value: "application/json" }, { key: "x-request-id", value: "abc-123" }]));
    expect(pairs).toHaveLength(2);
  });

  it("DISCLOSED LIMITATION: repeated non-Set-Cookie header names are already comma-joined by Headers before this function ever sees them", () => {
    const headers = new Headers();
    headers.append("x-custom", "one");
    headers.append("x-custom", "two");

    expect(toSnapshotResponseHeaderPairs(headers)).toEqual([{ key: "x-custom", value: "one, two" }]);
  });

  it("Set-Cookie is the one name WHATWG's Headers keeps split into separate entries, and that survives into our pairs unmodified", () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1");
    headers.append("set-cookie", "b=2");

    const setCookiePairs = toSnapshotResponseHeaderPairs(headers).filter((p) => p.key === "set-cookie");
    expect(setCookiePairs).toEqual([{ key: "set-cookie", value: "a=1" }, { key: "set-cookie", value: "b=2" }]);
  });

  it("never masks Authorization-shaped response header names, matching Run Result's own unredacted responseHeadersSafe", () => {
    const headers = new Headers({ "www-authenticate": "Bearer realm=example" });

    expect(toSnapshotResponseHeaderPairs(headers)).toEqual([{ key: "www-authenticate", value: "Bearer realm=example" }]);
  });

  it("returns an empty array for no headers", () => {
    expect(toSnapshotResponseHeaderPairs(new Headers())).toEqual([]);
  });
});

describe("findAccessToken", () => {
  it("finds a top-level access_token", () => {
    expect(findAccessToken({ access_token: "tok-1" })).toBe("tok-1");
  });

  it("finds a token nested one level deep (e.g. under data)", () => {
    expect(findAccessToken({ data: { access_token: "tok-2" } })).toBe("tok-2");
  });

  it("prefers a shallower match over a deeper one, regardless of candidate-key order", () => {
    expect(findAccessToken({ token: "shallow", data: { access_token: "deep" } })).toBe("shallow");
  });

  it("at the same depth, resolves ties using ACCESS_TOKEN_KEY_CANDIDATES priority order", () => {
    expect(findAccessToken({ jwt: "low-priority", access_token: "high-priority" })).toBe("high-priority");
  });

  it("matches candidate keys case-insensitively", () => {
    expect(findAccessToken({ Access_Token: "tok-3" })).toBe("tok-3");
  });

  it("does not find a match nested more than one level deep (depth-2 cutoff)", () => {
    expect(findAccessToken({ data: { auth: { access_token: "too-deep" } } })).toBeUndefined();
  });

  it("skips arrays and does not return a token found inside a list", () => {
    expect(findAccessToken({ tokens: [{ access_token: "in-array" }] })).toBeUndefined();
  });

  it("returns undefined for a non-object body", () => {
    expect(findAccessToken("just a string")).toBeUndefined();
    expect(findAccessToken(null)).toBeUndefined();
    expect(findAccessToken(42)).toBeUndefined();
  });

  it("returns undefined for an empty object or one with no recognizable key", () => {
    expect(findAccessToken({})).toBeUndefined();
    expect(findAccessToken({ unrelated: "value" })).toBeUndefined();
  });

  it("ignores a candidate key whose value is not a non-empty string", () => {
    expect(findAccessToken({ access_token: "", token: "fallback" })).toBe("fallback");
    expect(findAccessToken({ access_token: "   ", token: "fallback2" })).toBe("fallback2");
    expect(findAccessToken({ access_token: 12345, token: "fallback3" })).toBe("fallback3");
  });
});

describe("setHeaderIfAbsent", () => {
  it("sets the header when no key names it under any casing", () => {
    const headers: Record<string, string> = {};
    setHeaderIfAbsent(headers, "Content-Type", "application/json");
    expect(headers).toEqual({ "Content-Type": "application/json" });
  });

  it("leaves an existing differently-cased key untouched instead of adding a second key", () => {
    const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
    setHeaderIfAbsent(headers, "Content-Type", "application/json");
    expect(headers).toEqual({ "content-type": "application/x-www-form-urlencoded" });
  });

  it("REGRESSION: a naive case-sensitive `headers[name] ?? default` would leave both keys, which fetch's Headers then comma-joins into a malformed value", () => {
    const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
    setHeaderIfAbsent(headers, "Content-Type", "application/x-www-form-urlencoded");
    expect(new Headers(headers).get("content-type")).toBe("application/x-www-form-urlencoded");
  });
});

describe("setHeader", () => {
  it("sets the header when absent", () => {
    const headers: Record<string, string> = {};
    setHeader(headers, "Content-Type", "application/json");
    expect(headers).toEqual({ "Content-Type": "application/json" });
  });

  it("replaces an existing differently-cased key rather than adding a second one", () => {
    const headers: Record<string, string> = { "content-type": "text/plain" };
    setHeader(headers, "Content-Type", "application/json");
    expect(headers).toEqual({ "Content-Type": "application/json" });
  });

  it("overwrites the value in place when the casing already matches", () => {
    const headers: Record<string, string> = { "Content-Type": "text/plain" };
    setHeader(headers, "Content-Type", "application/json");
    expect(headers).toEqual({ "Content-Type": "application/json" });
  });
});
