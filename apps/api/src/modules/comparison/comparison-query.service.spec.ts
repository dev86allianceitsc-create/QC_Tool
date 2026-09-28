import { BusinessException } from "../../common/exceptions/business.exception";
import { ComparisonQueryService, CreateComparisonResult } from "./comparison-query.service";
import { CreateComparisonDto } from "./dto/create-comparison.dto";
import { CreateComparisonChainDto } from "./dto/create-comparison-chain.dto";
import { CreateClassificationEventDto } from "./dto/create-classification-event.dto";
import { ListComparisonsQueryDto } from "./dto/list-comparisons-query.dto";
import { ListComparisonFindingsQueryDto } from "./dto/list-comparison-findings-query.dto";

async function captureError(promise: Promise<unknown>): Promise<BusinessException> {
  try {
    await promise;
  } catch (err) {
    return err as BusinessException;
  }
  throw new Error("expected promise to reject");
}

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    projectId: "p-1",
    apiId: "a-1",
    environmentId: "e-1",
    completedAt: new Date("2026-01-01T00:00:00Z"),
    durationMs: 120,
    apiVersion: "1.0.0",
    databaseVersion: "1.0.0",
    invalidation: null,
    ...overrides,
  };
}

function comparisonRow(overrides: Record<string, unknown> = {}) {
  return {
    comparisonId: "cmp-1",
    projectId: "p-1",
    apiId: "a-1",
    environmentId: "e-1",
    baselineSnapshotId: "snap-a",
    targetSnapshotId: "snap-b",
    sourceKind: "MANUAL_PAIR",
    sourceExecutionId: null,
    comparisonChainId: null,
    pairOrdinal: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    baselineSnapshot: snapshotRow(),
    targetSnapshot: snapshotRow({ durationMs: 150 }),
    attempts: [
      {
        comparisonAttemptId: "att-1",
        attemptNumber: 1,
        processingStatus: "COMPLETED",
        stoppedAtGate: null,
        reasonCode: null,
        reasonDetailSafe: null,
        inputCheckOutcome: "COMPATIBLE",
        comparisonResult: "SAME",
        appliedRuleManifest: { ruleManifestVersion: 1, exclusions: [], representationBoundary: "DEFAULT" },
        endedAt: new Date("2026-01-01T00:05:00Z"),
        _count: { findings: 0 },
      },
    ],
    classificationEvents: [],
    ...overrides,
  };
}

