import { ComparisonEngineService } from "./comparison-engine.service";

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: "snap-a",
    projectId: "p-1",
    apiId: "a-1",
    environmentId: "e-1",
    authContextKey: "ctx-key",
    httpMethod: "GET",
    requestUrl: "https://api.example.com/v1/widgets",
    requestHeaders: [{ key: "Accept", value: "application/json" }],
    httpStatusCode: 200,
    responseHeaders: [{ key: "Content-Type", value: "application/json" }],
    payload: { requestBody: null, responseBody: null },
    invalidation: null,
    ...overrides,
  };
}

describe("ComparisonEngineService", () => {
  function makeEngine() {
    const comparisonService: { blockAttempt: jest.Mock; completeAttempt: jest.Mock; failAttempt: jest.Mock } = {
      blockAttempt: jest.fn().mockResolvedValue({ ok: true }),
      completeAttempt: jest.fn().mockResolvedValue({ ok: true }),
      failAttempt: jest.fn().mockResolvedValue({ ok: true }),
    };
    const prisma: { comparisonAttempt: { findUnique: jest.Mock }; comparison: { findUnique: jest.Mock }; snapshot: { findUnique: jest.Mock } } = {
      comparisonAttempt: { findUnique: jest.fn().mockResolvedValue({ comparisonId: "cmp-1" }) },
      comparison: { findUnique: jest.fn().mockResolvedValue({ baselineSnapshotId: "snap-a", targetSnapshotId: "snap-b", sourceKind: "AUTO_EXECUTION" }) },
      snapshot: {
        findUnique: jest.fn((args: { where: { snapshotId: string } }) =>
          Promise.resolve(args.where.snapshotId === "snap-a" ? snapshotRow({ snapshotId: "snap-a" }) : snapshotRow({ snapshotId: "snap-b" })),
        ),
      },
    };
    const ignoreRulesService: { listActiveRulesForScope: jest.Mock } = {
      listActiveRulesForScope: jest.fn().mockResolvedValue([]),
    };
    const engine = new ComparisonEngineService(prisma as never, comparisonService as never, ignoreRulesService as never);
    return { engine, prisma, comparisonService, ignoreRulesService };
  }

  it("loads both Snapshots by ID with payload and invalidation included", async () => {
    const { engine, prisma } = makeEngine();

    await engine.processAttempt("att-1");

    expect(prisma.snapshot.findUnique).toHaveBeenCalledWith({ where: { snapshotId: "snap-a" }, include: { payload: true, invalidation: true } });
    expect(prisma.snapshot.findUnique).toHaveBeenCalledWith({ where: { snapshotId: "snap-b" }, include: { payload: true, invalidation: true } });
  });

  it("marks the attempt FAILED/ENGINE_ERROR instead of stalling QUEUED forever when the attempt no longer exists", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.comparisonAttempt.findUnique.mockResolvedValue(null);

    await engine.processAttempt("att-1");

    expect(comparisonService.blockAttempt).not.toHaveBeenCalled();
    expect(comparisonService.completeAttempt).not.toHaveBeenCalled();
    expect(comparisonService.failAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "ELIGIBILITY",
      reasonCode: "ENGINE_ERROR",
      reasonDetailSafe: "Comparison attempt, its Comparison, or a referenced Snapshot could not be found",
      inputCheckOutcome: null,
    });
  });

  it("marks the attempt FAILED/ENGINE_ERROR instead of stalling QUEUED forever when the Comparison no longer exists", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.comparison.findUnique.mockResolvedValue(null);

    await engine.processAttempt("att-1");

    expect(comparisonService.blockAttempt).not.toHaveBeenCalled();
    expect(comparisonService.completeAttempt).not.toHaveBeenCalled();
    expect(comparisonService.failAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "ELIGIBILITY",
      reasonCode: "ENGINE_ERROR",
      reasonDetailSafe: "Comparison attempt, its Comparison, or a referenced Snapshot could not be found",
      inputCheckOutcome: null,
    });
  });

  it("marks the attempt FAILED/ENGINE_ERROR instead of stalling QUEUED forever when either Snapshot no longer exists", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.snapshot.findUnique.mockResolvedValueOnce(null);

    await engine.processAttempt("att-1");

    expect(comparisonService.blockAttempt).not.toHaveBeenCalled();
    expect(comparisonService.completeAttempt).not.toHaveBeenCalled();
    expect(comparisonService.failAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "ELIGIBILITY",
      reasonCode: "ENGINE_ERROR",
      reasonDetailSafe: "Comparison attempt, its Comparison, or a referenced Snapshot could not be found",
      inputCheckOutcome: null,
    });
  });

  it("blocks at ELIGIBILITY with a safe reason when the pair fails eligibility, never reaching INPUT/OUTPUT", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.snapshot.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
      Promise.resolve(snapshotRow({ snapshotId: args.where.snapshotId, environmentId: args.where.snapshotId === "snap-a" ? "e-1" : "e-2" })),
    );

    await engine.processAttempt("att-1");

    expect(comparisonService.blockAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "ELIGIBILITY",
      reasonCode: "ENVIRONMENT_MISMATCH",
      reasonDetailSafe: "Snapshot A and B were captured in different Environments",
    });
    expect(comparisonService.completeAttempt).not.toHaveBeenCalled();
  });

  it("blocks at INPUT with CONFIG_DRIFT_DETECTED (not INPUT_MISMATCH) when an AUTO_EXECUTION pair's resolved request still drifts", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.snapshot.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
      Promise.resolve(snapshotRow({ snapshotId: args.where.snapshotId, httpMethod: args.where.snapshotId === "snap-a" ? "GET" : "POST" })),
    );

    await engine.processAttempt("att-1");

    expect(comparisonService.blockAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "INPUT",
      reasonCode: "CONFIG_DRIFT_DETECTED",
      reasonDetailSafe: "Resolved request differs from the baseline despite matching test case identity (configuration likely changed)",
      inputCheckOutcome: "MISMATCH",
      findings: [expect.objectContaining({ component: "METHOD", differenceKind: "VALUE" })],
    });
    expect(comparisonService.completeAttempt).not.toHaveBeenCalled();
  });

  it("blocks at INPUT with CONFIG_DRIFT_DETECTED for a RERUN_EXECUTION pair too — same automatic treatment as AUTO_EXECUTION", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.comparison.findUnique.mockResolvedValue({ baselineSnapshotId: "snap-a", targetSnapshotId: "snap-b", sourceKind: "RERUN_EXECUTION" });
    prisma.snapshot.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
      Promise.resolve(snapshotRow({ snapshotId: args.where.snapshotId, httpMethod: args.where.snapshotId === "snap-a" ? "GET" : "POST" })),
    );

    await engine.processAttempt("att-1");

    expect(comparisonService.blockAttempt).toHaveBeenCalledWith(
      "att-1",
      expect.objectContaining({ stoppedAtGate: "INPUT", reasonCode: "CONFIG_DRIFT_DETECTED", inputCheckOutcome: "MISMATCH" }),
    );
  });

  it("blocks at INPUT with the original INPUT_MISMATCH per-finding summary for a MANUAL_PAIR comparison — never CONFIG_DRIFT_DETECTED", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.comparison.findUnique.mockResolvedValue({ baselineSnapshotId: "snap-a", targetSnapshotId: "snap-b", sourceKind: "MANUAL_PAIR" });
    prisma.snapshot.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
      Promise.resolve(snapshotRow({ snapshotId: args.where.snapshotId, httpMethod: args.where.snapshotId === "snap-a" ? "GET" : "POST" })),
    );

    await engine.processAttempt("att-1");

    expect(comparisonService.blockAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "INPUT",
      reasonCode: "INPUT_MISMATCH",
      reasonDetailSafe: "Method differs (A=GET, B=POST)",
      inputCheckOutcome: "MISMATCH",
      findings: [expect.objectContaining({ component: "METHOD", differenceKind: "VALUE" })],
    });
    expect(comparisonService.completeAttempt).not.toHaveBeenCalled();
  });

  it("completes with SAME and no findings when input and output both fully match", async () => {
    const { engine, comparisonService } = makeEngine();

    await engine.processAttempt("att-1");

    expect(comparisonService.completeAttempt).toHaveBeenCalledWith("att-1", "SAME", [], []);
    expect(comparisonService.blockAttempt).not.toHaveBeenCalled();
  });

  it("completes with DIFFERENT and the OUTPUT findings when input matches but output differs", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.snapshot.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
      Promise.resolve(snapshotRow({ snapshotId: args.where.snapshotId, httpStatusCode: args.where.snapshotId === "snap-a" ? 200 : 500 })),
    );

    await engine.processAttempt("att-1");

    expect(comparisonService.completeAttempt).toHaveBeenCalledWith("att-1", "DIFFERENT", [expect.objectContaining({ component: "HTTP_STATUS", differenceKind: "VALUE" })], []);
  });

  it("looks up active Ignore Rules scoped to the pair's own project/api", async () => {
    const { engine, ignoreRulesService } = makeEngine();

    await engine.processAttempt("att-1");

    expect(ignoreRulesService.listActiveRulesForScope).toHaveBeenCalledWith("p-1", "a-1");
  });

  it("suppresses a RESPONSE_BODY finding matched by an active Ignore Rule, completing SAME with the applied rule recorded", async () => {
    const { engine, prisma, ignoreRulesService, comparisonService } = makeEngine();
    prisma.snapshot.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
      Promise.resolve(
        snapshotRow({
          snapshotId: args.where.snapshotId,
          payload: { requestBody: null, responseBody: Buffer.from(JSON.stringify({ Data: { Status: args.where.snapshotId === "snap-a" ? "OPEN" : "CLOSED" } })) },
        }),
      ),
    );
    ignoreRulesService.listActiveRulesForScope.mockResolvedValue([{ ignoreRuleId: "rule-1", scope: "API", path: "$.Data.Status" }]);

    await engine.processAttempt("att-1");

    expect(comparisonService.completeAttempt).toHaveBeenCalledWith("att-1", "SAME", [], [{ ignoreRuleId: "rule-1", scope: "API", path: "$.Data.Status", suppressedFindingCount: 1 }]);
  });

  it("leaves a non-ignored field as a DIFFERENT finding while suppressing only the field an active Ignore Rule matches", async () => {
    const { engine, prisma, ignoreRulesService, comparisonService } = makeEngine();
    prisma.snapshot.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
      Promise.resolve(
        snapshotRow({
          snapshotId: args.where.snapshotId,
          payload: {
            requestBody: null,
            responseBody: Buffer.from(
              JSON.stringify(
                args.where.snapshotId === "snap-a" ? { Data: { Status: "OPEN" }, StartTime: 100 } : { Data: { Status: "CLOSED" }, StartTime: 300 },
              ),
            ),
          },
        }),
      ),
    );
    ignoreRulesService.listActiveRulesForScope.mockResolvedValue([{ ignoreRuleId: "rule-1", scope: "API", path: "$.StartTime" }]);

    await engine.processAttempt("att-1");

    expect(comparisonService.completeAttempt).toHaveBeenCalledWith(
      "att-1",
      "DIFFERENT",
      [expect.objectContaining({ component: "RESPONSE_BODY", locationPath: "$.Data.Status" })],
      [{ ignoreRuleId: "rule-1", scope: "API", path: "$.StartTime", suppressedFindingCount: 1 }],
    );
  });

  it("marks the attempt FAILED/ENGINE_ERROR at the gate in progress when an unexpected exception is thrown while loading Snapshots", async () => {
    const { engine, prisma, comparisonService } = makeEngine();
    prisma.snapshot.findUnique.mockRejectedValue(new Error("connection reset"));

    await engine.processAttempt("att-1");

    expect(comparisonService.failAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "ELIGIBILITY",
      reasonCode: "ENGINE_ERROR",
      reasonDetailSafe: "Unexpected error while processing this Comparison attempt",
      inputCheckOutcome: null,
    });
  });

  it("marks the attempt FAILED/PERSISTENCE_ERROR, distinct from ENGINE_ERROR, when the final publish itself throws", async () => {
    const { engine, comparisonService } = makeEngine();
    comparisonService.completeAttempt.mockRejectedValue(new Error("write conflict"));

    await engine.processAttempt("att-1");

    expect(comparisonService.failAttempt).toHaveBeenCalledWith("att-1", {
      stoppedAtGate: "PERSISTENCE",
      reasonCode: "PERSISTENCE_ERROR",
      reasonDetailSafe: "Comparison result computed but could not be saved",
      inputCheckOutcome: "COMPATIBLE",
    });
  });

  it("swallows a double failure (failAttempt itself also throws) instead of rejecting", async () => {
    const { engine, comparisonService } = makeEngine();
    comparisonService.completeAttempt.mockRejectedValue(new Error("write conflict"));
    comparisonService.failAttempt.mockRejectedValue(new Error("db is down"));

    await expect(engine.processAttempt("att-1")).resolves.toBeUndefined();
  });
});
