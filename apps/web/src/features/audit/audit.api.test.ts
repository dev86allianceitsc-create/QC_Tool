import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse, mockTextResponse } from "../../test/mock-fetch";
import { exportAuditLogs, getAuditLog, listAuditLogs } from "./audit.api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("audit.api", () => {
  it("listAuditLogs sends filters/page/pageSize/sortBy/sortOrder as query params", async () => {
    const fetchMock = stubFetch(mockJsonResponse(200, { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }));

    await listAuditLogs(
      { search: "alice", eventType: "LOGIN_SUCCESS", result: "SUCCESS", projectId: "p1", from: "2026-01-01", to: "2026-01-31", page: 2, pageSize: 20, sortBy: "occurredAt", sortOrder: "asc" },
      "token-1",
    );

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/audit-logs?");
    expect(String(url)).toContain("search=alice");
    expect(String(url)).toContain("eventType=LOGIN_SUCCESS");
    expect(String(url)).toContain("result=SUCCESS");
    expect(String(url)).toContain("projectId=p1");
    expect(String(url)).toContain("from=2026-01-01");
    expect(String(url)).toContain("to=2026-01-31");
    expect(String(url)).toContain("page=2");
    expect(String(url)).toContain("pageSize=20");
    expect(String(url)).toContain("sortBy=occurredAt");
    expect(String(url)).toContain("sortOrder=asc");
  });

  it("getAuditLog GETs /audit-logs/:auditId", async () => {
    const fetchMock = stubFetch(
      mockJsonResponse(200, {
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
      }),
    );

    await getAuditLog("a1", "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/audit-logs/a1");
  });

  it("exportAuditLogs GETs /audit-logs/export with filters and returns raw text", async () => {
    const fetchMock = stubFetch(mockTextResponse(200, "auditId,eventType\r\na1,LOGIN_SUCCESS"));

    const csv = await exportAuditLogs({ result: "DENIED" }, "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/audit-logs/export?");
    expect(String(url)).toContain("result=DENIED");
    expect(csv).toBe("auditId,eventType\r\na1,LOGIN_SUCCESS");
  });
});
