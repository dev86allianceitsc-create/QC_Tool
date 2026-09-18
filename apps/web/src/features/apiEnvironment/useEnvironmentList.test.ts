import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useEnvironmentList } from "./useEnvironmentList";

const ENVIRONMENT = {
  environmentId: "e1",
  environmentName: "QA",
  classification: "NON_PRODUCTION",
  allowRun: true,
  environmentStatus: "ACTIVE",
  createdAt: "t1",
  updatedAt: "t1",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useEnvironmentList", () => {
  it("fetches the environment list on mount", async () => {
    stubFetch({ items: [ENVIRONMENT], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useEnvironmentList("p1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.environments).toEqual([ENVIRONMENT]));
    expect(result.current.loading).toBe(false);
  });

  it("createEnvironment POSTs without an allowRun field, then refetches", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useEnvironmentList("p1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(201, ENVIRONMENT));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { items: [ENVIRONMENT], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 }));

    await act(async () => {
      await result.current.createEnvironment({ environmentName: "QA", classification: "NON_PRODUCTION" });
    });

    const [, createInit] = fetchMock.mock.calls[1];
    expect(createInit.method).toBe("POST");
    expect(createInit.body).toBe(JSON.stringify({ environmentName: "QA", classification: "NON_PRODUCTION" }));
    await waitFor(() => expect(result.current.environments).toEqual([ENVIRONMENT]));
  });

  it("updateEnvironment PATCHes allowRun then refetches", async () => {
    const fetchMock = stubFetch({ items: [ENVIRONMENT], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useEnvironmentList("p1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated = { ...ENVIRONMENT, allowRun: false };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, updated));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { items: [updated], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 }));

    await act(async () => {
      await result.current.updateEnvironment("e1", { allowRun: false });
    });

    const [url, patchInit] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/environments/e1");
    expect(patchInit.method).toBe("PATCH");
    expect(patchInit.body).toBe(JSON.stringify({ allowRun: false }));
    await waitFor(() => expect(result.current.environments[0].allowRun).toBe(false));
  });
});
