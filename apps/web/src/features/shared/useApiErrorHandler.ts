import { useCallback } from "react";
import { ApiError } from "../../services/api-client";
import { SESSION_ERROR_CODES } from "../auth/useAuth";

// Error codes documented by the backend for "authenticated but not allowed
// here" — as opposed to the membership-specific PROJECT_ACCESS_DENIED,
// which routes the same way since it's also a 403 the caller can't resolve.
const ACCESS_DENIED_CODES = new Set(["ACCESS_DENIED", "PROJECT_ACCESS_DENIED", "ROLE_NOT_ASSIGNED"]);

// Shared 401/403 routing for every Projects/Audit/Users feature hook: a
// session error always goes to the existing Session Expired flow, an
// authorization error always goes to the existing Access Denied screen.
// Returns whether the error was handled globally so the caller only falls
// back to its own inline error state for everything else (400/404/409/422/500).
export function useApiErrorHandler(onSessionExpired: () => void, onAccessDenied: () => void) {
  return useCallback(
    (err: unknown): boolean => {
      if (!(err instanceof ApiError)) return false;
      if (SESSION_ERROR_CODES.has(err.errorCode)) {
        onSessionExpired();
        return true;
      }
      if (ACCESS_DENIED_CODES.has(err.errorCode)) {
        onAccessDenied();
        return true;
      }
      return false;
    },
    [onSessionExpired, onAccessDenied],
  );
}
