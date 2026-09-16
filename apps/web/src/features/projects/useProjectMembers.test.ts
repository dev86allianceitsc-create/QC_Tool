import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useProjectMembers } from "./useProjectMembers";

const MEMBER = { userId: "u1", email: "a@b.com", systemRole: "USER", accountStatus: "ACTIVE" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useProjectMembers", () => {
  it("fetches members with search/status as query params", async () => {
    const fetchMock = stubFetch({ items: [MEMBER], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 });

    const { result } = renderHook(() => useProjectMembers("p1", "token-1", "a@b", "ACTIVE", vi.fn(), vi.fn()));

    await waitFor(() => expect(result.current.members).toEqual([MEMBER]));
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/members?");
    expect(String(url)).toContain("search=a%40b");
    expect(String(url)).toContain("accountStatus=ACTIVE");
  });

  it("routes session-expired errors through onSessionExpired", async () => {
    stubFetch({ errorCode: "SESSION_INVALID", message: "bad" }, 401);
    const onSessionExpired = vi.fn();
    const { result } = renderHook(() => useProjectMembers("p1", "token-1", "", undefined, onSessionExpired, vi.fn()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onSessionExpired).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("addMember POSTs the email then refetches", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useProjectMembers("p1", "token-1", "", undefined, onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(201, { userId: "u2", email: "new@b.com", systemRole: "USER", accountStatus: "INVITED" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { items: [MEMBER], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 }));

    await act(async () => {
      await result.current.addMember("new@b.com");
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/members");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "new@b.com" }));
    await waitFor(() => expect(result.current.members).toEqual([MEMBER]));
  });

  it("removeMember DELETEs then refetches", async () => {
    const fetchMock = stubFetch({ items: [MEMBER], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 });
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useProjectMembers("p1", "token-1", "", undefined, onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 }));

    await act(async () => {
      await result.current.removeMember("u1");
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/members/u1");
    expect(init.method).toBe("DELETE");
    await waitFor(() => expect(result.current.members).toEqual([]));
  });
});
