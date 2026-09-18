import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useApiList } from "./useApiList";

const API_LIST_ITEM = {
  apiId: "a1",
  apiName: "List Orders",
  httpMethod: "GET",
  path: "/orders",
  description: null,
  creationSource: "MANUAL",
  configuredEnvironmentCount: 0,
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

describe("useApiList", () => {
  it("fetches the API list on mount", async () => {
    stubFetch({ items: [API_LIST_ITEM], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiList("p1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.apis).toEqual([API_LIST_ITEM]));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("routes 401 SESSION_EXPIRED through onSessionExpired instead of local error", async () => {
    stubFetch({ errorCode: "SESSION_EXPIRED", message: "expired" }, 401);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiList("p1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onSessionExpired).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("sets a local error for other failures", async () => {
    stubFetch({ errorCode: "NOT_FOUND", message: "Project not found" }, 404);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiList("p1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Project not found");
  });

  it("createApi POSTs then refetches the list", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiList("p1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(201, { ...API_LIST_ITEM }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { items: [API_LIST_ITEM], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 }));

    await act(async () => {
      await result.current.createApi({ apiName: "List Orders", httpMethod: "GET", path: "/orders", description: null });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, createInit] = fetchMock.mock.calls[1];
    expect(createInit.method).toBe("POST");
    await waitFor(() => expect(result.current.apis).toEqual([API_LIST_ITEM]));
  });

  it("importConfirm POSTs multipart then refetches the list", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiList("p1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = { results: [], summary: { imported: 1, skipped: 0, failed: 0 } };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, outcome));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { items: [API_LIST_ITEM], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 }));

    const file = new File(["{}"], "spec.json");
    await act(async () => {
      const result2 = await result.current.importConfirm(file, [{ httpMethod: "GET", path: "/orders" }]);
      expect(result2).toEqual(outcome);
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(result.current.apis).toEqual([API_LIST_ITEM]));
  });
});
