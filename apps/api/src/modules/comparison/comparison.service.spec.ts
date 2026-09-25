import { Prisma } from "@prisma/client";
import { computeAuthContextKey } from "../snapshot/auth-context-fingerprint.util";
import {
  AutomaticComparisonInput,
  BaselineSelectionInput,
  ComparisonFindingInput,
  ComparisonService,
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
    apiId: "a-1",
    environmentId: "e-1",
    authType: "NONE",
    authContextVersion: 1,
    authIdentityLabel: null,
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
    const service = new ComparisonService(prisma as never);
    return { service, prisma, tx };
  }

  describe("selectBaselineSnapshot", () => {
    it("returns the most recent non-invalidated Snapshot in scope, keyed by the same authContextKey Snapshot uses", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue({ snapshotId: "snap-1" });

      const result = await service.selectBaselineSnapshot(baselineInput({ authType: "BEARER_TOKEN", authContextVersion: 2 }));

      expect(result).toEqual({ snapshotId: "snap-1" });
      const expectedKey = computeAuthContextKey("a-1", "e-1", "BEARER_TOKEN", 2, "");
      expect(prisma.snapshot.findFirst).toHaveBeenCalledWith({
        where: { projectId: "p-1", apiId: "a-1", environmentId: "e-1", authContextKey: expectedKey, invalidation: null },
        orderBy: [{ completedAt: "desc" }, { snapshotId: "desc" }],
        select: { snapshotId: true },
      });
    });

    it("returns null when no eligible baseline candidate exists", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue(null);

      await expect(service.selectBaselineSnapshot(baselineInput())).resolves.toBeNull();
    });

    it("uses the LOGIN_FORM username as the identity discriminator, not an empty string", async () => {
      const { service, prisma } = makeService();

      await service.selectBaselineSnapshot(baselineInput({ authType: "LOGIN_FORM", authIdentityLabel: "alice" }));

      const expectedKey = computeAuthContextKey("a-1", "e-1", "LOGIN_FORM", 1, "alice");
      expect(prisma.snapshot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ authContextKey: expectedKey }) }));
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
        data: { comparisonId: "cmp-1", attemptNumber: 1, processingStatus: "QUEUED", appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST },
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
        data: expect.objectContaining({ processingStatus: "BLOCKED", reasonCode: "SNAPSHOT_INVALIDATED" }),
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
        data: { comparisonId: "cmp-1", attemptNumber: 2, processingStatus: "QUEUED", appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST },
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
  });

  describe("recordClassification", () => {
    it("returns NOT_CLASSIFIABLE when the Comparison has no COMPLETED/DIFFERENT attempt", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue(null);

      await expect(service.recordClassification("cmp-1", classificationInput())).resolves.toEqual({
        ok: false,
        code: "NOT_CLASSIFIABLE",
        currentRevision: 0,
      });
      expect(tx.comparisonClassificationEvent.create).not.toHaveBeenCalled();
    });

    it("records the first classification (revision 1) when expectedRevision is null and no prior event exists", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-1" });
      tx.comparisonClassificationEvent.findFirst.mockResolvedValue(null);
      tx.comparisonClassificationEvent.create.mockResolvedValue({ revision: 1 });

      await expect(service.recordClassification("cmp-1", classificationInput({ expectedRevision: null }))).resolves.toEqual({ ok: true, revision: 1 });
      expect(tx.comparisonClassificationEvent.create).toHaveBeenCalledWith({
        data: { comparisonId: "cmp-1", revision: 1, classification: "UNEXPECTED", note: null, classifiedByUserId: "u-1" },
      });
    });

    it("returns REVISION_CONFLICT when expectedRevision does not match the current revision", async () => {
      const { service, tx } = makeService();
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-1" });
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
      tx.comparisonAttempt.findFirst.mockResolvedValue({ comparisonAttemptId: "att-1" });
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
