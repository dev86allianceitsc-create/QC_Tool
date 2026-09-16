import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useAuditLogDetail } from "./useAuditLogDetail";

const DETAIL = {
  auditId: "a1",
  eventType: "LOGIN_SUCCESS",
  result: "SUCCESS",
  occurredAt: "2026-01-01T00:00:00.000Z",
  actorDisplay: "a@b.com",
  targetDisplay: "a@b.com",
  projectId: null,
  actorUserId: "u1",
  targetType: "USER",
  targetId: "u1",
  beforeData: null,
  afterData: null,
  requestId: "req-1",
  detail: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useAuditLogDetail", () => {
  it("open fetches the detail by id", async () => {
    const fetchMock = stubFetch(mockJsonResponse(200, DETAIL));
    const { result } = renderHook(() => useAuditLogDetail("token-1", vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.open("a1");
    });

    expect(result.current.detail).toEqual(DETAIL);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/audit-logs/a1");
  });

  it("routes session-expired errors through onSessionExpired", async () => {
    stubFetch(mockJsonResponse(401, { errorCode: "SESSION_EXPIRED", message: "bad", details: [], requestId: "r1" }));
    const onSessionExpired = vi.fn();
    const { result } = renderHook(() => useAuditLogDetail("token-1", onSessionExpired, vi.fn()));

    await act(async () => {
      await result.current.open("a1");
    });

    expect(onSessionExpired).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("close clears the detail state", async () => {
    stubFetch(mockJsonResponse(200, DETAIL));
    const { result } = renderHook(() => useAuditLogDetail("token-1", vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.open("a1");
    });
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    act(() => result.current.close());
    expect(result.current.detail).toBeNull();
    expect(result.current.auditId).toBeNull();
  });
});
