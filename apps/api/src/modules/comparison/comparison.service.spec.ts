import { Prisma } from "@prisma/client";
import {
  AutomaticComparisonInput,
  BaselineSelectionInput,
  ComparisonFindingInput,
  ComparisonService,
  CreateChainInput,
  ManualComparisonInput,
  RecordClassificationInput,
} from "./comparison.service";
import { DEFAULT_APPLIED_RULE_MANIFEST } from "./comparison.constants";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function baselineInput(overrides: Partial<BaselineSelectionInput> = {}): BaselineSelectionInput {
  return {
    projectId: "p-1",
    testCaseKey: "tck-1",
    ...overrides,
  };
}

function autoComparisonInput(overrides: Partial<AutomaticComparisonInput> = {}): AutomaticComparisonInput {
  return {
    runExecutionId: "re-1",
    projectId: "p-1",
    apiId: "a-1",
    environmentId: "e-1",
    baselineSnapshotId: "snap-baseline",
    targetSnapshotId: "snap-target",
    ...overrides,
  };
}

function manualComparisonInput(overrides: Partial<ManualComparisonInput> = {}): ManualComparisonInput {
  return {
    scope: { projectId: "p-1", apiId: "a-1", environmentId: "e-1" },
    baselineSnapshotId: "snap-baseline",
    targetSnapshotId: "snap-target",
    sourceKind: "MANUAL_PAIR",
    requestedByUserId: "u-1",
    note: null,
    ...overrides,
  };
}

function createChainInput(overrides: Partial<CreateChainInput> = {}): CreateChainInput {
  return {
    scope: { projectId: "p-1", apiId: "a-1", environmentId: "e-1" },
    requestedByUserId: "u-1",
    orderedSnapshotIds: ["snap-1", "snap-2", "snap-3"],
    note: null,
    ...overrides,
  };
}

function classificationInput(overrides: Partial<RecordClassificationInput> = {}): RecordClassificationInput {
  return {
    classification: "UNEXPECTED",
    note: null,
    classifiedByUserId: "u-1",
    expectedRevision: null,
    ...overrides,
  };
}

