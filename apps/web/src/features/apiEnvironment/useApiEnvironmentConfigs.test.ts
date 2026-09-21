import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useApiEnvironmentConfigs } from "./useApiEnvironmentConfigs";

const CONFIG = {
  environmentId: "e1",
  environmentName: "QA",
  classification: "NON_PRODUCTION",
  environmentStatus: "ACTIVE",
  allowRun: true,
  urlStatus: "NOT_CONFIGURED",
  fullUrl: null,
  credentialStatus: "NOT_REQUIRED",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useApiEnvironmentConfigs", () => {
  it("fetches configs for the current API on mount", async () => {
    stubFetch({ apiId: "a1", items: [CONFIG] });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiEnvironmentConfigs("p1", "a1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.configs).toEqual([CONFIG]));
    expect(result.current.loading).toBe(false);
  });

  it("putConfig PUTs the full URL then refetches", async () => {
    const fetchMock = stubFetch({ apiId: "a1", items: [CONFIG] });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiEnvironmentConfigs("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const configured = { ...CONFIG, urlStatus: "CONFIGURED", fullUrl: "https://example.com/api" };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { apiId: "a1", environmentId: "e1", urlStatus: "CONFIGURED", fullUrl: "https://example.com/api", createdAt: "t", updatedAt: "t" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { apiId: "a1", items: [configured] }));

    await act(async () => {
      await result.current.putConfig("e1", "https://example.com/api");
    });

    const [url, putInit] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/apis/a1/environment-configs/e1");
    expect(putInit.method).toBe("PUT");
    expect(putInit.body).toBe(JSON.stringify({ fullUrl: "https://example.com/api" }));
    await waitFor(() => expect(result.current.configs[0].fullUrl).toBe("https://example.com/api"));
  });
});
