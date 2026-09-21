// Group 3C (Authentication) types — mirror the AuthenticationConfigurationResult
// / DTO shapes in apps/api/src/modules/authentication exactly. password/token
// are write-only inputs; the read shape never carries a secret field.

export type AuthType = "NONE" | "LOGIN_FORM" | "BEARER_TOKEN";
export type CredentialStatus = "NOT_REQUIRED" | "CONFIGURED" | "NOT_CONFIGURED";

export interface AuthenticationConfiguration {
  apiId: string;
  environmentId: string;
  authType: AuthType;
  credentialStatus: CredentialStatus;
  loginUrl: string | null;
  username: string | null;
  usernameField: string | null;
  passwordField: string | null;
  tokenResponsePath: string | null;
  updatedAt: string | null;
}

export interface PutAuthenticationConfigurationPayload {
  authType: AuthType;
  loginUrl?: string;
  username?: string;
  usernameField?: string;
  passwordField?: string;
  tokenResponsePath?: string;
}

export interface PutCredentialPayload {
  password?: string;
  token?: string;
}
