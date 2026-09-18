import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useApiDetail } from "./useApiDetail";

const API_DETAIL = {
  apiId: "a1",
  projectId: "p1",
  apiName: "List Orders",
  httpMethod: "GET",
  path: "/orders",
  description: null,
  creationSource: "MANUAL",
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

describe("useApiDetail", () => {
  it("fetches the API by id on mount (works on a direct refresh)", async () => {
    stubFetch(API_DETAIL);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiDetail("p1", "a1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.api).toEqual(API_DETAIL));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("routes 403 PROJECT_ACCESS_DENIED through onAccessDenied", async () => {
    stubFetch({ errorCode: "PROJECT_ACCESS_DENIED", message: "denied" }, 403);
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiDetail("p1", "a1", "token-1", vi.fn(), onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onAccessDenied).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("update PATCHes the API then refetches", async () => {
    const fetchMock = stubFetch(API_DETAIL);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiDetail("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...API_DETAIL, apiName: "Renamed" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...API_DETAIL, apiName: "Renamed" }));

    await act(async () => {
      await result.current.updateApi({ apiName: "Renamed" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, patchInit] = fetchMock.mock.calls[1];
    expect(patchInit.method).toBe("PATCH");
    expect(patchInit.body).toBe(JSON.stringify({ apiName: "Renamed" }));
    await waitFor(() => expect(result.current.api?.apiName).toBe("Renamed"));
  });

  it("deleteApi DELETEs the API", async () => {
    const fetchMock = stubFetch(API_DETAIL);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiDetail("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));

    await act(async () => {
      await result.current.deleteApi();
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/apis/a1");
    expect(init.method).toBe("DELETE");
  });
});
