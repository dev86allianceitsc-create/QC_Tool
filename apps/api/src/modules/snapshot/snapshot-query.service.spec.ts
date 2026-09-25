import { SnapshotQueryService } from "./snapshot-query.service";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: "s-1",
    projectId: "p-1",
    apiId: "a-1",
    environmentId: "e-1",
    projectNameAtExecution: "Project",
    apiNameAtExecution: "API",
    environmentNameAtExecution: "Env",
    runId: "run-1",
    runExecutionId: "re-1",
    initiatedByUserId: "u-1",
    initiatedByLabel: "user@example.com",
    authContextKey: "ctx-1",
    authIdentityLabel: null,
    apiVersion: "1",
    databaseVersion: "1",
    requestedAt: new Date("2026-01-01T00:00:00Z"),
    startedAt: new Date("2026-01-01T00:00:01Z"),
    completedAt: new Date("2026-01-01T00:00:02Z"),
    durationMs: 1000,
    createdAt: new Date("2026-01-01T00:00:02Z"),
    executionOutcome: "RESPONSE_RECEIVED",
    httpMethod: "GET",
    requestUrl: "https://example.test/x",
    requestContentType: null,
    requestBodySizeBytes: null,
    requestHeaders: [],
    httpStatusCode: 200,
    responseContentType: "application/json",
    responseBodySizeBytes: null,
    responseHeaders: [],
    payload: null,
    invalidation: null,
    ...overrides,
  };
}

describe("SnapshotQueryService.getSnapshot", () => {
  function makeService(snapshot: unknown) {
    const prisma = {
      snapshot: { findFirst: jest.fn().mockResolvedValue(snapshot) },
    };
    const auditWriter = {};
    const service = new SnapshotQueryService(prisma as never, auditWriter as never);
    return { service, prisma };
  }

  it("returns request/response headers exactly as stored, as ordered {key,value} pairs", async () => {
    const requestHeaders = [
      { key: "authorization", value: "Bearer [REDACTED]" },
      { key: "x-custom", value: "one" },
    ];
    const responseHeaders = [
      { key: "content-type", value: "application/json" },
      { key: "set-cookie", value: "a=1" },
      { key: "set-cookie", value: "b=2" },
    ];
    const { service } = makeService(baseRow({ requestHeaders, responseHeaders }));

    const detail = await service.getSnapshot("p-1", "s-1");

    expect(detail.request.headers).toEqual(requestHeaders);
    expect(detail.response.headers).toEqual(responseHeaders);
  });

  it("returns null for both request and response headers on a pre-migration Snapshot (columns never backfilled)", async () => {
    const { service } = makeService(baseRow({ requestHeaders: null, responseHeaders: null }));

    const detail = await service.getSnapshot("p-1", "s-1");

    expect(detail.request.headers).toBeNull();
    expect(detail.response.headers).toBeNull();
  });

  it("does not conflate a null requestHeaders with a null responseHeaders — each column is read independently", async () => {
    const { service } = makeService(baseRow({ requestHeaders: null, responseHeaders: [{ key: "content-type", value: "text/plain" }] }));

    const detail = await service.getSnapshot("p-1", "s-1");

    expect(detail.request.headers).toBeNull();
    expect(detail.response.headers).toEqual([{ key: "content-type", value: "text/plain" }]);
  });
});
