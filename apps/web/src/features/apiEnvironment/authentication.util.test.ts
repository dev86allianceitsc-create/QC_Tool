import { describe, expect, it } from "vitest";
import {
  AUTH_TYPE_LABELS,
  AUTH_TYPE_OPTIONS,
  buildConfigurationPayload,
  changeTypeConfirmMessage,
  isLoginFormDraftDirty,
  toLoginFormDraft,
  validateLoginFormDraft,
  validateLoginUrlSyntax,
  validatePassword,
  validateToken,
} from "./authentication.util";
import type { AuthenticationConfiguration } from "./authentication.types";

function config(overrides: Partial<AuthenticationConfiguration> = {}): AuthenticationConfiguration {
  return {
    apiId: "a1",
    environmentId: "e1",
    authType: "LOGIN_FORM",
    credentialStatus: "CONFIGURED",
    loginUrl: "https://target.example.com/login",
    username: "qa.user",
    usernameField: "username",
    passwordField: "password",
    tokenResponsePath: "data.access_token",
    updatedAt: "2026-09-22T09:00:00.000Z",
    ...overrides,
  };
}

const VALID_DRAFT = {
  loginUrl: "https://target.example.com/login",
  username: "qa.user",
  usernameField: "username",
  passwordField: "password",
  tokenResponsePath: "data.access_token",
};

describe("authentication.util — Authentication Types", () => {
  it("offers exactly the three supported types with stable labels", () => {
    expect(AUTH_TYPE_OPTIONS.map((o) => o.value)).toEqual(["NONE", "LOGIN_FORM", "BEARER_TOKEN"]);
    expect(AUTH_TYPE_LABELS).toEqual({ NONE: "None", LOGIN_FORM: "Login Form", BEARER_TOKEN: "Bearer Token" });
  });
});

// CL-3C-02 / AC-UI-3C-03.
describe("changeTypeConfirmMessage", () => {
  it("warns that the stored credential is removed and not recoverable when one exists", () => {
    const message = changeTypeConfirmMessage("Login Form", "Bearer Token", true);
    expect(message).toContain("from Login Form to Bearer Token");
    expect(message).toContain("The credential saved for Login Form will be removed");
    expect(message).toContain("cannot be recovered automatically");
  });

  it("does not threaten the loss of a credential that was never configured", () => {
    const message = changeTypeConfirmMessage("None", "Login Form", false);
    expect(message).toContain("from None to Login Form");
    expect(message).not.toContain("credential saved");
    expect(message).toContain("will be discarded");
  });

  it("always asks for an explicit decision", () => {
    expect(changeTypeConfirmMessage("None", "Bearer Token", false)).toMatch(/Continue\?$/);
    expect(changeTypeConfirmMessage("Bearer Token", "None", true)).toMatch(/Continue\?$/);
  });

  it("never embeds a secret — it only names types", () => {
    const message = changeTypeConfirmMessage("Bearer Token", "None", true);
    expect(message).not.toMatch(/token:|password|eyJ/i);
  });
});

describe("toLoginFormDraft / isLoginFormDraftDirty", () => {
  it("maps nulls to empty strings so the form never renders 'null'", () => {
    expect(
      toLoginFormDraft(
        config({ authType: "NONE", loginUrl: null, username: null, usernameField: null, passwordField: null, tokenResponsePath: null }),
      ),
    ).toEqual({ loginUrl: "", username: "", usernameField: "", passwordField: "", tokenResponsePath: "" });
  });

  it("is clean against its own baseline and dirty after any field changes", () => {
    const saved = config();
    expect(isLoginFormDraftDirty(toLoginFormDraft(saved), saved)).toBe(false);
    expect(isLoginFormDraftDirty({ ...toLoginFormDraft(saved), username: "other.user" }, saved)).toBe(true);
    expect(isLoginFormDraftDirty({ ...toLoginFormDraft(saved), tokenResponsePath: "access_token" }, saved)).toBe(true);
  });
});

