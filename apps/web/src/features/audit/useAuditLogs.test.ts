import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse, mockTextResponse } from "../../test/mock-fetch";
import { useAuditLogs } from "./useAuditLogs";

const ITEM = { auditId: "a1", eventType: "LOGIN_SUCCESS", result: "SUCCESS", occurredAt: "2026-01-01T00:00:00.000Z", actorDisplay: "a@b.com", targetDisplay: "a@b.com", projectId: null };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useAuditLogs", () => {
  it("fetches with default page/pageSize/sortBy/sortOrder", async () => {
    const fetchMock = stubFetch(mockJsonResponse(200, { items: [ITEM], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }));

    const { result } = renderHook(() => useAuditLogs("token-1", vi.fn(), vi.fn()));

    await waitFor(() => expect(result.current.items).toEqual([ITEM]));
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/audit-logs?");
    expect(String(url)).toContain("page=1");
    expect(String(url)).toContain("pageSize=20");
    expect(String(url)).toContain("sortBy=occurredAt");
    expect(String(url)).toContain("sortOrder=desc");
  });

  it("routes session-expired errors through onSessionExpired", async () => {
    stubFetch(mockJsonResponse(401, { errorCode: "SESSION_INVALID", message: "bad", details: [], requestId: "r1" }));
    const onSessionExpired = vi.fn();
    const { result } = renderHook(() => useAuditLogs("token-1", onSessionExpired, vi.fn()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onSessionExpired).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("updateFilters resets page to 1 and resends filters as query params", async () => {
    const fetchMock = stubFetch(mockJsonResponse(200, { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }));
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useAuditLogs("token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));

    act(() => result.current.updateFilters({ search: "alice", result: "DENIED" }));
    await waitFor(() => {
      const [url] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(url)).toContain("page=1");
      expect(String(url)).toContain("search=alice");
      expect(String(url)).toContain("result=DENIED");
    });
  });

  it("exportCsv fetches CSV text and triggers a download", async () => {
    stubFetch(mockJsonResponse(200, { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }));
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useAuditLogs("token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockTextResponse(200, "auditId\r\na1"));

    await act(async () => {
      await result.current.exportCsv();
    });

    expect(result.current.exportState).toBe("success");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
