import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getCurrentUser, googleLogin, logout as logoutRequest } from "./auth.api";
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from "./auth.storage";
import { consumePendingGoogleCallback, isGoogleLoginConfigured, startGoogleLogin } from "./google-oauth";
import type { AuthUser, LoginErrorType } from "./auth.types";

const ERROR_CODE_TO_LOGIN_ERROR: Record<string, LoginErrorType> = {
  EMAIL_NOT_VERIFIED: "email-not-verified",
  AUTHENTICATION_FAILED: "google-auth-failed",
  ACCOUNT_INACTIVE: "account-unavailable",
  ACCOUNT_BLOCKED: "account-unavailable",
  INVALID_SYSTEM_ROLE: "system-role-missing",
  ACCOUNT_NOT_REGISTERED: "user-not-registered",
  IDENTITY_LINK_CONFLICT: "account-linking-conflict",
};

// Session-layer error codes (from SessionGuard, via GET /users/me). Any of
// these means the stored accessToken is no longer usable and must be
// dropped — never trusted, never retried as-is.
const SESSION_ERROR_CODES = new Set(["SESSION_INVALID", "SESSION_EXPIRED", "SESSION_REVOKED"]);

function mapLoginError(err: unknown): LoginErrorType {
  if (err instanceof ApiError) {
    const mapped = ERROR_CODE_TO_LOGIN_ERROR[err.errorCode];
    if (mapped) return mapped;
  }
  return "service-unavailable";
}

export type AuthScreen = "signin" | "signin-loading" | "signin-error";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [screen, setScreen] = useState<AuthScreen>("signin-loading");
  const [loginError, setLoginError] = useState<LoginErrorType | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const enterSignIn = useCallback(() => {
    tokenRef.current = null;
    clearStoredAccessToken();
    setUser(null);
    setScreen("signin");
  }, []);

  const completeGoogleLogin = useCallback(async (authorizationCode: string) => {
    setScreen("signin-loading");
    try {
      const result = await googleLogin(authorizationCode);
      tokenRef.current = result.accessToken;
      setStoredAccessToken(result.accessToken);
      setSessionExpired(false);
      setUser(result.user);
      setScreen("signin");
    } catch (err) {
      setLoginError(mapLoginError(err));
      setScreen("signin-error");
    }
  }, []);

  // Restore session on mount: first handle a Google redirect callback (if
  // this load is one), otherwise validate any stored accessToken against
  // GET /users/me. Runs once — this is a startup boundary, not a live
  // effect that should re-fire on state changes it itself produces.
  useEffect(() => {
    const callback = consumePendingGoogleCallback();
    if (callback) {
      if (callback.status === "success") {
        void completeGoogleLogin(callback.authorizationCode);
      } else {
        setLoginError(callback.status === "cancelled" ? "auth-cancelled" : "google-auth-failed");
        setScreen("signin-error");
      }
      return;
    }

    const stored = getStoredAccessToken();
    if (!stored) {
      setScreen("signin");
      return;
    }

    tokenRef.current = stored;
    getCurrentUser(stored)
      .then((currentUser) => {
        setUser(currentUser);
        setScreen("signin");
      })
      .catch((err) => {
        if (err instanceof ApiError && SESSION_ERROR_CODES.has(err.errorCode)) {
          clearStoredAccessToken();
          tokenRef.current = null;
          setSessionExpired(true);
        }
        setScreen("signin");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = useCallback(() => {
    if (!isGoogleLoginConfigured()) {
      setLoginError("service-unavailable");
      setScreen("signin-error");
      return;
    }
    startGoogleLogin();
  }, []);

  const signOut = useCallback(async () => {
    const token = tokenRef.current;
    if (token) {
      try {
        await logoutRequest(token);
      } catch {
        // Even a failed logout call (including a genuine SESSION_INVALID)
        // must still clear local state — never leave a stale token behind.
      }
    }
    enterSignIn();
  }, [enterSignIn]);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
    enterSignIn();
  }, [enterSignIn]);

  // Dev-only affordance for manually exercising the SessionExpiredModal
  // without a real expired/revoked session. Never invoked from production
  // code paths — gated at the call site by import.meta.env.DEV.
  const debugShowSessionExpired = useCallback(() => setSessionExpired(true), []);

  return {
    user,
    screen,
    loginError,
    sessionExpired,
    signInWithGoogle,
    retryFromError: enterSignIn,
    signOut,
    dismissSessionExpired,
    debugShowSessionExpired,
  };
}
