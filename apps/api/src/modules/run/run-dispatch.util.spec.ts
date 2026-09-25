import { redactHeaders, toSnapshotRequestHeaderPairs, toSnapshotResponseHeaderPairs } from "./run-dispatch.util";

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