describe("ComparisonService", () => {
  function makeService() {
    const tx = {
      comparison: { create: jest.fn().mockResolvedValue({ comparisonId: "cmp-1" }) },
      comparisonChain: { create: jest.fn().mockResolvedValue({ comparisonChainId: "chain-1" }) },
      comparisonAttempt: {
        create: jest.fn().mockResolvedValue({ comparisonAttemptId: "att-1", attemptNumber: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      comparisonFinding: { create: jest.fn().mockResolvedValue({}) },
      comparisonClassificationEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ revision: 1 }),
      },
      snapshotInvalidation: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma: {
      $transaction: jest.Mock;
      snapshot: { findFirst: jest.Mock };
      comparisonClassificationEvent: { findFirst: jest.Mock };
    } = {
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
      snapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      comparisonClassificationEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ComparisonService(prisma as never, auditWriter as never);
    return { service, prisma, tx, auditWriter };
  }

  describe("selectBaselineSnapshot", () => {
    it("returns the most recent non-invalidated Snapshot for the same testCaseKey, with no authContextKey involved in the query", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue({ snapshotId: "snap-1" });

      const result = await service.selectBaselineSnapshot(baselineInput());

      expect(result).toEqual({ snapshotId: "snap-1" });
      expect(prisma.snapshot.findFirst).toHaveBeenCalledWith({
        where: { projectId: "p-1", testCaseKey: "tck-1", invalidation: null },
        orderBy: [{ completedAt: "desc" }, { snapshotId: "desc" }],
        select: { snapshotId: true },
      });
    });

    it("returns null (NO_BASELINE) on first occurrence of a testCaseKey — no eligible baseline candidate exists yet", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue(null);

      await expect(service.selectBaselineSnapshot(baselineInput())).resolves.toBeNull();
    });

    it("finds a predecessor across an authContextKey change — identity (testCaseKey) and auth-context safety stay fully independent", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue({ snapshotId: "snap-old-auth-version" });

      const result = await service.selectBaselineSnapshot(baselineInput({ testCaseKey: "tck-1" }));

      expect(result).toEqual({ snapshotId: "snap-old-auth-version" });
      const where = (prisma.snapshot.findFirst.mock.calls[0][0] as { where: Record<string, unknown> }).where;
      expect(where).not.toHaveProperty("authContextKey");
      expect(where).toEqual({ projectId: "p-1", testCaseKey: "tck-1", invalidation: null });
    });
  });

  describe("tryCreateAutomaticComparison", () => {
    it("creates a Comparison and a QUEUED first attempt when neither Snapshot is invalidated", async () => {
      const { service, tx } = makeService();

      await service.tryCreateAutomaticComparison(autoComparisonInput());

      expect(tx.comparison.create).toHaveBeenCalledWith({
        data: {
          projectId: "p-1",
          apiId: "a-1",
          environmentId: "e-1",
          baselineSnapshotId: "snap-baseline",
          targetSnapshotId: "snap-target",
          sourceKind: "AUTO_EXECUTION",
          sourceExecutionId: "re-1",
        },
      });
      expect(tx.comparisonAttempt.create).toHaveBeenCalledWith({
        data: { comparisonId: "cmp-1", attemptNumber: 1, processingStatus: "QUEUED", triggerKind: "INITIAL", appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST },
      });
    });

    it("tags the Comparison RERUN_EXECUTION instead of the AUTO_EXECUTION default when the advanced Re-run action requests it", async () => {
      const { service, tx } = makeService();

      await service.tryCreateAutomaticComparison(autoComparisonInput({ sourceKind: "RERUN_EXECUTION" }));

      expect(tx.comparison.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sourceKind: "RERUN_EXECUTION", sourceExecutionId: "re-1" }),
      });
    });

    it("creates a BLOCKED/SNAPSHOT_INVALIDATED attempt instead when the baseline Snapshot was invalidated", async () => {
      const { service, tx } = makeService();
      tx.snapshotInvalidation.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
        Promise.resolve(args.where.snapshotId === "snap-baseline" ? { invalidationId: "inv-1" } : null),
      );

      await service.tryCreateAutomaticComparison(autoComparisonInput());

      expect(tx.comparisonAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          comparisonId: "cmp-1",
          attemptNumber: 1,
          processingStatus: "BLOCKED",
          triggerKind: "INITIAL",
          stoppedAtGate: "ELIGIBILITY",
          reasonCode: "SNAPSHOT_INVALIDATED",
          appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST,
        }),
      });
    });

    it("creates a BLOCKED/SNAPSHOT_INVALIDATED attempt when the target Snapshot was invalidated", async () => {
      const { service, tx } = makeService();
      tx.snapshotInvalidation.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
        Promise.resolve(args.where.snapshotId === "snap-target" ? { invalidationId: "inv-2" } : null),
      );

      await service.tryCreateAutomaticComparison(autoComparisonInput());

      expect(tx.comparisonAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ processingStatus: "BLOCKED", triggerKind: "INITIAL", reasonCode: "SNAPSHOT_INVALIDATED" }),
      });
    });

    it("treats a unique-violation (uq_comparisons_source_execution_id) as a benign idempotent no-op on retry", async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValueOnce(p2002());

      await expect(service.tryCreateAutomaticComparison(autoComparisonInput())).resolves.toBeUndefined();
    });

    it("rethrows any non-P2002 transaction failure — isolation from RunExecution status is the caller's responsibility, not this method's", async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValueOnce(new Error("connection reset"));

      await expect(service.tryCreateAutomaticComparison(autoComparisonInput())).rejects.toThrow("connection reset");
    });
  });

  describe("createManualComparison", () => {
    it("creates a Comparison and a QUEUED first attempt, and audits COMPARISON_CREATED, for a MANUAL_PAIR request", async () => {
      const { service, tx, auditWriter } = makeService();

      const result = await service.createManualComparison(manualComparisonInput());

      expect(tx.comparison.create).toHaveBeenCalledWith({
        data: {
          projectId: "p-1",
          apiId: "a-1",
          environmentId: "e-1",
          baselineSnapshotId: "snap-baseline",
          targetSnapshotId: "snap-target",
          sourceKind: "MANUAL_PAIR",
          requestedByUserId: "u-1",
          comparisonChainId: null,
          pairOrdinal: null,
          note: null,
        },
      });
      expect(tx.comparisonAttempt.create).toHaveBeenCalledWith({
        data: { comparisonId: "cmp-1", attemptNumber: 1, processingStatus: "QUEUED", triggerKind: "INITIAL", appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST },
      });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "COMPARISON_CREATED",
          result: "SUCCESS",
          actorUserId: "u-1",
          targetType: "COMPARISON",
          targetId: "cmp-1",
          projectId: "p-1",
          afterData: { sourceKind: "MANUAL_PAIR", baselineSnapshotId: "snap-baseline", targetSnapshotId: "snap-target" },
        }),
        tx,
      );
      expect(result).toEqual({ comparisonId: "cmp-1", comparisonAttemptId: "att-1", queued: true });
    });

    it("creates a BLOCKED/SNAPSHOT_INVALIDATED attempt (queued: false) when the target Snapshot is invalidated, but still audits creation for a BASELINE_LATEST request", async () => {
      const { service, tx, auditWriter } = makeService();
      tx.snapshotInvalidation.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
        Promise.resolve(args.where.snapshotId === "snap-target" ? { invalidationId: "inv-1" } : null),
      );

      const result = await service.createManualComparison(manualComparisonInput({ sourceKind: "BASELINE_LATEST" }));

      expect(tx.comparisonAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          processingStatus: "BLOCKED",
          triggerKind: "INITIAL",
          stoppedAtGate: "ELIGIBILITY",
          reasonCode: "SNAPSHOT_INVALIDATED",
        }),
      });
      expect(result.queued).toBe(false);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "COMPARISON_CREATED" }), tx);
    });
  });

  describe("createComparisonChain", () => {
    it("creates one ComparisonChain and one Comparison+QUEUED attempt per adjacent pair, then audits COMPARISON_CHAIN_CREATED exactly once", async () => {
      const { service, tx, auditWriter } = makeService();

      const result = await service.createComparisonChain(createChainInput({ orderedSnapshotIds: ["s-1", "s-2", "s-3"] }));

      expect(tx.comparisonChain.create).toHaveBeenCalledWith({
        data: { projectId: "p-1", apiId: "a-1", environmentId: "e-1", requestedByUserId: "u-1", note: null },
      });
      expect(tx.comparison.create).toHaveBeenCalledTimes(2);
      expect(tx.comparison.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          baselineSnapshotId: "s-1",
          targetSnapshotId: "s-2",
          sourceKind: "CHAIN_PAIR",
          comparisonChainId: "chain-1",
          pairOrdinal: 1,
        }),
      });
      expect(tx.comparison.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          baselineSnapshotId: "s-2",
          targetSnapshotId: "s-3",
          sourceKind: "CHAIN_PAIR",
          comparisonChainId: "chain-1",
          pairOrdinal: 2,
        }),
      });
      expect(auditWriter.record).toHaveBeenCalledTimes(1);
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "COMPARISON_CHAIN_CREATED",
          targetType: "COMPARISON_CHAIN",
          targetId: "chain-1",
          projectId: "p-1",
          afterData: { selectedSnapshotCount: 3, pairCount: 2 },
        }),
        tx,
      );
      expect(result).toEqual({
        comparisonChainId: "chain-1",
        selectedSnapshotCount: 3,
        pairCount: 2,
        attemptsToQueue: ["att-1", "att-1"],
      });
    });

    it("keeps an invalidated mid-chain Snapshot in position — both pairs touching it come back BLOCKED, never skipped", async () => {
      const { service, tx } = makeService();
      tx.snapshotInvalidation.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
        Promise.resolve(args.where.snapshotId === "s-2" ? { invalidationId: "inv-1" } : null),
      );

      const result = await service.createComparisonChain(createChainInput({ orderedSnapshotIds: ["s-1", "s-2", "s-3"] }));

      expect(tx.comparisonAttempt.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ processingStatus: "BLOCKED", triggerKind: "INITIAL", reasonCode: "SNAPSHOT_INVALIDATED" }),
      });
      expect(tx.comparisonAttempt.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ processingStatus: "BLOCKED", triggerKind: "INITIAL", reasonCode: "SNAPSHOT_INVALIDATED" }),
      });
      expect(result.attemptsToQueue).toEqual([]);
    });

    it("only queues the attempts for pairs that are not blocked, leaving the rest of a longer chain independent", async () => {
      const { service, tx } = makeService();
      let call = 0;
      tx.comparisonAttempt.create.mockImplementation(() => Promise.resolve({ comparisonAttemptId: `att-${++call}`, attemptNumber: 1 }));
      tx.snapshotInvalidation.findUnique.mockImplementation((args: { where: { snapshotId: string } }) =>
        Promise.resolve(args.where.snapshotId === "s-3" ? { invalidationId: "inv-1" } : null),
      );

      const result = await service.createComparisonChain(createChainInput({ orderedSnapshotIds: ["s-1", "s-2", "s-3", "s-4"] }));

      expect(result.selectedSnapshotCount).toBe(4);
      expect(result.pairCount).toBe(3);
      expect(result.attemptsToQueue).toEqual(["att-1"]);
    });
  });

  describe("retryComparisonAttempt", () => {
    it("returns COMPARISON_NOT_FOUND when the Comparison has no attempts at all", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue(null);

      await expect(service.retryComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "COMPARISON_NOT_FOUND" });
    });

    it("returns ALREADY_COMPLETED when the latest attempt is COMPLETED", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus: "COMPLETED", reasonCode: null });

      await expect(service.retryComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "ALREADY_COMPLETED" });
    });

    it.each(["QUEUED", "RUNNING"])("returns ATTEMPT_NOT_TERMINAL when the latest attempt is %s", async (processingStatus) => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus, reasonCode: null });

      await expect(service.retryComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "ATTEMPT_NOT_TERMINAL" });
    });

    it("returns REASON_NOT_RETRYABLE for a never-retryable reason code (CONTEXT_MISMATCH)", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus: "BLOCKED", reasonCode: "CONTEXT_MISMATCH" });

      await expect(service.retryComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "REASON_NOT_RETRYABLE" });
      expect(tx.comparisonAttempt.create).not.toHaveBeenCalled();
    });

    it("creates attempt #2 for an always-retryable reason code (ENGINE_ERROR) once the prior attempt is terminal", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus: "FAILED", reasonCode: "ENGINE_ERROR" });
      tx.comparisonAttempt.create.mockResolvedValue({ comparisonAttemptId: "att-2", attemptNumber: 2 });

      await expect(service.retryComparisonAttempt("cmp-1")).resolves.toEqual({ ok: true, comparisonAttemptId: "att-2", attemptNumber: 2 });
      expect(tx.comparisonAttempt.create).toHaveBeenCalledWith({
        data: { comparisonId: "cmp-1", attemptNumber: 2, processingStatus: "QUEUED", triggerKind: "RETRY", appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST },
      });
    });

    it("returns REASON_NOT_RETRYABLE for a conditionally-retryable reason code (SNAPSHOT_INCOMPLETE) when payloadNowReadable is not asserted", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus: "BLOCKED", reasonCode: "SNAPSHOT_INCOMPLETE" });

      await expect(service.retryComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "REASON_NOT_RETRYABLE" });
    });

    it("allows retry for a conditionally-retryable reason code once the caller explicitly asserts payloadNowReadable", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus: "BLOCKED", reasonCode: "SNAPSHOT_INCOMPLETE" });
      tx.comparisonAttempt.create.mockResolvedValue({ comparisonAttemptId: "att-2", attemptNumber: 2 });

      await expect(service.retryComparisonAttempt("cmp-1", { payloadNowReadable: true })).resolves.toEqual({
        ok: true,
        comparisonAttemptId: "att-2",
        attemptNumber: 2,
      });
    });

    it("returns CONCURRENT_RETRY when two retries race on the same prior attempt (uq_comparison_attempts_comparison_id_attempt_number)", async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValueOnce(p2002());

      await expect(service.retryComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "CONCURRENT_RETRY" });
    });
  });

  describe("reevaluateComparisonAttempt", () => {
    it("returns COMPARISON_NOT_FOUND when the Comparison has no attempts at all", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue(null);

      await expect(service.reevaluateComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "COMPARISON_NOT_FOUND" });
      expect(tx.comparisonAttempt.create).not.toHaveBeenCalled();
    });

    it.each(["QUEUED", "RUNNING", "BLOCKED", "FAILED"])("returns LATEST_ATTEMPT_NOT_COMPLETED when the latest attempt is %s", async (processingStatus) => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus });

      await expect(service.reevaluateComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "LATEST_ATTEMPT_NOT_COMPLETED" });
      expect(tx.comparisonAttempt.create).not.toHaveBeenCalled();
    });

    it("creates attempt #2 tagged REEVALUATION once the latest attempt is COMPLETED, leaving the original untouched", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ attemptNumber: 1, processingStatus: "COMPLETED" });
      tx.comparisonAttempt.create.mockResolvedValue({ comparisonAttemptId: "att-2", attemptNumber: 2 });

      await expect(service.reevaluateComparisonAttempt("cmp-1")).resolves.toEqual({ ok: true, comparisonAttemptId: "att-2", attemptNumber: 2 });
      expect(tx.comparisonAttempt.create).toHaveBeenCalledWith({
        data: { comparisonId: "cmp-1", attemptNumber: 2, processingStatus: "QUEUED", triggerKind: "REEVALUATION", appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST },
      });
      expect(tx.comparisonAttempt.update).not.toHaveBeenCalled();
    });

    it("returns CONCURRENT_REEVALUATION when two re-evaluations race on the same prior attempt (uq_comparison_attempts_comparison_id_attempt_number)", async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValueOnce(p2002());

      await expect(service.reevaluateComparisonAttempt("cmp-1")).resolves.toEqual({ ok: false, code: "CONCURRENT_REEVALUATION" });
    });
  });

  describe("completeAttempt", () => {
    it("returns ATTEMPT_NOT_FOUND when the attempt does not exist", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue(null);

      await expect(service.completeAttempt("att-1", "SAME", [])).resolves.toEqual({ ok: false, code: "ATTEMPT_NOT_FOUND" });
    });

    it.each(["COMPLETED", "BLOCKED", "FAILED"])("returns ATTEMPT_NOT_ACTIVE when the attempt is already terminal (%s)", async (processingStatus) => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus });

      await expect(service.completeAttempt("att-1", "SAME", [])).resolves.toEqual({ ok: false, code: "ATTEMPT_NOT_ACTIVE" });
      expect(tx.comparisonAttempt.update).not.toHaveBeenCalled();
    });

    it("completes a QUEUED attempt with SAME and no findings", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "QUEUED" });

      await expect(service.completeAttempt("att-1", "SAME", [])).resolves.toEqual({ ok: true });

      expect(tx.comparisonAttempt.update).toHaveBeenCalledWith({
        where: { comparisonAttemptId: "att-1" },
        data: { processingStatus: "COMPLETED", comparisonResult: "SAME", inputCheckOutcome: "COMPATIBLE", endedAt: expect.any(Date) },
      });
      expect(tx.comparisonFinding.create).not.toHaveBeenCalled();
    });

    it("completes a RUNNING attempt with DIFFERENT and persists findings with per-phase ordinals starting at 0", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "RUNNING" });
      const findings: ComparisonFindingInput[] = [
        { phase: "INPUT", component: "REQUEST_HEADER", differenceKind: "VALUE", ruleCode: "R1" },
        { phase: "INPUT", component: "REQUEST_BODY", differenceKind: "TYPE", ruleCode: "R2" },
        { phase: "OUTPUT", component: "RESPONSE_BODY", differenceKind: "VALUE", ruleCode: "R3" },
      ];

      await service.completeAttempt("att-1", "DIFFERENT", findings);

      expect(tx.comparisonFinding.create).toHaveBeenCalledTimes(3);
      expect(tx.comparisonFinding.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ phase: "INPUT", findingOrdinal: 0, ruleCode: "R1" }) });
      expect(tx.comparisonFinding.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ phase: "INPUT", findingOrdinal: 1, ruleCode: "R2" }) });
      expect(tx.comparisonFinding.create).toHaveBeenNthCalledWith(3, { data: expect.objectContaining({ phase: "OUTPUT", findingOrdinal: 0, ruleCode: "R3" }) });
    });

    it("omits the appliedRuleManifest override when appliedIgnoreRules is omitted (defaults to [])", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "QUEUED" });

      await service.completeAttempt("att-1", "SAME", []);

      expect(tx.comparisonAttempt.update).toHaveBeenCalledWith({
        where: { comparisonAttemptId: "att-1" },
        data: { processingStatus: "COMPLETED", comparisonResult: "SAME", inputCheckOutcome: "COMPATIBLE", endedAt: expect.any(Date) },
      });
    });

    it("omits the appliedRuleManifest override when appliedIgnoreRules is explicitly empty", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "QUEUED" });

      await service.completeAttempt("att-1", "SAME", [], []);

      expect(tx.comparisonAttempt.update).toHaveBeenCalledWith({
        where: { comparisonAttemptId: "att-1" },
        data: { processingStatus: "COMPLETED", comparisonResult: "SAME", inputCheckOutcome: "COMPATIBLE", endedAt: expect.any(Date) },
      });
    });

    it("merges applied Ignore Rules into appliedRuleManifest when at least one rule suppressed a finding", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "QUEUED" });
      const appliedIgnoreRules = [{ ignoreRuleId: "rule-1", scope: "API", path: "$.StartTime", suppressedFindingCount: 1 }];

      await service.completeAttempt("att-1", "SAME", [], appliedIgnoreRules);

      expect(tx.comparisonAttempt.update).toHaveBeenCalledWith({
        where: { comparisonAttemptId: "att-1" },
        data: {
          processingStatus: "COMPLETED",
          comparisonResult: "SAME",
          inputCheckOutcome: "COMPATIBLE",
          endedAt: expect.any(Date),
          appliedRuleManifest: { ...DEFAULT_APPLIED_RULE_MANIFEST, ignoreRules: appliedIgnoreRules },
        },
      });
    });

    it("only updates the one attempt being completed, never rewriting another attempt's stored manifest (historical immutability)", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-2", processingStatus: "QUEUED" });

      await service.completeAttempt("att-2", "SAME", [], [{ ignoreRuleId: "rule-1", scope: "API", path: "$.StartTime", suppressedFindingCount: 1 }]);

      expect(tx.comparisonAttempt.update).toHaveBeenCalledTimes(1);
      expect(tx.comparisonAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ where: { comparisonAttemptId: "att-2" } }));
      expect(tx.comparisonAttempt.findUnique).toHaveBeenCalledWith({ where: { comparisonAttemptId: "att-2" } });
    });
  });

  describe("blockAttempt", () => {
    it("does not create finding rows when none are provided", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "QUEUED" });

      await expect(service.blockAttempt("att-1", { stoppedAtGate: "ELIGIBILITY", reasonCode: "ENVIRONMENT_MISMATCH" })).resolves.toEqual({ ok: true });

      expect(tx.comparisonFinding.create).not.toHaveBeenCalled();
    });

    it("persists INPUT-phase finding rows when provided, with ordinals starting at 0", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "QUEUED" });
      const findings: ComparisonFindingInput[] = [
        { phase: "INPUT", component: "METHOD", differenceKind: "VALUE", ruleCode: "METHOD_MISMATCH", safeSummary: "Method differs (A=GET, B=POST)" },
        { phase: "INPUT", component: "REQUEST_HEADER", differenceKind: "VALUE", ruleCode: "HEADER_VALUE", locationPath: "accept" },
      ];

      await service.blockAttempt("att-1", {
        stoppedAtGate: "INPUT",
        reasonCode: "INPUT_MISMATCH",
        reasonDetailSafe: "Method differs (A=GET, B=POST)",
        inputCheckOutcome: "MISMATCH",
        findings,
      });

      expect(tx.comparisonFinding.create).toHaveBeenCalledTimes(2);
      expect(tx.comparisonFinding.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ comparisonAttemptId: "att-1", phase: "INPUT", findingOrdinal: 0, ruleCode: "METHOD_MISMATCH" }) });
      expect(tx.comparisonFinding.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ phase: "INPUT", findingOrdinal: 1, ruleCode: "HEADER_VALUE", locationPath: "accept" }) });
    });

    it("never persists finding rows when the attempt is not active — the terminal guard is checked first", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findUnique.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "BLOCKED" });
      const findings: ComparisonFindingInput[] = [{ phase: "INPUT", component: "METHOD", differenceKind: "VALUE", ruleCode: "METHOD_MISMATCH" }];

      await expect(service.blockAttempt("att-1", { stoppedAtGate: "INPUT", reasonCode: "INPUT_MISMATCH", findings })).resolves.toEqual({ ok: false, code: "ATTEMPT_NOT_ACTIVE" });

      expect(tx.comparisonFinding.create).not.toHaveBeenCalled();
    });
  });

  describe("recordClassification", () => {
    it("returns NOT_CLASSIFIABLE when the Comparison has no attempts at all", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue(null);

      await expect(service.recordClassification("cmp-1", classificationInput())).resolves.toEqual({
        ok: false,
        code: "NOT_CLASSIFIABLE",
        currentRevision: 0,
      });
      expect(tx.comparisonClassificationEvent.create).not.toHaveBeenCalled();
    });

    it.each(["QUEUED", "RUNNING", "BLOCKED", "FAILED"])("returns NOT_CLASSIFIABLE when the latest attempt is %s (not COMPLETED)", async (processingStatus) => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus, comparisonResult: null });

      await expect(service.recordClassification("cmp-1", classificationInput())).resolves.toEqual({
        ok: false,
        code: "NOT_CLASSIFIABLE",
        currentRevision: 0,
      });
      expect(tx.comparisonClassificationEvent.create).not.toHaveBeenCalled();
    });

    it("returns NOT_CLASSIFIABLE when the latest attempt is COMPLETED but SAME, even though an earlier attempt was DIFFERENT — a stale original DIFFERENT result no longer makes the Comparison classifiable once a later COMPLETED/SAME re-evaluation attempt is latest", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-2", processingStatus: "COMPLETED", comparisonResult: "SAME" });

      await expect(service.recordClassification("cmp-1", classificationInput())).resolves.toEqual({
        ok: false,
        code: "NOT_CLASSIFIABLE",
        currentRevision: 0,
      });
      expect(tx.comparisonClassificationEvent.create).not.toHaveBeenCalled();
    });

    it("records the first classification (revision 1) when expectedRevision is null and no prior event exists", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "COMPLETED", comparisonResult: "DIFFERENT" });
      tx.comparisonClassificationEvent.findFirst.mockResolvedValue(null);
      tx.comparisonClassificationEvent.create.mockResolvedValue({ revision: 1 });

      await expect(service.recordClassification("cmp-1", classificationInput({ expectedRevision: null }))).resolves.toEqual({ ok: true, revision: 1 });
      expect(tx.comparisonClassificationEvent.create).toHaveBeenCalledWith({
        data: { comparisonId: "cmp-1", revision: 1, classification: "UNEXPECTED", note: null, classifiedByUserId: "u-1" },
      });
    });

    it("returns REVISION_CONFLICT when expectedRevision does not match the current revision", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "COMPLETED", comparisonResult: "DIFFERENT" });
      tx.comparisonClassificationEvent.findFirst.mockResolvedValue({ revision: 2 });

      await expect(service.recordClassification("cmp-1", classificationInput({ expectedRevision: 1 }))).resolves.toEqual({
        ok: false,
        code: "REVISION_CONFLICT",
        currentRevision: 2,
      });
      expect(tx.comparisonClassificationEvent.create).not.toHaveBeenCalled();
    });

    it("records revision N+1 when expectedRevision matches the current revision", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-1", processingStatus: "COMPLETED", comparisonResult: "DIFFERENT" });
      tx.comparisonClassificationEvent.findFirst.mockResolvedValue({ revision: 2 });
      tx.comparisonClassificationEvent.create.mockResolvedValue({ revision: 3 });

      await expect(service.recordClassification("cmp-1", classificationInput({ expectedRevision: 2 }))).resolves.toEqual({ ok: true, revision: 3 });
    });

    it("resolves a concurrent-classification race (uq_comparison_classification_events_comparison_id_revision) via a fresh top-level revision read", async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValueOnce(p2002());
      prisma.comparisonClassificationEvent.findFirst.mockResolvedValue({ revision: 5 });

      await expect(service.recordClassification("cmp-1", classificationInput({ expectedRevision: 4 }))).resolves.toEqual({
        ok: false,
        code: "REVISION_CONFLICT",
        currentRevision: 5,
      });
    });

    it("treats a concurrent-classification race with no prior event found as currentRevision 0", async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValueOnce(p2002());
      prisma.comparisonClassificationEvent.findFirst.mockResolvedValue(null);

      await expect(service.recordClassification("cmp-1", classificationInput())).resolves.toEqual({
        ok: false,
        code: "REVISION_CONFLICT",
        currentRevision: 0,
      });
    });
  });
});