describe("buildConfigurationPayload", () => {
  it("sends only the type for NONE and BEARER_TOKEN — Login metadata does not belong to them", () => {
    expect(buildConfigurationPayload("NONE", VALID_DRAFT)).toEqual({ authType: "NONE" });
    expect(buildConfigurationPayload("BEARER_TOKEN", VALID_DRAFT)).toEqual({ authType: "BEARER_TOKEN" });
  });

  it("trims every Login Form field before sending", () => {
    expect(
      buildConfigurationPayload("LOGIN_FORM", {
        loginUrl: "  https://target.example.com/login  ",
        username: " qa.user ",
        usernameField: " username ",
        passwordField: " password ",
        tokenResponsePath: " data.access_token ",
      }),
    ).toEqual({ authType: "LOGIN_FORM", ...VALID_DRAFT });
  });

  it("never carries a secret in the configuration payload (REQ-SEC-002)", () => {
    const payload = buildConfigurationPayload("LOGIN_FORM", VALID_DRAFT) as unknown as Record<string, unknown>;
    expect(payload.password).toBeUndefined();
    expect(payload.token).toBeUndefined();
  });
});

describe("validateLoginUrlSyntax", () => {
  it("accepts absolute http and https URLs", () => {
    expect(validateLoginUrlSyntax("https://target.example.com/login")).toBeNull();
    expect(validateLoginUrlSyntax("http://localhost:8080/login")).toBeNull();
  });

  it("rejects malformed and non-HTTP URLs", () => {
    expect(validateLoginUrlSyntax("/login")).toBe("Login URL is not a well-formed URL.");
    expect(validateLoginUrlSyntax("ftp://target.example.com/login")).toBe("Login URL must be an absolute HTTP or HTTPS URL.");
  });
});

describe("validateLoginFormDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateLoginFormDraft(VALID_DRAFT)).toBeNull();
  });

  it("requires every Login Form field", () => {
    expect(validateLoginFormDraft({ ...VALID_DRAFT, loginUrl: "  " })).toBe("Login URL is required.");
    expect(validateLoginFormDraft({ ...VALID_DRAFT, username: "" })).toBe("Username is required.");
    expect(validateLoginFormDraft({ ...VALID_DRAFT, usernameField: "" })).toBe("Username Field is required.");
    expect(validateLoginFormDraft({ ...VALID_DRAFT, passwordField: "" })).toBe("Password Field is required.");
    expect(validateLoginFormDraft({ ...VALID_DRAFT, tokenResponsePath: "" })).toBe("Token Response Path is required.");
  });

  it("rejects identical username and password field names", () => {
    expect(validateLoginFormDraft({ ...VALID_DRAFT, usernameField: "login", passwordField: "login" })).toBe(
      "Username Field and Password Field must be different.",
    );
  });

  it("accepts a dot-separated Token Response Path and rejects other shapes", () => {
    expect(validateLoginFormDraft({ ...VALID_DRAFT, tokenResponsePath: "access_token" })).toBeNull();
    expect(validateLoginFormDraft({ ...VALID_DRAFT, tokenResponsePath: "data[0].token" })).toMatch(/dot-separated path/);
    expect(validateLoginFormDraft({ ...VALID_DRAFT, tokenResponsePath: ".token" })).toMatch(/dot-separated path/);
  });
});

describe("validatePassword / validateToken", () => {
  it("requires a non-empty password within the length cap", () => {
    expect(validatePassword("")).toBe("Password is required.");
    expect(validatePassword("s3cret")).toBeNull();
    expect(validatePassword("x".repeat(1025))).toBe("Password must be 1024 characters or fewer.");
  });

  it("accepts a token with or without the Bearer prefix", () => {
    expect(validateToken("eyJhbGciOi")).toBeNull();
    expect(validateToken("Bearer eyJhbGciOi")).toBeNull();
  });

  it("rejects a token that is empty once the Bearer prefix is stripped", () => {
    expect(validateToken("")).toBe("Token is required.");
    expect(validateToken("Bearer   ")).toBe("Token is required.");
  });
});
