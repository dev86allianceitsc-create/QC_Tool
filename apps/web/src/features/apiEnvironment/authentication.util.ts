import type { AuthenticationConfiguration, AuthType, PutAuthenticationConfigurationPayload } from "./authentication.types";

// Client-side mirror of the backend's validation in
// apps/api/src/modules/authentication/authentication.service.ts — kept in
// sync deliberately so drafts get inline feedback before a round trip; the
// backend remains the source of truth and re-validates independently.

export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  NONE: "None",
  LOGIN_FORM: "Login Form",
  BEARER_TOKEN: "Bearer Token",
};

export const AUTH_TYPE_OPTIONS: { value: AuthType; label: string }[] = [
  { value: "NONE", label: AUTH_TYPE_LABELS.NONE },
  { value: "LOGIN_FORM", label: AUTH_TYPE_LABELS.LOGIN_FORM },
  { value: "BEARER_TOKEN", label: AUTH_TYPE_LABELS.BEARER_TOKEN },
];

// CL-3C-02 / AC-UI-3C-03: every Authentication Type change is confirmed
// first. The wording follows the AnD UI's suggested copy when a stored
// credential is actually about to be discarded, and drops that sentence
// when there is none — the warning must describe what really happens, not
// threaten the loss of a credential that was never configured.
export function changeTypeConfirmMessage(fromLabel: string, toLabel: string, credentialConfigured: boolean): string {
  const lead = `This changes the Authentication Type from ${fromLabel} to ${toLabel} for this API in this Environment.`;
  if (credentialConfigured) {
    return `${lead} The credential saved for ${fromLabel} will be removed and cannot be recovered automatically. Continue?`;
  }
  return `${lead} Any configuration saved for ${fromLabel} will be discarded. Continue?`;
}

export interface LoginFormDraft {
  loginUrl: string;
  username: string;
  usernameField: string;
  passwordField: string;
  tokenResponsePath: string;
}

export function toLoginFormDraft(config: AuthenticationConfiguration): LoginFormDraft {
  return {
    loginUrl: config.loginUrl ?? "",
    username: config.username ?? "",
    usernameField: config.usernameField ?? "",
    passwordField: config.passwordField ?? "",
    tokenResponsePath: config.tokenResponsePath ?? "",
  };
}

export function isLoginFormDraftDirty(draft: LoginFormDraft, config: AuthenticationConfiguration): boolean {
  const baseline = toLoginFormDraft(config);
  return (
    draft.loginUrl !== baseline.loginUrl ||
    draft.username !== baseline.username ||
    draft.usernameField !== baseline.usernameField ||
    draft.passwordField !== baseline.passwordField ||
    draft.tokenResponsePath !== baseline.tokenResponsePath
  );
}

export function buildConfigurationPayload(authType: AuthType, draft: LoginFormDraft): PutAuthenticationConfigurationPayload {
  if (authType !== "LOGIN_FORM") {
    return { authType };
  }
  return {
    authType,
    loginUrl: draft.loginUrl.trim(),
    username: draft.username.trim(),
    usernameField: draft.usernameField.trim(),
    passwordField: draft.passwordField.trim(),
    tokenResponsePath: draft.tokenResponsePath.trim(),
  };
}

const TOKEN_RESPONSE_PATH_PATTERN = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;

export function validateLoginUrlSyntax(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Login URL is not a well-formed URL.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Login URL must be an absolute HTTP or HTTPS URL.";
  }
  return null;
}

export function validateLoginFormDraft(draft: LoginFormDraft): string | null {
  const loginUrl = draft.loginUrl.trim();
  const username = draft.username.trim();
  const usernameField = draft.usernameField.trim();
  const passwordField = draft.passwordField.trim();
  const tokenResponsePath = draft.tokenResponsePath.trim();

  if (!loginUrl) return "Login URL is required.";
  const urlError = validateLoginUrlSyntax(loginUrl);
  if (urlError) return urlError;
  if (loginUrl.length > 2048) return "Login URL must be 2048 characters or fewer.";
  if (!username) return "Username is required.";
  if (username.length > 255) return "Username must be 255 characters or fewer.";
  if (!usernameField) return "Username Field is required.";
  if (usernameField.length > 100) return "Username Field must be 100 characters or fewer.";
  if (!passwordField) return "Password Field is required.";
  if (passwordField.length > 100) return "Password Field must be 100 characters or fewer.";
  if (usernameField === passwordField) return "Username Field and Password Field must be different.";
  if (!tokenResponsePath) return "Token Response Path is required.";
  if (tokenResponsePath.length > 200) return "Token Response Path must be 200 characters or fewer.";
  if (!TOKEN_RESPONSE_PATH_PATTERN.test(tokenResponsePath)) {
    return "Token Response Path must be a dot-separated path of letters, digits, and underscores (e.g. access_token, data.access_token).";
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length > 1024) return "Password must be 1024 characters or fewer.";
  return null;
}

export function validateToken(value: string): string | null {
  const normalized = value.replace(/^Bearer\s+/i, "").trim();
  if (!normalized) return "Token is required.";
  if (value.length > 4096) return "Token must be 4096 characters or fewer.";
  return null;
}
