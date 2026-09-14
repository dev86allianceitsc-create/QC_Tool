// Browser-side half of Google's Authorization Code Flow: builds the redirect
// to Google's consent screen and parses the code back out of the return
// redirect. The actual code-for-token exchange (which needs the confidential
// client secret) happens only on the backend, in GoogleIdentityService — this
// module never sees a client secret, id_token, or access_token from Google.
//
// Note on PKCE: the CURRENT backend (GoogleLoginDto/GoogleIdentityService)
// exchanges the code as a confidential client (client_secret, no
// code_verifier field) and does not accept a code_verifier from the
// frontend. Sending a PKCE code_challenge here without the backend later
// presenting the matching code_verifier would make Google's token exchange
// fail, so this redirect intentionally omits PKCE parameters to stay
// consistent with the backend contract as it actually exists today. This is
// flagged in the final report as a technical deviation from the milestone's
// "Authorization Code Flow + PKCE" phrasing, not a business-semantic one —
// the frontend/backend boundary (frontend only ever obtains a code) is
// preserved exactly as specified.
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_STATE_KEY = "qcTool.googleOAuthState";
const CALLBACK_PATH = "/auth/google/callback";

export function isGoogleLoginConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

function redirectUri(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

export function startGoogleLogin(): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured");
  }

  const state = crypto.randomUUID();
  window.sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
}

export type GoogleCallbackResult =
  | { status: "success"; authorizationCode: string }
  | { status: "cancelled" }
  | { status: "invalid" };

// Detects and consumes a pending Google redirect callback on the current
// URL (if any), clearing it from the address bar so a reload can't replay
// the single-use authorization code. Returns null when this load is not a
// callback at all.
export function consumePendingGoogleCallback(): GoogleCallbackResult | null {
  if (window.location.pathname !== CALLBACK_PATH) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const errorParam = params.get("error");
  const expectedState = window.sessionStorage.getItem(OAUTH_STATE_KEY);
  window.sessionStorage.removeItem(OAUTH_STATE_KEY);
  window.history.replaceState({}, "", "/");

  if (errorParam === "access_denied") {
    return { status: "cancelled" };
  }
  if (!code || !state || state !== expectedState) {
    return { status: "invalid" };
  }
  return { status: "success", authorizationCode: code };
}
