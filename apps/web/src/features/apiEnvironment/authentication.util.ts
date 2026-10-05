import type {
  AuthenticationConfiguration,
  AuthType,
  LoginMode,
  PutAuthenticationConfigurationPayload,
} from "./authentication.types"

// Client-side mirror of the backend's validation in

// apps/api/src/modules/authentication/authentication.service.ts — kept in

// sync deliberately so drafts get inline feedback before a round trip; the

// backend remains the source of truth and re-validates independently.

export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  NONE: "None",

  LOGIN_FORM: "Login Form",

  BEARER_TOKEN: "Bearer Token",
}

export const AUTH_TYPE_OPTIONS: { value: AuthType; label: string }[] = [
  { value: "NONE", label: AUTH_TYPE_LABELS.NONE },

  { value: "LOGIN_FORM", label: AUTH_TYPE_LABELS.LOGIN_FORM },

  { value: "BEARER_TOKEN", label: AUTH_TYPE_LABELS.BEARER_TOKEN },
]

// AC-UI-3C-03: every Authentication Type change is confirmed first, since it
// immediately changes what every Run against this Environment authenticates
// with. The switch itself is no longer destructive — every type's/mode's
// configuration is preserved and reappears if the admin switches back — so
// the message is informational rather than a data-loss warning.
export function changeTypeConfirmMessage(fromLabel: string, toLabel: string): string {
  return `This changes the active Authentication Type from ${fromLabel} to ${toLabel} for this Environment, affecting every Run against it. ${fromLabel}'s configuration is kept and reappears if you switch back to it. Continue?`
}

// Switching loginMode never touches the credential (Test Accounts survive a
// MANUAL <-> IMPORTED switch), and the structural configuration for the
// mode being left is preserved rather than discarded.
export function changeLoginModeConfirmMessage(
  fromLabel: string,
  toLabel: string,
): string {
  return `This changes the active Login Form mode from ${fromLabel} to ${toLabel} for this Environment. ${fromLabel}'s configuration is kept and reappears if you switch back to it. Continue?`
}

export interface LoginFormDraft {
  loginUrl: string

  usernameField: string

  passwordField: string
}

export function toLoginFormDraft(
  config: AuthenticationConfiguration,
): LoginFormDraft {
  return {
    loginUrl: config.loginUrl ?? "",

    usernameField: config.usernameField ?? "",

    passwordField: config.passwordField ?? "",
  }
}

export function isLoginFormDraftDirty(
  draft: LoginFormDraft,
  config: AuthenticationConfiguration,
): boolean {
  const baseline = toLoginFormDraft(config)

  return (
    draft.loginUrl !== baseline.loginUrl ||
    draft.usernameField !== baseline.usernameField ||
    draft.passwordField !== baseline.passwordField
  )
}

// Phase C: Login Form now requires loginMode; MANUAL is the only shape this
// builder assembles — the IMPORTED shape is built by
// buildImportedConfigurationPayload in loginRequestImport.util.ts instead.
export function buildConfigurationPayload(
  authType: AuthType,
  loginMode: LoginMode,
  draft: LoginFormDraft,
): PutAuthenticationConfigurationPayload {
  if (authType !== "LOGIN_FORM") {
    return { authType }
  }

  return {
    authType,

    loginMode,

    loginUrl: draft.loginUrl.trim(),

    usernameField: draft.usernameField.trim(),

    passwordField: draft.passwordField.trim(),
  }
}

// LOGIN_MODE_OPTIONS lists Import first — it is the recommended flow (Phase
// C requirement), Manual is the fallback.
export const LOGIN_MODE_LABELS: Record<LoginMode, string> = {
  IMPORTED: "Import from cURL/fetch (recommended)",

  MANUAL: "Manual configuration",
}

export const LOGIN_MODE_OPTIONS: { value: LoginMode; label: string }[] = [
  { value: "IMPORTED", label: LOGIN_MODE_LABELS.IMPORTED },

  { value: "MANUAL", label: LOGIN_MODE_LABELS.MANUAL },
]

export function validateLoginUrlSyntax(value: string): string | null {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    return "Login URL is not a well-formed URL."
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Login URL must be an absolute HTTP or HTTPS URL."
  }

  return null
}

export function validateLoginFormDraft(draft: LoginFormDraft): string | null {
  const loginUrl = draft.loginUrl.trim()

  const usernameField = draft.usernameField.trim()

  const passwordField = draft.passwordField.trim()

  if (!loginUrl) return "Login URL is required."

  const urlError = validateLoginUrlSyntax(loginUrl)

  if (urlError) return urlError

  if (loginUrl.length > 2048)
    return "Login URL must be 2048 characters or fewer."

  if (!usernameField) return "Username Field is required."

  if (usernameField.length > 100)
    return "Username Field must be 100 characters or fewer."

  if (!passwordField) return "Password Field is required."

  if (passwordField.length > 100)
    return "Password Field must be 100 characters or fewer."

  if (usernameField === passwordField)
    return "Username Field and Password Field must be different."

  return null
}

export function validatePassword(value: string): string | null {
  if (!value) return "Password is required."

  if (value.length > 1024) return "Password must be 1024 characters or fewer."

  return null
}

export function validateToken(value: string): string | null {
  const normalized = value.replace(/^Bearer\s+/i, "").trim()

  if (!normalized) return "Token is required."

  if (value.length > 4096) return "Token must be 4096 characters or fewer."

  return null
}
