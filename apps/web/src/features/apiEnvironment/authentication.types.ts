// Group 3C (Authentication) types — mirror the AuthenticationConfigurationResult
// / DTO shapes in apps/api/src/modules/authentication exactly. Authentication is
// scoped per-Environment only (REVISION 3C-R02), shared by every API in that
// Environment. password/token are write-only inputs; the read shape never
// carries a secret field.

export type AuthType = "NONE" | "LOGIN_FORM" | "BEARER_TOKEN"

export type CredentialStatus = "NOT_REQUIRED" | "CONFIGURED" | "NOT_CONFIGURED"

// Phase C (Import Login Request) — Login Form now supports two mutually
// exclusive shapes on the same row, discriminated by loginMode. MANUAL is the
// pre-Phase-C 3-field fallback; IMPORTED holds a parsed cURL/fetch login
// request template with structural markers for where the real Test Account
// username/password get substituted at Run time.

export type LoginMode = "MANUAL" | "IMPORTED"

export type ImportBodyFormat = "JSON" | "FORM_URLENCODED" | "NONE"

export type FieldLocationKind = "HEADER" | "BODY"

export interface KeyValueEntry {
  name: string

  value: string
}

export interface FieldLocation {
  kind: FieldLocationKind

  name: string
}

export interface AuthenticationConfiguration {
  environmentId: string

  authType: AuthType

  credentialStatus: CredentialStatus

  loginMode: LoginMode | null

  loginUrl: string | null

  usernameField: string | null

  passwordField: string | null

  importMethod: string | null

  importUrl: string | null

  importHeaders: KeyValueEntry[] | null

  importBodyFormat: ImportBodyFormat | null

  importBodyFields: KeyValueEntry[] | null

  importUsernameLocation: FieldLocation | null

  importPasswordLocation: FieldLocation | null

  updatedAt: string | null
}

export interface PutAuthenticationConfigurationPayload {
  authType: AuthType

  loginMode?: LoginMode

  loginUrl?: string

  usernameField?: string

  passwordField?: string

  importMethod?: string

  importUrl?: string

  importHeaders?: KeyValueEntry[]

  importBodyFormat?: ImportBodyFormat

  importBodyFields?: KeyValueEntry[]

  importUsernameLocation?: FieldLocation

  importPasswordLocation?: FieldLocation
}

export interface PutCredentialPayload {
  token?: string
}

// REVISION 3C-R02 — Login Form supports multiple named Test Accounts per
// Environment, selected at Run time. Password is write-only; never returned.

export interface TestAccount {
  testAccountId: string

  environmentId: string

  label: string

  username: string

  createdAt: string

  updatedAt: string
}

export interface CreateTestAccountPayload {
  label: string

  username: string

  password: string
}

export interface UpdateTestAccountPayload {
  label?: string

  username?: string

  password?: string
}
