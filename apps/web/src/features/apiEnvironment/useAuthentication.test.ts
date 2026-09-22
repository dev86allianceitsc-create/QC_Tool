import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useAuthentication } from "./useAuthentication";
import type { AuthenticationConfiguration } from "./authentication.types";

function config(overrides: Partial<AuthenticationConfiguration> = {}): AuthenticationConfiguration {
  return {
    apiId: "a1",
    environmentId: "e1",
    authType: "NONE",
    credentialStatus: "NOT_REQUIRED",
    loginUrl: null,
    username: null,
    usernameField: null,
    passwordField: null,
    tokenResponsePath: null,
    updatedAt: "2026-09-22T09:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const onSessionExpired = vi.fn();
const onAccessDenied = vi.fn();

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useAuthentication — load", () => {
  it("GETs the Authentication Configuration for the selected API and Environment", async () => {
    const fetchMock = stubFetch(config());
    const { result } = renderHook(() => useAuthentication("p1", "a1", "e1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1/environment-configs/e1/authentication");
    expect(result.current.config).toEqual(config());
    expect(result.current.error).toBeNull();
  });

  it("never receives a Secret Credential Value — only a status (REQ-SEC-002)", async () => {
    stubFetch(config({ authType: "BEARER_TOKEN", credentialStatus: "CONFIGURED" }));
    const { result } = renderHook(() => useAuthentication("p1", "a1", "e1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config?.credentialStatus).toBe("CONFIGURED");
    expect(result.current.config).not.toHaveProperty("token");
    expect(result.current.config).not.toHaveProperty("password");
  });

  it("surfaces a non-auth failure inline and keeps config null", async () => {
    stubFetch({ errorCode: "NOT_FOUND", message: "API not found" }, 404);
    const { result } = renderHook(() => useAuthentication("p1", "a1", "e1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("API not found");
    expect(result.current.config).toBeNull();
  });

  it("does not fetch until an Environment is selected", () => {
    const fetchMock = stubFetch(config());
    renderHook(() => useAuthentication("p1", "a1", null, "token-1", onSessionExpired, onAccessDenied));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// REQ-SEC-002: an Authentication Configuration belongs to one API in one
// Environment. Nothing may carry over when the Environment changes.
describe("useAuthentication — per-Environment isolation", () => {
  it("re-fetches for the new Environment and never carries the previous one's status over", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, config({ environmentId: "e1", authType: "BEARER_TOKEN", credentialStatus: "CONFIGURED" })))
      .mockResolvedValueOnce(mockJsonResponse(200, config({ environmentId: "e2", authType: "BEARER_TOKEN", credentialStatus: "NOT_CONFIGURED" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ envId }) => useAuthentication("p1", "a1", envId, "token-1", onSessionExpired, onAccessDenied), {
      initialProps: { envId: "e1" as string | null },
    });
    await waitFor(() => expect(result.current.config?.credentialStatus).toBe("CONFIGURED"));

    rerender({ envId: "e2" });

    await waitFor(() => expect(result.current.config?.environmentId).toBe("e2"));
    expect(result.current.config?.credentialStatus).toBe("NOT_CONFIGURED");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/environment-configs/e2/authentication");
  });
});

describe("useAuthentication — mutations", () => {
  it("PUTs the configuration and adopts what the backend stored", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, config()))
      .mockResolvedValueOnce(mockJsonResponse(200, config({ authType: "BEARER_TOKEN", credentialStatus: "NOT_CONFIGURED" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuthentication("p1", "a1", "e1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveConfiguration({ authType: "BEARER_TOKEN" });
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/apis/a1/environment-configs/e1/authentication");
    expect((init as RequestInit).method).toBe("PUT");
    expect(result.current.config?.authType).toBe("BEARER_TOKEN");
    expect(result.current.config?.credentialStatus).toBe("NOT_CONFIGURED");
  });

  it("PUTs the credential to its own endpoint and stores only the returned status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, config({ authType: "BEARER_TOKEN", credentialStatus: "NOT_CONFIGURED" })))
      .mockResolvedValueOnce(mockJsonResponse(200, config({ authType: "BEARER_TOKEN", credentialStatus: "CONFIGURED" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuthentication("p1", "a1", "e1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveCredential({ token: "eyJhbGciOi" });
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/authentication/credential");
    expect((init as RequestInit).method).toBe("PUT");
    expect(result.current.config?.credentialStatus).toBe("CONFIGURED");
    expect(JSON.stringify(result.current.config)).not.toContain("eyJhbGciOi");
  });

  it("DELETEs the credential and reflects the resulting Not Configured status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, config({ authType: "BEARER_TOKEN", credentialStatus: "CONFIGURED" })))
      .mockResolvedValueOnce(mockJsonResponse(200, config({ authType: "BEARER_TOKEN", credentialStatus: "NOT_CONFIGURED" })));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuthentication("p1", "a1", "e1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeCredential();
    });

    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
    expect(result.current.config?.credentialStatus).toBe("NOT_CONFIGURED");
  });

  it("leaves the stored configuration untouched when a mutation fails (CL-3C-02)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, config({ authType: "BEARER_TOKEN", credentialStatus: "CONFIGURED" })))
      .mockResolvedValueOnce(mockJsonResponse(400, { errorCode: "VALIDATION_ERROR", message: "Invalid Authentication Type" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuthentication("p1", "a1", "e1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.saveConfiguration({ authType: "NONE" })).rejects.toThrow();
    });

    expect(result.current.config?.authType).toBe("BEARER_TOKEN");
    expect(result.current.config?.credentialStatus).toBe("CONFIGURED");
    expect(result.current.saving).toBe(false);
  });
});
