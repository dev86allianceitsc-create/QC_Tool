import { Prisma } from "@prisma/client";
import { SnapshotCreationInput, SnapshotService } from "./snapshot.service";
import { SNAPSHOT_MAX_PAYLOAD_BYTES } from "./snapshot.constants";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`run_execution_id`)", {
    code: "P2002",
    clientVersion: "test",
  });
}

function baseInput(overrides: Partial<SnapshotCreationInput> = {}): SnapshotCreationInput {
  return {
    runExecutionId: "re-1",
    runId: "run-1",
    projectId: "p-1",
    apiId: "a-1",
    environmentId: "e-1",
    projectNameAtExecution: "Project",
    apiNameAtExecution: "API",
    environmentNameAtExecution: "Env",
    authType: "NONE",
    authContextVersion: 1,
    authIdentityLabel: null,
    initiatedByUserId: "u-1",
    initiatedByLabel: "user@example.com",
    httpMethod: "GET",
    requestUrl: "https://example.test/x",
    requestContentType: null,
    requestHeaders: [],
    requestBody: null,
    httpStatusCode: 200,
    responseContentType: "application/json",
    responseHeaders: [{ key: "content-type", value: "application/json" }],
    responseBody: Buffer.from('{"ok":true}', "utf-8"),
    responseBodyOversized: false,
    responseCompleteness: "FULL",
    contentRangeHeader: null,
    requestedAt: new Date(),
    startedAt: new Date(),
    completedAt: new Date(),
    durationMs: 10,
    apiVersion: "1",
    databaseVersion: "1",
    executionOutcome: "RESPONSE_RECEIVED",
    ...overrides,
  };
}

describe("SnapshotService", () => {
  function makeService() {
    const tx = {
      snapshot: { create: jest.fn().mockResolvedValue({ snapshotId: "s-1" }) },
      snapshotSaveAttempt: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: {
      $transaction: jest.Mock;
      snapshotSaveAttempt: { create: jest.Mock };
    } = {
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
      snapshotSaveAttempt: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SnapshotService(prisma as never);
    return { service, prisma, tx };
  }

  it("creates a Snapshot + SnapshotPayload + a SUCCEEDED save attempt atomically for an eligible 2xx execution", async () => {
    const { service, prisma, tx } = makeService();

    await service.tryCreateSnapshot(baseInput());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.snapshot.create).toHaveBeenCalledTimes(1);
    const createArgs = tx.snapshot.create.mock.calls[0][0];
    expect(createArgs.data.runExecutionId).toBe("re-1");
    expect(createArgs.data.payload.create.responseBody).toBeInstanceOf(Uint8Array);
    expect(tx.snapshotSaveAttempt.create).toHaveBeenCalledWith({ data: { runExecutionId: "re-1", attemptStatus: "SUCCEEDED" } });
  });

  it("persists request/response headers into snapshot.create exactly as received, without re-deriving or re-masking them itself", async () => {
    const { service, tx } = makeService();
    // Unmasked Authorization on purpose: SnapshotService receives whatever
    // toSnapshotRequestHeaderPairs (run-dispatch.util.ts) already produced —
    // by product decision that function no longer masks Authorization — and
    // must not apply any masking of its own on top.
    const requestHeaders = [
      { key: "authorization", value: "Bearer secret-token-abc" },
      { key: "x-custom", value: "one" },
      { key: "x-custom", value: "two" },
    ];
    const responseHeaders = [
      { key: "content-type", value: "application/json" },
      { key: "set-cookie", value: "a=1" },
      { key: "set-cookie", value: "b=2" },
    ];

    await service.tryCreateSnapshot(baseInput({ requestHeaders, responseHeaders }));

    const createArgs = tx.snapshot.create.mock.calls[0][0];
    expect(createArgs.data.requestHeaders).toEqual(requestHeaders);
    expect(createArgs.data.responseHeaders).toEqual(responseHeaders);
    // Same array references flow straight into the Prisma call — SnapshotService
    // trusts the caller's shape/ordering (toSnapshotRequestHeaderPairs /
    // toSnapshotResponseHeaderPairs in run-dispatch.util.ts) and never
    // reshapes or masks headers itself.
    expect(createArgs.data.requestHeaders).toBe(requestHeaders);
    expect(createArgs.data.responseHeaders).toBe(responseHeaders);
  });

  it("persists null request/response headers unchanged when the caller provides none", async () => {
    const { service, tx } = makeService();

    await service.tryCreateSnapshot(baseInput({ requestHeaders: [], responseHeaders: [] }));

    const createArgs = tx.snapshot.create.mock.calls[0][0];
    expect(createArgs.data.requestHeaders).toEqual([]);
    expect(createArgs.data.responseHeaders).toEqual([]);
  });

  it("is a no-op (defensive re-check) when httpStatusCode is outside the 2xx range", async () => {
    const { service, prisma } = makeService();

    await service.tryCreateSnapshot(baseInput({ httpStatusCode: 404 }));

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.snapshotSaveAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects an oversized request body: logs a FAILED/PAYLOAD_TOO_LARGE attempt and never creates a Snapshot", async () => {
    const { service, prisma } = makeService();
    const oversized = Buffer.alloc(SNAPSHOT_MAX_PAYLOAD_BYTES + 1);

    await service.tryCreateSnapshot(baseInput({ requestBody: oversized }));

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.snapshotSaveAttempt.create).toHaveBeenCalledWith({
      data: { runExecutionId: "re-1", attemptStatus: "FAILED", errorReasonCode: "PAYLOAD_TOO_LARGE", errorDetail: expect.any(String) },
    });
  });

  it("rejects an oversized response body flagged upstream via responseBodyOversized, even if the buffered bytes are small", async () => {
    const { service, prisma } = makeService();

    await service.tryCreateSnapshot(baseInput({ responseBodyOversized: true }));

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.snapshotSaveAttempt.create).toHaveBeenCalledWith({
      data: { runExecutionId: "re-1", attemptStatus: "FAILED", errorReasonCode: "PAYLOAD_TOO_LARGE", errorDetail: expect.any(String) },
    });
  });

  it("treats a unique-violation (uq_snapshots_run_execution_id) as a benign idempotent no-op on retry, not a failure", async () => {
    const { service, prisma } = makeService();
    prisma.$transaction.mockRejectedValueOnce(p2002());

    await expect(service.tryCreateSnapshot(baseInput())).resolves.toBeUndefined();

    expect(prisma.snapshotSaveAttempt.create).not.toHaveBeenCalled();
  });

  it("logs a FAILED/UNKNOWN_ERROR attempt and swallows any other transaction failure, never propagating to the caller", async () => {
    const { service, prisma } = makeService();
    prisma.$transaction.mockRejectedValueOnce(new Error("connection reset"));

    await expect(service.tryCreateSnapshot(baseInput())).resolves.toBeUndefined();

    expect(prisma.snapshotSaveAttempt.create).toHaveBeenCalledWith({
      data: { runExecutionId: "re-1", attemptStatus: "FAILED", errorReasonCode: "UNKNOWN_ERROR", errorDetail: "connection reset" },
    });
  });

  it("never rethrows even if recording the failed attempt itself also fails", async () => {
    const { service, prisma } = makeService();
    prisma.$transaction.mockRejectedValueOnce(new Error("boom"));
    prisma.snapshotSaveAttempt.create.mockRejectedValueOnce(new Error("attempt log also failed"));

    await expect(service.tryCreateSnapshot(baseInput())).resolves.toBeUndefined();
  });
});
