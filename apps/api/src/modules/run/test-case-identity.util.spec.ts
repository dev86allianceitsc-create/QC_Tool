import { computeTestCaseKey, TestCaseIdentityInput } from "./test-case-identity.util";

function input(overrides: Partial<TestCaseIdentityInput> = {}): TestCaseIdentityInput {
  return {
    apiId: "api-1",
    environmentId: "env-1",
    authType: "LOGIN_FORM",
    testAccountId: "account-1",
    pathValues: { projectId: "123" },
    queryValues: { screen: "HOME" },
    headerValues: { Accept: "application/json" },
    bodyValue: "",
    ...overrides,
  };
}

describe("computeTestCaseKey", () => {
  it("is deterministic for identical input", () => {
    expect(computeTestCaseKey(input())).toBe(computeTestCaseKey(input()));
  });

  it("is stable under key-order permutation within each Record", () => {
    const a = computeTestCaseKey(
      input({
        pathValues: { projectId: "123", screen: "HOME" },
        queryValues: { limit: "10", offset: "0" },
      }),
    );
    const b = computeTestCaseKey(
      input({
        pathValues: { screen: "HOME", projectId: "123" },
        queryValues: { offset: "0", limit: "10" },
      }),
    );
    expect(a).toBe(b);
  });

  it("excludes the Authorization header case-insensitively", () => {
    const a = computeTestCaseKey(input({ headerValues: { Accept: "application/json", Authorization: "Bearer token-a" } }));
    const b = computeTestCaseKey(input({ headerValues: { Accept: "application/json", authorization: "Bearer token-b" } }));
    expect(a).toBe(b);
  });

  it("still varies when a non-Authorization header differs", () => {
    const a = computeTestCaseKey(input({ headerValues: { Accept: "application/json" } }));
    const b = computeTestCaseKey(input({ headerValues: { Accept: "application/xml" } }));
    expect(a).not.toBe(b);
  });

  it("includes testAccountId as a distinguishing component", () => {
    const a = computeTestCaseKey(input({ testAccountId: "account-1" }));
    const b = computeTestCaseKey(input({ testAccountId: "account-2" }));
    expect(a).not.toBe(b);
  });

  it("treats a null testAccountId distinctly from any real account id", () => {
    const withNull = computeTestCaseKey(input({ testAccountId: null }));
    const withAccount = computeTestCaseKey(input({ testAccountId: "account-1" }));
    expect(withNull).not.toBe(withAccount);
  });

  it("diverges for a genuinely different Request Input (Input A vs Input B)", () => {
    const inputA = computeTestCaseKey(input({ pathValues: { projectId: "123" }, queryValues: { screen: "HOME" } }));
    const inputB = computeTestCaseKey(input({ pathValues: { projectId: "456" }, queryValues: { screen: "SETTINGS" } }));
    expect(inputA).not.toBe(inputB);
  });

  it("diverges when the request body differs", () => {
    const a = computeTestCaseKey(input({ bodyValue: '{"n":1}' }));
    const b = computeTestCaseKey(input({ bodyValue: '{"n":2}' }));
    expect(a).not.toBe(b);
  });

  it("diverges across different apiId or environmentId", () => {
    const base = computeTestCaseKey(input());
    expect(computeTestCaseKey(input({ apiId: "api-2" }))).not.toBe(base);
    expect(computeTestCaseKey(input({ environmentId: "env-2" }))).not.toBe(base);
  });

  // The function intentionally has no authContextVersion/authContextKey
  // parameter at all — this is the invariant behind the user's own
  // September/October example: a Bearer secret rotation or a Login Form
  // config edit bumps authContextVersion but must never fork a continuous
  // Test Case history. Proven here by construction (the signature has
  // nowhere to plug such a value in), not by computing one and ignoring it.
  it("produces the same key regardless of any auth-config/version change, since no such input exists in its signature", () => {
    const beforeRotation = computeTestCaseKey(input());
    const afterRotation = computeTestCaseKey(input());
    expect(beforeRotation).toBe(afterRotation);
  });
});
