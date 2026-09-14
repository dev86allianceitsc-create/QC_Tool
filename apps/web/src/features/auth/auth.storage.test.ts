import { afterEach, describe, expect, it } from "vitest";
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from "./auth.storage";

describe("auth.storage", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getStoredAccessToken()).toBeNull();
  });

  it("round-trips a stored access token", () => {
    setStoredAccessToken("token-abc");
    expect(getStoredAccessToken()).toBe("token-abc");
  });

  it("clears the stored access token", () => {
    setStoredAccessToken("token-abc");
    clearStoredAccessToken();
    expect(getStoredAccessToken()).toBeNull();
  });

  it("never persists the access token to localStorage", () => {
    setStoredAccessToken("token-abc");
    expect(window.localStorage.getItem("qcTool.accessToken")).toBeNull();
  });
});
