import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useProjectDetail } from "./useProjectDetail";

const PROJECT = {
  projectId: "p1",
  projectName: "Alpha",
  description: "d",
  projectStatus: "ACTIVE",
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

describe("useProjectDetail", () => {
  it("fetches the project on mount", async () => {
    stubFetch(PROJECT);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();

    const { result } = renderHook(() => useProjectDetail("p1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.project).toEqual(PROJECT));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("routes 401 SESSION_EXPIRED through onSessionExpired instead of local error", async () => {
    stubFetch({ errorCode: "SESSION_EXPIRED", message: "expired" }, 401);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();

    const { result } = renderHook(() => useProjectDetail("p1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onSessionExpired).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("routes 403 PROJECT_ACCESS_DENIED through onAccessDenied", async () => {
    stubFetch({ errorCode: "PROJECT_ACCESS_DENIED", message: "denied" }, 403);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();

    const { result } = renderHook(() => useProjectDetail("p1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onAccessDenied).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("sets a local error for other failures", async () => {
    stubFetch({ errorCode: "NOT_FOUND", message: "Project not found" }, 404);
    const { result } = renderHook(() => useProjectDetail("p1", "token-1", vi.fn(), vi.fn()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Project not found");
  });

  it("update PATCHes the project then refetches", async () => {
    const fetchMock = stubFetch(PROJECT);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useProjectDetail("p1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...PROJECT, projectStatus: "INACTIVE" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...PROJECT, projectStatus: "INACTIVE" }));

    await act(async () => {
      await result.current.update({ projectStatus: "INACTIVE" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, patchInit] = fetchMock.mock.calls[1];
    expect(patchInit.method).toBe("PATCH");
    expect(patchInit.body).toBe(JSON.stringify({ projectStatus: "INACTIVE" }));
    await waitFor(() => expect(result.current.project?.projectStatus).toBe("INACTIVE"));
  });

  it("remove DELETEs the project", async () => {
    const fetchMock = stubFetch(PROJECT);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useProjectDetail("p1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));

    await act(async () => {
      await result.current.remove();
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1");
    expect(init.method).toBe("DELETE");
  });
});
