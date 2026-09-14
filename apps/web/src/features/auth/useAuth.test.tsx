import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useAuth } from "./useAuth";

const ACCESS_TOKEN_KEY = "qcTool.accessToken";
const OAUTH_STATE_KEY = "qcTool.googleOAuthState";

const SAMPLE_USER = { userId: "u1", email: "a@example.com", systemRole: "USER" as const, accountStatus: "ACTIVE" as const };

afterEach(() => {
  window.sessionStorage.clear();
  window.history.pushState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("useAuth", () => {
  it("shows Sign In when no accessToken is stored", async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.screen).toBe("signin"));
    expect(result.current.user).toBeNull();
  });

  it("restores the authenticated user via GET /users/me when a stored token is valid", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "valid-session-id");
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(200, SAMPLE_USER));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.user).toEqual(SAMPLE_USER));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/users/me");
    expect(init.headers.Authorization).toBe("Bearer valid-session-id");
  });

  it.each(["SESSION_INVALID", "SESSION_EXPIRED", "SESSION_REVOKED"])(
    "clears the stored token and stays signed out on %s",
    async (errorCode) => {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "bad-session-id");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          mockJsonResponse(401, { errorCode, message: "nope", details: [], requestId: "r1" }),
        ),
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.sessionExpired).toBe(true));
      expect(result.current.user).toBeNull();
      expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    },
  );

  it("stores the accessToken and sets the authenticated user after a successful Google login callback", async () => {
    window.sessionStorage.setItem(OAUTH_STATE_KEY, "state-abc");
    window.history.pushState({}, "", "/auth/google/callback?code=auth-code-1&state=state-abc");

    const loginResponse = {
      accessToken: "session-uuid-1",
      tokenType: "Bearer",
      expiresAt: new Date().toISOString(),
      user: SAMPLE_USER,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse(200, loginResponse)));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.user).toEqual(SAMPLE_USER));
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("session-uuid-1");
  });

  it("calls POST /auth/logout and clears the token, returning to Sign In", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "valid-session-id");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, SAMPLE_USER)) // restore on mount
      .mockResolvedValueOnce(mockJsonResponse(204)); // logout
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toEqual(SAMPLE_USER));

    await act(async () => {
      await result.current.signOut();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [logoutUrl, logoutInit] = fetchMock.mock.calls[1];
    expect(String(logoutUrl)).toContain("/auth/logout");
    expect(logoutInit.headers.Authorization).toBe("Bearer valid-session-id");
    expect(result.current.user).toBeNull();
    expect(result.current.screen).toBe("signin");
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("clears local state on logout even if the backend call fails", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "valid-session-id");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, SAMPLE_USER))
      .mockResolvedValueOnce(
        mockJsonResponse(401, { errorCode: "SESSION_INVALID", message: "nope", details: [], requestId: "r1" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toEqual(SAMPLE_USER));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });
});
