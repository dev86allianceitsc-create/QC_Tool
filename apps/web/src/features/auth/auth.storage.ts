// sessionStorage only — per the approved design, the QC Tool accessToken is
// never persisted to localStorage and never carried as a cookie.
const ACCESS_TOKEN_KEY = "qcTool.accessToken";

export function getStoredAccessToken(): string | null {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string): void {
  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // sessionStorage unavailable (e.g. a locked-down browsing mode) — the
    // session simply won't survive a reload, which is an acceptable
    // degradation rather than a hard failure.
  }
}

export function clearStoredAccessToken(): void {
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // no-op
  }
}
