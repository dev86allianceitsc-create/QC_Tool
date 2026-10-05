import { checkComparisonEligibility, EligibilitySnapshotInput } from "./comparison-eligibility.util";

function snap(overrides: Partial<EligibilitySnapshotInput> = {}): EligibilitySnapshotInput {
  return {
    projectId: "project-1",
    apiId: "api-1",
    environmentId: "env-1",
    authContextKey: "auth-key-1",
    isInvalidated: false,
    hasPayload: true,
    hasRequestHeaders: true,
    hasResponseHeaders: true,
    authType: "NONE",
    testAccountId: null,
    ...overrides,
  };
}

describe("checkComparisonEligibility", () => {
  it("is eligible when every dimension matches and neither snapshot is invalidated or incomplete", () => {
    expect(checkComparisonEligibility(snap(), snap())).toEqual({ eligible: true });
  });

  it("reports CONTEXT_MISMATCH when projectId differs", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ projectId: "project-2" }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "CONTEXT_MISMATCH" });
  });

  it("reports CONTEXT_MISMATCH when apiId differs", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ apiId: "api-2" }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "CONTEXT_MISMATCH" });
  });

  it("reports ENVIRONMENT_MISMATCH when only environmentId differs", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ environmentId: "env-2" }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "ENVIRONMENT_MISMATCH" });
  });

  it("reports AUTH_CONTEXT_UNKNOWN when side A has no computable auth context", () => {
    const outcome = checkComparisonEligibility(snap({ authContextKey: "" }), snap());
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "AUTH_CONTEXT_UNKNOWN" });
  });

  it("reports AUTH_CONTEXT_UNKNOWN when side B has no computable auth context", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ authContextKey: "" }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "AUTH_CONTEXT_UNKNOWN" });
  });

  it("reports CONTEXT_MISMATCH when both sides have an auth context but they differ", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ authContextKey: "auth-key-2" }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "CONTEXT_MISMATCH" });
  });

  it("reports TEST_ACCOUNT_MISMATCH when authType is LOGIN_FORM and the Test Account differs", () => {
    const outcome = checkComparisonEligibility(
      snap({ authType: "LOGIN_FORM", testAccountId: "account-1" }),
      snap({ authType: "LOGIN_FORM", testAccountId: "account-2" }),
    );
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "TEST_ACCOUNT_MISMATCH" });
  });

  it("is eligible for matching LOGIN_FORM Test Accounts even though authType carries no bearing on authContextKey", () => {
    const outcome = checkComparisonEligibility(
      snap({ authType: "LOGIN_FORM", testAccountId: "account-1" }),
      snap({ authType: "LOGIN_FORM", testAccountId: "account-1" }),
    );
    expect(outcome).toEqual({ eligible: true });
  });

  it("ignores a differing testAccountId when authType is not LOGIN_FORM — BEARER_TOKEN/NONE have no Test Account concept", () => {
    const outcome = checkComparisonEligibility(
      snap({ authType: "BEARER_TOKEN", testAccountId: "account-1" }),
      snap({ authType: "BEARER_TOKEN", testAccountId: "account-2" }),
    );
    expect(outcome).toEqual({ eligible: true });
  });

  it("reports SNAPSHOT_INVALIDATED when side A is invalidated", () => {
    const outcome = checkComparisonEligibility(snap({ isInvalidated: true }), snap());
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "SNAPSHOT_INVALIDATED" });
  });

  it("reports SNAPSHOT_INVALIDATED when side B is invalidated", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ isInvalidated: true }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "SNAPSHOT_INVALIDATED" });
  });

  it("reports SNAPSHOT_INCOMPLETE when side A has no stored payload", () => {
    const outcome = checkComparisonEligibility(snap({ hasPayload: false }), snap());
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "SNAPSHOT_INCOMPLETE" });
  });

  it("reports SNAPSHOT_INCOMPLETE when side B has no stored payload", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ hasPayload: false }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "SNAPSHOT_INCOMPLETE" });
  });

  it("reports SNAPSHOT_INCOMPLETE when side A predates request-header capture", () => {
    const outcome = checkComparisonEligibility(snap({ hasRequestHeaders: false }), snap());
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "SNAPSHOT_INCOMPLETE" });
  });

  it("reports SNAPSHOT_INCOMPLETE when side B predates response-header capture", () => {
    const outcome = checkComparisonEligibility(snap(), snap({ hasResponseHeaders: false }));
    expect(outcome).toMatchObject({ eligible: false, reasonCode: "SNAPSHOT_INCOMPLETE" });
  });

  describe("first-stopping-gate precedence (BR-CMP-014-09)", () => {
    it("reports scope mismatch even when the pair is also invalidated and incomplete", () => {
      const outcome = checkComparisonEligibility(snap({ projectId: "project-2", isInvalidated: true, hasPayload: false }), snap());
      expect(outcome).toMatchObject({ eligible: false, reasonCode: "CONTEXT_MISMATCH" });
    });

    it("reports environment mismatch before auth-context and invalidation checks", () => {
      const outcome = checkComparisonEligibility(snap({ environmentId: "env-2", authContextKey: "", isInvalidated: true }), snap());
      expect(outcome).toMatchObject({ eligible: false, reasonCode: "ENVIRONMENT_MISMATCH" });
    });

    it("reports TEST_ACCOUNT_MISMATCH before invalidation when both are true", () => {
      const outcome = checkComparisonEligibility(
        snap({ authType: "LOGIN_FORM", testAccountId: "account-1", isInvalidated: true }),
        snap({ authType: "LOGIN_FORM", testAccountId: "account-2" }),
      );
      expect(outcome).toMatchObject({ eligible: false, reasonCode: "TEST_ACCOUNT_MISMATCH" });
    });

    it("reports auth-context mismatch before the Test Account check", () => {
      const outcome = checkComparisonEligibility(
        snap({ authType: "LOGIN_FORM", testAccountId: "account-1", authContextKey: "auth-key-2" }),
        snap({ authType: "LOGIN_FORM", testAccountId: "account-2" }),
      );
      expect(outcome).toMatchObject({ eligible: false, reasonCode: "CONTEXT_MISMATCH" });
    });

    it("reports invalidation before completeness when both are true", () => {
      const outcome = checkComparisonEligibility(snap({ isInvalidated: true, hasPayload: false }), snap());
      expect(outcome).toMatchObject({ eligible: false, reasonCode: "SNAPSHOT_INVALIDATED" });
    });
  });
});