describe("ComparisonQueryService", () => {
  function makeService() {
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE" }) },
      user: { findUnique: jest.fn().mockResolvedValue({ systemRole: "ADMIN" }) },
      projectMembership: { findUnique: jest.fn().mockResolvedValue(null) },
      snapshot: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      snapshotInvalidation: { findUnique: jest.fn().mockResolvedValue(null) },
      comparison: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
      comparisonAttempt: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      comparisonFinding: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      comparisonChain: { findUnique: jest.fn() },
      comparisonClassificationEvent: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const comparisonService = {
      createManualComparison: jest.fn(),
      createComparisonChain: jest.fn(),
      retryComparisonAttempt: jest.fn(),
      recordClassification: jest.fn(),
    };
    const comparisonEngineService = { processAttempt: jest.fn().mockResolvedValue(undefined) };
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ComparisonQueryService(prisma as never, comparisonService as never, comparisonEngineService as never, auditWriter as never);
    return { service, prisma, comparisonService, comparisonEngineService, auditWriter };
  }

  function pairDto(overrides: Partial<CreateComparisonDto> = {}): CreateComparisonDto {
    return { selectionMode: "PAIR", baselineSnapshotId: "snap-a", targetSnapshotId: "snap-b", ...overrides } as CreateComparisonDto;
  }

  function baselineLatestDto(overrides: Partial<CreateComparisonDto> = {}): CreateComparisonDto {
    return { selectionMode: "BASELINE_LATEST", apiId: "a-1", environmentId: "e-1", authContextRef: "ctx-1", ...overrides } as CreateComparisonDto;
  }

  describe("createComparison — selectionMode exclusivity", () => {
    it("rejects PAIR with BASELINE_LATEST-only fields", async () => {
      const { service } = makeService();
      const error = await captureError(service.createComparison("p-1", pairDto({ apiId: "a-1" } as never), "u-1"));
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });

    it("rejects BASELINE_LATEST with PAIR-only fields", async () => {
      const { service } = makeService();
      const error = await captureError(service.createComparison("p-1", baselineLatestDto({ baselineSnapshotId: "snap-a" } as never), "u-1"));
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });
  });

  describe("createComparison — PAIR", () => {
    it("collapses a missing Snapshot into 404 NOT_FOUND", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ snapshotId: "snap-b", projectId: "p-1", apiId: "a-1", environmentId: "e-1" });

      const error = await captureError(service.createComparison("p-1", pairDto(), "u-1"));
      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ errorCode: "NOT_FOUND" });
    });

    it("collapses cross-project access denial into the same 404 as missing, and audits it", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.snapshot.findUnique
        .mockResolvedValueOnce({ snapshotId: "snap-a", projectId: "p-1", apiId: "a-1", environmentId: "e-1" })
        .mockResolvedValueOnce({ snapshotId: "snap-b", projectId: "p-2", apiId: "a-1", environmentId: "e-1" });
      prisma.user.findUnique.mockResolvedValue(null);

      const error = await captureError(service.createComparison("p-1", pairDto(), "u-1"));
      expect(error.getStatus()).toBe(404);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "COMPARISON_ACCESS_DENIED", result: "DENIED" }));
    });

    it("rejects identical baseline/target ids with 422", async () => {
      const { service, prisma } = makeService();
      const snap = { snapshotId: "snap-a", projectId: "p-1", apiId: "a-1", environmentId: "e-1" };
      prisma.snapshot.findUnique.mockResolvedValue(snap);

      const error = await captureError(service.createComparison("p-1", pairDto({ baselineSnapshotId: "snap-a", targetSnapshotId: "snap-a" }), "u-1"));
      expect(error.getStatus()).toBe(422);
    });

    it("rejects a baseline Snapshot that does not belong to the path Project with 422", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findUnique
        .mockResolvedValueOnce({ snapshotId: "snap-a", projectId: "p-2", apiId: "a-1", environmentId: "e-1" })
        .mockResolvedValueOnce({ snapshotId: "snap-b", projectId: "p-2", apiId: "a-1", environmentId: "e-1" });

      const error = await captureError(service.createComparison("p-1", pairDto(), "u-1"));
      expect(error.getStatus()).toBe(422);
    });

    it("creates the Comparison and dispatches the engine when queued", async () => {
      const { service, prisma, comparisonService, comparisonEngineService } = makeService();
      prisma.snapshot.findUnique
        .mockResolvedValueOnce({ snapshotId: "snap-a", projectId: "p-1", apiId: "a-1", environmentId: "e-1" })
        .mockResolvedValueOnce({ snapshotId: "snap-b", projectId: "p-1", apiId: "a-1", environmentId: "e-1" });
      comparisonService.createManualComparison.mockResolvedValue({ comparisonId: "cmp-1", comparisonAttemptId: "att-1", queued: true });

      const result = await service.createComparison("p-1", pairDto(), "u-1");

      expect(result).toEqual({ comparisonId: "cmp-1", comparisonAttemptId: "att-1", processingStatus: "QUEUED" });
      await Promise.resolve();
      expect(comparisonEngineService.processAttempt).toHaveBeenCalledWith("att-1");
    });

    it("does not dispatch the engine when the pair is created BLOCKED", async () => {
      const { service, prisma, comparisonService, comparisonEngineService } = makeService();
      prisma.snapshot.findUnique
        .mockResolvedValueOnce({ snapshotId: "snap-a", projectId: "p-1", apiId: "a-1", environmentId: "e-1" })
        .mockResolvedValueOnce({ snapshotId: "snap-b", projectId: "p-1", apiId: "a-1", environmentId: "e-1" });
      comparisonService.createManualComparison.mockResolvedValue({ comparisonId: "cmp-1", comparisonAttemptId: "att-1", queued: false });

      const result = (await service.createComparison("p-1", pairDto(), "u-1")) as CreateComparisonResult;

      expect(result.processingStatus).toBe("BLOCKED");
      expect(comparisonEngineService.processAttempt).not.toHaveBeenCalled();
    });
  });

  describe("createComparison — BASELINE_LATEST", () => {
    it("returns NO_LATEST_SNAPSHOT when no candidate Snapshot exists", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue(null);

      const result = await service.createComparison("p-1", baselineLatestDto(), "u-1");

      expect(result).toEqual({ comparisonId: null, availabilityReasonCode: "NO_LATEST_SNAPSHOT", latestSnapshotId: null });
    });

    it("returns NO_BASELINE when the candidate's Execution has no baseline", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue({ snapshotId: "snap-latest", runExecution: { baselineSnapshotId: null } });

      const result = await service.createComparison("p-1", baselineLatestDto(), "u-1");

      expect(result).toEqual({ comparisonId: null, availabilityReasonCode: "NO_BASELINE", latestSnapshotId: "snap-latest" });
    });

    it("returns BASELINE_INVALIDATED when the resolved baseline was since invalidated", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue({ snapshotId: "snap-latest", runExecution: { baselineSnapshotId: "snap-baseline" } });
      prisma.snapshotInvalidation.findUnique.mockResolvedValue({ invalidationId: "inv-1" });

      const result = await service.createComparison("p-1", baselineLatestDto(), "u-1");

      expect(result).toEqual({ comparisonId: null, availabilityReasonCode: "BASELINE_INVALIDATED", latestSnapshotId: "snap-latest" });
    });

    it("creates a Comparison and dispatches when a baseline is available and current", async () => {
      const { service, prisma, comparisonService, comparisonEngineService } = makeService();
      prisma.snapshot.findFirst.mockResolvedValue({ snapshotId: "snap-latest", runExecution: { baselineSnapshotId: "snap-baseline" } });
      comparisonService.createManualComparison.mockResolvedValue({ comparisonId: "cmp-2", comparisonAttemptId: "att-2", queued: true });

      const result = await service.createComparison("p-1", baselineLatestDto(), "u-1");

      expect(result).toEqual({ comparisonId: "cmp-2", comparisonAttemptId: "att-2", processingStatus: "QUEUED" });
      expect(comparisonService.createManualComparison).toHaveBeenCalledWith(
        expect.objectContaining({ baselineSnapshotId: "snap-baseline", targetSnapshotId: "snap-latest", sourceKind: "BASELINE_LATEST" }),
      );
      await Promise.resolve();
      expect(comparisonEngineService.processAttempt).toHaveBeenCalledWith("att-2");
    });
  });

  describe("createComparisonChain", () => {
    function chainDto(overrides: Partial<CreateComparisonChainDto> = {}): CreateComparisonChainDto {
      return { startSnapshotId: "snap-start", endSnapshotId: "snap-end", ...overrides } as CreateComparisonChainDto;
    }

    it("collapses a missing endpoint into 404", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ snapshotId: "snap-end", projectId: "p-1" });

      const error = await captureError(service.createComparisonChain("p-1", chainDto(), "u-1"));
      expect(error.getStatus()).toBe(404);
    });

    it("rejects identical endpoints with 422", async () => {
      const { service, prisma } = makeService();
      const snap = { snapshotId: "snap-start", projectId: "p-1", apiId: "a-1", environmentId: "e-1", authContextKey: "ctx-1", completedAt: new Date() };
      prisma.snapshot.findUnique.mockResolvedValue(snap);

      const error = await captureError(service.createComparisonChain("p-1", chainDto({ startSnapshotId: "snap-start", endSnapshotId: "snap-start" }), "u-1"));
      expect(error.getStatus()).toBe(422);
    });

    it("rejects endpoints spanning different scopes with 422", async () => {
      const { service, prisma } = makeService();
      prisma.snapshot.findUnique
        .mockResolvedValueOnce({ snapshotId: "snap-start", projectId: "p-1", apiId: "a-1", environmentId: "e-1", authContextKey: "ctx-1", completedAt: new Date("2026-01-01") })
        .mockResolvedValueOnce({ snapshotId: "snap-end", projectId: "p-1", apiId: "a-2", environmentId: "e-1", authContextKey: "ctx-1", completedAt: new Date("2026-01-02") });

      const error = await captureError(service.createComparisonChain("p-1", chainDto(), "u-1"));
      expect(error.getStatus()).toBe(422);
    });

    it("rejects when fewer than 2 Snapshots resolve in range with 422", async () => {
      const { service, prisma } = makeService();
      const start = { snapshotId: "snap-start", projectId: "p-1", apiId: "a-1", environmentId: "e-1", authContextKey: "ctx-1", completedAt: new Date("2026-01-01") };
      const end = { snapshotId: "snap-end", projectId: "p-1", apiId: "a-1", environmentId: "e-1", authContextKey: "ctx-1", completedAt: new Date("2026-01-02") };
      prisma.snapshot.findUnique.mockResolvedValueOnce(start).mockResolvedValueOnce(end);
      prisma.snapshot.findMany.mockResolvedValue([{ snapshotId: "snap-start" }]);

      const error = await captureError(service.createComparisonChain("p-1", chainDto(), "u-1"));
      expect(error.getStatus()).toBe(422);
    });

    it("creates the chain and dispatches every queued attempt", async () => {
      const { service, prisma, comparisonService, comparisonEngineService } = makeService();
      const start = { snapshotId: "snap-start", projectId: "p-1", apiId: "a-1", environmentId: "e-1", authContextKey: "ctx-1", completedAt: new Date("2026-01-01") };
      const end = { snapshotId: "snap-end", projectId: "p-1", apiId: "a-1", environmentId: "e-1", authContextKey: "ctx-1", completedAt: new Date("2026-01-03") };
      prisma.snapshot.findUnique.mockResolvedValueOnce(start).mockResolvedValueOnce(end);
      prisma.snapshot.findMany.mockResolvedValue([{ snapshotId: "snap-start" }, { snapshotId: "snap-mid" }, { snapshotId: "snap-end" }]);
      comparisonService.createComparisonChain.mockResolvedValue({
        comparisonChainId: "chain-1",
        selectedSnapshotCount: 3,
        pairCount: 2,
        attemptsToQueue: ["att-1", "att-2"],
      });

      const result = await service.createComparisonChain("p-1", chainDto(), "u-1");

      expect(result).toEqual({ comparisonChainId: "chain-1", selectedSnapshotCount: 3, pairCount: 2 });
      await Promise.resolve();
      expect(comparisonEngineService.processAttempt).toHaveBeenCalledWith("att-1");
      expect(comparisonEngineService.processAttempt).toHaveBeenCalledWith("att-2");
    });
  });

  describe("listComparisons", () => {
    it("throws 404 when the Project does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      const error = await captureError(service.listComparisons("p-1", {} as ListComparisonsQueryDto));
      expect(error.getStatus()).toBe(404);
    });

    it("combines snapshotId/executionId/result/processingStatus filters as independent AND clauses", async () => {
      const { service, prisma } = makeService();
      const query: ListComparisonsQueryDto = { snapshotId: "snap-x", executionId: "exec-x", result: "SAME", processingStatus: "COMPLETED" } as ListComparisonsQueryDto;

      await service.listComparisons("p-1", query);

      expect(prisma.comparison.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: "p-1",
            AND: [
              { OR: [{ baselineSnapshotId: "snap-x" }, { targetSnapshotId: "snap-x" }] },
              { OR: [{ sourceExecutionId: "exec-x" }, { baselineSnapshot: { runExecutionId: "exec-x" } }, { targetSnapshot: { runExecutionId: "exec-x" } }] },
              { attempts: { some: { comparisonResult: "SAME" } } },
              { attempts: { some: { processingStatus: "COMPLETED" } } },
            ],
          }),
        }),
      );
    });

    it("computes hasMore from page/pageSize/totalItems", async () => {
      const { service, prisma } = makeService();
      prisma.comparison.findMany.mockResolvedValue([comparisonRow()]);
      prisma.comparison.count.mockResolvedValue(25);

      const result = await service.listComparisons("p-1", { page: 1, pageSize: 20 } as ListComparisonsQueryDto);

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("getComparison", () => {
    it("throws 404 when missing", async () => {
      const { service, prisma } = makeService();
      prisma.comparison.findUnique.mockResolvedValue(null);

      const error = await captureError(service.getComparison("cmp-x"));
      expect(error.getStatus()).toBe(404);
    });

    it("suppresses appliedRuleSummary while the latest attempt is not terminal", async () => {
      const { service, prisma } = makeService();
      prisma.comparison.findUnique.mockResolvedValue(comparisonRow({ attempts: [{ ...comparisonRow().attempts[0], processingStatus: "RUNNING" }] }));

      const result = await service.getComparison("cmp-1");

      expect(result.appliedRuleSummary).toBeNull();
    });

    it("exposes appliedRuleSummary (version/boundary/exclusionCount only) once terminal", async () => {
      const { service, prisma } = makeService();
      prisma.comparison.findUnique.mockResolvedValue(comparisonRow());

      const result = await service.getComparison("cmp-1");

      expect(result.appliedRuleSummary).toEqual({ ruleManifestVersion: "1", representationBoundary: "DEFAULT", exclusionCount: 0 });
      expect(result.outputDifferenceCount).toBe(0);
      expect(result.latencyDeltaMs).toBe(30);
    });

    it("reports apiVersionChanged as null (UNKNOWN) rather than a false positive", async () => {
      const { service, prisma } = makeService();
      prisma.comparison.findUnique.mockResolvedValue(
        comparisonRow({ baselineSnapshot: snapshotRow({ apiVersion: "UNKNOWN" }), targetSnapshot: snapshotRow({ apiVersion: "1.2.0" }) }),
      );

      const result = await service.getComparison("cmp-1");

      expect(result.apiVersionChanged).toBeNull();
    });
  });

  describe("listComparisonFindings", () => {
    it("throws 404 when the Comparison has no attempts", async () => {
      const { service, prisma } = makeService();
      prisma.comparisonAttempt.findFirst.mockResolvedValue(null);

      const error = await captureError(service.listComparisonFindings("cmp-x", {} as ListComparisonFindingsQueryDto));
      expect(error.getStatus()).toBe(404);
    });

    it("filters by phase and derives ruleVersion from the latest attempt's manifest", async () => {
      const { service, prisma } = makeService();
      prisma.comparisonAttempt.findFirst.mockResolvedValue({
        comparisonAttemptId: "att-1",
        processingStatus: "COMPLETED",
        comparisonResult: "DIFFERENT",
        appliedRuleManifest: { ruleManifestVersion: 2 },
      });
      prisma.comparisonFinding.findMany.mockResolvedValue([
        { comparisonFindingId: "f-1", phase: "OUTPUT", component: "RESPONSE_BODY", differenceKind: "VALUE_CHANGED", findingOrdinal: 1, locationPath: "$.a", aByteOffset: null, aByteLength: null, bByteOffset: null, bByteLength: null, aValueKind: "string", bValueKind: "string", ruleCode: "R1", safeSummary: "changed" },
      ]);

      const result = await service.listComparisonFindings("cmp-1", { phase: "OUTPUT" } as ListComparisonFindingsQueryDto);

      expect(prisma.comparisonFinding.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { comparisonAttemptId: "att-1", phase: "OUTPUT" } }));
      expect(result.items[0].ruleVersion).toBe("2");
      expect(result.items[0].location).toEqual({ path: "$.a" });
    });
  });

  describe("retryComparison", () => {
    it("maps COMPARISON_NOT_FOUND to 404", async () => {
      const { service, comparisonService } = makeService();
      comparisonService.retryComparisonAttempt.mockResolvedValue({ ok: false, code: "COMPARISON_NOT_FOUND" });

      const error = await captureError(service.retryComparison("cmp-x", "u-1"));
      expect(error.getStatus()).toBe(404);
    });

    it("maps every other failure code to 409 using that code as errorCode", async () => {
      const { service, comparisonService } = makeService();
      comparisonService.retryComparisonAttempt.mockResolvedValue({ ok: false, code: "REASON_NOT_RETRYABLE" });

      const error = await captureError(service.retryComparison("cmp-1", "u-1"));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: "REASON_NOT_RETRYABLE" });
    });

    it("dispatches the engine and audits on success", async () => {
      const { service, comparisonService, comparisonEngineService, auditWriter } = makeService();
      comparisonService.retryComparisonAttempt.mockResolvedValue({ ok: true, comparisonAttemptId: "att-2", attemptNumber: 2 });

      const result = await service.retryComparison("cmp-1", "u-1");

      expect(result).toEqual({ comparisonAttemptId: "att-2", attemptNumber: 2, processingStatus: "QUEUED" });
      expect(comparisonEngineService.processAttempt).toHaveBeenCalledWith("att-2");
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "COMPARISON_RETRY_REQUESTED", result: "SUCCESS" }));
    });
  });

  describe("createClassificationEvent", () => {
    function classifyDto(overrides: Partial<CreateClassificationEventDto> = {}): CreateClassificationEventDto {
      return { classification: "UNEXPECTED", expectedRevision: null, ...overrides } as CreateClassificationEventDto;
    }

    it("maps NOT_CLASSIFIABLE to 409", async () => {
      const { service, comparisonService } = makeService();
      comparisonService.recordClassification.mockResolvedValue({ ok: false, code: "NOT_CLASSIFIABLE" });

      const error = await captureError(service.createClassificationEvent("cmp-1", classifyDto(), "u-1"));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: "NOT_CLASSIFIABLE" });
    });

    it("maps REVISION_CONFLICT to 409 with the current revision in the message", async () => {
      const { service, comparisonService } = makeService();
      comparisonService.recordClassification.mockResolvedValue({ ok: false, code: "REVISION_CONFLICT", currentRevision: 3 });

      const error = await captureError(service.createClassificationEvent("cmp-1", classifyDto(), "u-1"));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ errorCode: "REVISION_CONFLICT" });
    });

    it("re-fetches the created row and audits on success", async () => {
      const { service, comparisonService, prisma, auditWriter } = makeService();
      comparisonService.recordClassification.mockResolvedValue({ ok: true, revision: 1 });
      prisma.comparisonClassificationEvent.findUniqueOrThrow.mockResolvedValue({
        comparisonClassificationEventId: "ce-1",
        revision: 1,
        classification: "UNEXPECTED",
        note: null,
        classifiedByUserId: "u-1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      });

      const result = await service.createClassificationEvent("cmp-1", classifyDto(), "u-1");

      expect(prisma.comparisonClassificationEvent.findUniqueOrThrow).toHaveBeenCalledWith({ where: { comparisonId_revision: { comparisonId: "cmp-1", revision: 1 } } });
      expect(result.classificationEventId).toBe("ce-1");
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "COMPARISON_CLASSIFIED", result: "SUCCESS" }));
    });
  });

  describe("getComparisonChain", () => {
    it("throws 404 when missing", async () => {
      const { service, prisma } = makeService();
      prisma.comparisonChain.findUnique.mockResolvedValue(null);

      const error = await captureError(service.getComparisonChain("chain-x", {}));
      expect(error.getStatus()).toBe(404);
    });

    it("derives selectedSnapshotCount as totalItems + 1", async () => {
      const { service, prisma } = makeService();
      prisma.comparisonChain.findUnique.mockResolvedValue({
        comparisonChainId: "chain-1",
        projectId: "p-1",
        apiId: "a-1",
        environmentId: "e-1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        _count: { comparisons: 2 },
      });
      prisma.comparison.findMany.mockResolvedValue([comparisonRow({ pairOrdinal: 1 }), comparisonRow({ pairOrdinal: 2 })]);

      const result = await service.getComparisonChain("chain-1", {});

      expect(result.selectedSnapshotCount).toBe(3);
      expect(result.pairs).toHaveLength(2);
    });
  });
});
