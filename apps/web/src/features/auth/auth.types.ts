// Shapes mirror the CURRENT backend contract (API-USR-001/002) exactly.
// These are app-local (not packages/shared-types): the prototype's
// Project/Member domain remains mocked and out of scope for this milestone,
// and this auth slice is not a cross-app authoritative contract either.

export type SystemRole = "ADMIN" | "USER";
export type AccountStatus = "INVITED" | "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface AuthUser {
  userId: string;
  email: string;
  systemRole: SystemRole;
  accountStatus: AccountStatus;
}

export interface GoogleLoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: AuthUser;
}

// UI-facing sign-in failure categories. Backend error codes are mapped onto
// this set (see useAuth's ERROR_CODE_TO_LOGIN_ERROR) — it is not itself a
// business contract, just the existing prototype's sign-in error taxonomy.
export type LoginErrorType =
  | "google-auth-failed"
  | "auth-cancelled"
  | "email-not-verified"
  | "user-not-registered"
  | "account-linking-conflict"
  | "account-unavailable"
  | "system-role-missing"
  | "service-unavailable";

export const ERROR_MESSAGES: Record<LoginErrorType, { title: string; message: string }> = {
  "google-auth-failed": { title: "Google authentication failed", message: "Verify your credentials and try again" },
  "auth-cancelled": { title: "Sign in cancelled", message: "You cancelled the Google sign in process" },
  "email-not-verified": { title: "Email not verified", message: "Your Google account email must be verified" },
  "user-not-registered": { title: "Account not found", message: "Contact administrator to create an account" },
  "account-linking-conflict": { title: "Account conflict", message: "Multiple QC Tool accounts linked to this email" },
  "account-unavailable": { title: "Account unavailable", message: "Your account is suspended or unavailable" },
  "system-role-missing": { title: "Configuration error", message: "Your system role is not properly configured" },
  "service-unavailable": { title: "Service unavailable", message: "Authentication service temporarily down" },
};
