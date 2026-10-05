import { BusinessException } from "../../common/exceptions/business.exception";
import { RunDetail, RunsService, TestCaseListItem } from "./runs.service";

function makeService() {
  const prisma = {
    apiConfiguration: { findFirst: jest.fn() },
    runExecution: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    comparison: { findUnique: jest.fn() },
    comparisonAttempt: { findFirst: jest.fn() },
    snapshot: { findUnique: jest.fn() },
  };
  const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
  const executionEngine = { dispatchRun: jest.fn().mockResolvedValue(undefined) };
  const service = new RunsService(prisma as never, auditWriter as never, executionEngine as never);
  return { service, prisma, auditWriter, executionEngine };
}

const SAVED_INPUT = {
  pathValues: { id: "123" },
  queryValues: { screen: "HOME" },
  headerValues: { "X-Custom": "abc" },
  bodyValue: "",
};

function executionRow(overrides: Record<string, unknown> = {}) {
  return {
    runExecutionId: "re-1",
    apiId: "api-1",
    apiVersion: "1.0",
    databaseVersion: "UNKNOWN",
    requestInputSnapshot: SAVED_INPUT,
    run: { environmentId: "env-1", testAccountId: "ta-1" },
    ...overrides,
  };
}

describe("RunsService", () => {
  describe("runAgain", () => {
    it("throws NOT_FOUND when the execution does not exist for this API/Project", async () => {
      const { service, prisma } = makeService();
      prisma.runExecution.findFirst.mockResolvedValue(null);

      const err = await service.runAgain("p-1", "api-1", "re-1", "u-1").catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "NOT_FOUND" });
    });

    it("throws NO_SAVED_INPUT (422) when the execution predates requestInputSnapshot", async () => {
      const { service, prisma } = makeService();
      prisma.runExecution.findFirst.mockResolvedValue(executionRow({ requestInputSnapshot: null }));

      const err = await service.runAgain("p-1", "api-1", "re-1", "u-1").catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "NO_SAVED_INPUT" });
    });

    it("resubmits the saved Request Input as a plain SINGLE Run, with no rerun lineage/forced baseline", async () => {
      const { service, prisma } = makeService();
      prisma.runExecution.findFirst.mockResolvedValue(executionRow());
      const fakeRunDetail = { runId: "run-2" } as unknown as RunDetail;
      const createRunSpy = jest.spyOn(service, "createRun").mockResolvedValue(fakeRunDetail);

      const result = await service.runAgain("p-1", "api-1", "re-1", "u-1");

      expect(result).toBe(fakeRunDetail);
      expect(createRunSpy).toHaveBeenCalledWith(
        "p-1",
        {
          runType: "SINGLE",
          environmentId: "env-1",
          testAccountId: "ta-1",
          executions: [
            {
              apiId: "api-1",
              requestValues: SAVED_INPUT,
              apiVersion: "1.0",
              databaseVersion: "UNKNOWN",
            },
          ],
        },
        "u-1",
      );
    });
  });

  describe("reRunExecution", () => {
    it("throws NOT_FOUND when the execution does not exist for this API/Project", async () => {
      const { service, prisma } = makeService();
      prisma.runExecution.findFirst.mockResolvedValue(null);

      const err = await service.reRunExecution("p-1", "api-1", "re-1", "u-1").catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "NOT_FOUND" });
    });

    it("throws NOT_REPLAYABLE (422) when the execution has nothing saved to replay", async () => {
      const { service, prisma } = makeService();
      prisma.runExecution.findFirst.mockResolvedValue(executionRow({ requestInputSnapshot: null }));

      const err = await service.reRunExecution("p-1", "api-1", "re-1", "u-1").catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "NOT_REPLAYABLE" });
    });

    it("resubmits the saved Request Input and forces the baseline/lineage back to this specific execution", async () => {
      const { service, prisma } = makeService();
      prisma.runExecution.findFirst.mockResolvedValue(executionRow());
      const fakeRunDetail = { runId: "run-3" } as unknown as RunDetail;
      const createRunSpy = jest.spyOn(service, "createRun").mockResolvedValue(fakeRunDetail);

      const result = await service.reRunExecution("p-1", "api-1", "re-1", "u-1");

      expect(result).toBe(fakeRunDetail);
      expect(createRunSpy).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ runType: "SINGLE", environmentId: "env-1", testAccountId: "ta-1" }),
        "u-1",
        { rerunOfExecutionId: "re-1", forcedBaselineSourceExecutionId: "re-1" },
      );
    });
  });

  describe("listTestCases", () => {
    function latestExecRow(overrides: Record<string, unknown> = {}) {
      return {
        runExecutionId: "re-latest",
        apiId: "api-1",
        testCaseKey: "tck-1",
        authType: "NONE",
        requestInputSnapshot: SAVED_INPUT,
        requestSentAt: new Date("2026-10-01T00:00:00Z"),
        createdAt: new Date("2026-10-01T00:00:00Z"),
        executionStatus: "COMPLETED",
        baselineSnapshotId: null,
        comparisonAvailabilityReasonCode: null,
        run: {
          environmentId: "env-1",
          testAccountId: null,
          environment: { environmentName: "DEV" },
          testAccount: null,
        },
        ...overrides,
      };
    }

    it("throws NOT_FOUND when the API does not exist in this Project", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);

      const err = await service.listTestCases("p-1", "api-1").catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "NOT_FOUND" });
    });

    it("returns [] when this API has no dispatched (testCaseKey-bearing) executions yet", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([]);

      await expect(service.listTestCases("p-1", "api-1")).resolves.toEqual([]);
      expect(prisma.runExecution.groupBy).not.toHaveBeenCalled();
    });

    it("queries one latest execution per distinct testCaseKey and scopes strictly to this API", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([latestExecRow()]);
      prisma.runExecution.groupBy.mockResolvedValue([
        { testCaseKey: "tck-1", _count: { testCaseKey: 1 }, _min: { requestSentAt: latestExecRow().requestSentAt } },
      ]);
      prisma.comparison.findUnique.mockResolvedValue(null);

      await service.listTestCases("p-1", "api-1");

      expect(prisma.runExecution.findMany).toHaveBeenCalledWith({
        where: { apiId: "api-1", testCaseKey: { not: null } },
        distinct: ["testCaseKey"],
        orderBy: [{ testCaseKey: "asc" }, { requestSentAt: "desc" }],
        include: { run: { include: { environment: true, testAccount: true } } },
      });
      expect(prisma.runExecution.groupBy).toHaveBeenCalledWith({
        by: ["testCaseKey"],
        where: { apiId: "api-1", testCaseKey: { in: ["tck-1"] } },
        _count: { testCaseKey: true },
        _min: { requestSentAt: true },
      });
    });

    it("sorts cards most-recently-run first regardless of the underlying query's row order", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      const older = latestExecRow({ testCaseKey: "tck-older", requestSentAt: new Date("2026-09-01T00:00:00Z") });
      const newer = latestExecRow({ testCaseKey: "tck-newer", requestSentAt: new Date("2026-10-01T00:00:00Z") });
      prisma.runExecution.findMany.mockResolvedValue([older, newer]);
      prisma.runExecution.groupBy.mockResolvedValue([
        { testCaseKey: "tck-older", _count: { testCaseKey: 3 }, _min: { requestSentAt: new Date("2026-08-01T00:00:00Z") } },
        { testCaseKey: "tck-newer", _count: { testCaseKey: 1 }, _min: { requestSentAt: new Date("2026-10-01T00:00:00Z") } },
      ]);
      prisma.comparison.findUnique.mockResolvedValue(null);

      const result = await service.listTestCases("p-1", "api-1");

      expect(result.map((item) => item.testCaseKey)).toEqual(["tck-newer", "tck-older"]);
      expect(result.find((item) => item.testCaseKey === "tck-older")?.runCount).toBe(3);
      expect(result.find((item) => item.testCaseKey === "tck-newer")?.runCount).toBe(1);
    });

    // Regression coverage for the manual-testing bug report: "Test Case N" is
    // a stable ordinal ranked by first-ever run, never the list's display
    // position (which is still most-recently-run-first, above). A Run Again
    // on any card — including one that is not the most recently run — must
    // never renumber itself or any other card.
    describe("testCaseNumber stability (Run Again must not renumber or misattribute cards)", () => {
      it("ranks testCaseNumber by first-run order, independent of the most-recently-run-first display order", async () => {
        const { service, prisma } = makeService();
        prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
        // tck-a was first run before tck-b, but tck-b's latest execution is
        // the most recently run of the two — so display order (newest first)
        // and first-run order are deliberately inverted here.
        const a = latestExecRow({ testCaseKey: "tck-a", requestSentAt: new Date("2026-09-10T00:00:00Z") });
        const b = latestExecRow({ testCaseKey: "tck-b", requestSentAt: new Date("2026-09-20T00:00:00Z") });
        prisma.runExecution.findMany.mockResolvedValue([a, b]);
        prisma.runExecution.groupBy.mockResolvedValue([
          { testCaseKey: "tck-a", _count: { testCaseKey: 1 }, _min: { requestSentAt: new Date("2026-09-01T00:00:00Z") } },
          { testCaseKey: "tck-b", _count: { testCaseKey: 1 }, _min: { requestSentAt: new Date("2026-09-05T00:00:00Z") } },
        ]);
        prisma.comparison.findUnique.mockResolvedValue(null);

        const result = await service.listTestCases("p-1", "api-1");

        expect(result.map((item) => item.testCaseKey)).toEqual(["tck-b", "tck-a"]);
        expect(result.find((item) => item.testCaseKey === "tck-a")?.testCaseNumber).toBe(1);
        expect(result.find((item) => item.testCaseKey === "tck-b")?.testCaseNumber).toBe(2);
      });

      it("keeps every card's testCaseNumber unchanged after Run Again bumps one card's runCount/lastRunAt past the others (reproduces the reported bug)", async () => {
        const { service, prisma } = makeService();
        prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
        prisma.comparison.findUnique.mockResolvedValue(null);

        // Before Run Again: tck-1 (oldest first run -> Test Case 1) is not the
        // most recently run; tck-2 (second-oldest first run -> Test Case 2,
        // the user's "11 runs" card) currently is.
        prisma.runExecution.findMany.mockResolvedValue([
          latestExecRow({ testCaseKey: "tck-1", requestSentAt: new Date("2026-09-10T00:00:00Z") }),
          latestExecRow({ testCaseKey: "tck-2", requestSentAt: new Date("2026-09-20T00:00:00Z") }),
        ]);
        prisma.runExecution.groupBy.mockResolvedValue([
          { testCaseKey: "tck-1", _count: { testCaseKey: 4 }, _min: { requestSentAt: new Date("2026-09-01T00:00:00Z") } },
          { testCaseKey: "tck-2", _count: { testCaseKey: 11 }, _min: { requestSentAt: new Date("2026-09-02T00:00:00Z") } },
        ]);

        const before = await service.listTestCases("p-1", "api-1");
        expect(before.map((item) => item.testCaseKey)).toEqual(["tck-2", "tck-1"]);
        expect(before.find((item) => item.testCaseKey === "tck-1")?.testCaseNumber).toBe(1);
        expect(before.find((item) => item.testCaseKey === "tck-2")?.testCaseNumber).toBe(2);
        expect(before.find((item) => item.testCaseKey === "tck-2")?.runCount).toBe(11);

        // Run Again on tck-2 (now 12 runs, lastRunAt pushed even further
        // ahead) — firstRunAt for both cards is unchanged.
        prisma.runExecution.findMany.mockResolvedValue([
          latestExecRow({ testCaseKey: "tck-1", requestSentAt: new Date("2026-09-10T00:00:00Z") }),
          latestExecRow({ testCaseKey: "tck-2", requestSentAt: new Date("2026-10-01T00:00:00Z") }),
        ]);
        prisma.runExecution.groupBy.mockResolvedValue([
          { testCaseKey: "tck-1", _count: { testCaseKey: 4 }, _min: { requestSentAt: new Date("2026-09-01T00:00:00Z") } },
          { testCaseKey: "tck-2", _count: { testCaseKey: 12 }, _min: { requestSentAt: new Date("2026-09-02T00:00:00Z") } },
        ]);

        const after = await service.listTestCases("p-1", "api-1");
        // tck-2 is still the most recently run, so it is still first in the
        // list — but it must still read as "Test Case 2", not "Test Case 1",
        // and tck-1 (untouched) must not have gained tck-2's run count.
        expect(after.map((item) => item.testCaseKey)).toEqual(["tck-2", "tck-1"]);
        expect(after.find((item) => item.testCaseKey === "tck-2")?.testCaseNumber).toBe(2);
        expect(after.find((item) => item.testCaseKey === "tck-2")?.runCount).toBe(12);
        expect(after.find((item) => item.testCaseKey === "tck-1")?.testCaseNumber).toBe(1);
        expect(after.find((item) => item.testCaseKey === "tck-1")?.runCount).toBe(4);
      });

      it("assigns a stable testCaseNumber to each of four+ Test Cases and keeps them stable as any one of them is run again", async () => {
        const { service, prisma } = makeService();
        prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
        prisma.comparison.findUnique.mockResolvedValue(null);

        const firstRunAt: Record<string, string> = {
          "tck-1": "2026-09-01T00:00:00Z",
          "tck-2": "2026-09-02T00:00:00Z",
          "tck-3": "2026-09-03T00:00:00Z",
          "tck-4": "2026-09-04T00:00:00Z",
        };
        const lastRunAt: Record<string, string> = {
          "tck-1": "2026-09-11T00:00:00Z",
          "tck-2": "2026-09-12T00:00:00Z",
          "tck-3": "2026-09-13T00:00:00Z",
          "tck-4": "2026-09-14T00:00:00Z",
        };

        function mockListWith(lastRunAtOverrides: Record<string, string>) {
          prisma.runExecution.findMany.mockResolvedValue(
            Object.keys(firstRunAt).map((key) =>
              latestExecRow({ testCaseKey: key, requestSentAt: new Date(lastRunAtOverrides[key]) }),
            ),
          );
          prisma.runExecution.groupBy.mockResolvedValue(
            Object.keys(firstRunAt).map((key) => ({
              testCaseKey: key,
              _count: { testCaseKey: 1 },
              _min: { requestSentAt: new Date(firstRunAt[key]) },
            })),
          );
        }

        mockListWith(lastRunAt);
        const before = await service.listTestCases("p-1", "api-1");
        const numbersBefore = new Map(before.map((item) => [item.testCaseKey, item.testCaseNumber]));
        expect([...numbersBefore.entries()].sort()).toEqual([
          ["tck-1", 1],
          ["tck-2", 2],
          ["tck-3", 3],
          ["tck-4", 4],
        ]);

        // Click "Run Again" on tck-4 (the previously-most-recent one stays
        // most recent, but far more recent now) — first-run timestamps are
        // untouched for every card.
        mockListWith({ ...lastRunAt, "tck-4": "2026-10-01T00:00:00Z" });
        const afterRunAgainOn4 = await service.listTestCases("p-1", "api-1");
        for (const item of afterRunAgainOn4) {
          expect(item.testCaseNumber).toBe(numbersBefore.get(item.testCaseKey));
        }

        // Click "Run Again" on tck-1 (previously the least-recently-run) —
        // it jumps to the top of the display order, but its number must stay 1.
        mockListWith({ ...lastRunAt, "tck-4": "2026-10-01T00:00:00Z", "tck-1": "2026-10-02T00:00:00Z" });
        const afterRunAgainOn1 = await service.listTestCases("p-1", "api-1");
        expect(afterRunAgainOn1.map((item) => item.testCaseKey)).toEqual(["tck-1", "tck-4", "tck-3", "tck-2"]);
        for (const item of afterRunAgainOn1) {
          expect(item.testCaseNumber).toBe(numbersBefore.get(item.testCaseKey));
        }
      });
    });

    it("maps environmentName/testAccountLabel/inputSummary straight from the latest execution's own row", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([
        latestExecRow({
          run: {
            environmentId: "env-1",
            testAccountId: "ta-1",
            environment: { environmentName: "QA" },
            testAccount: { label: "QA Tester" },
          },
        }),
      ]);
      prisma.runExecution.groupBy.mockResolvedValue([
        { testCaseKey: "tck-1", _count: { testCaseKey: 1 }, _min: { requestSentAt: latestExecRow().requestSentAt } },
      ]);
      prisma.comparison.findUnique.mockResolvedValue(null);

      const [item] = await service.listTestCases("p-1", "api-1");

      expect(item).toMatchObject({
        environmentId: "env-1",
        environmentName: "QA",
        testAccountId: "ta-1",
        testAccountLabel: "QA Tester",
        inputSummary: SAVED_INPUT,
        lastExecutionId: "re-latest",
      });
    });

    async function lastResultFor(row: Record<string, unknown>, mocks: { comparison?: unknown; attempt?: unknown }): Promise<TestCaseListItem["lastResult"]> {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([latestExecRow(row)]);
      prisma.runExecution.groupBy.mockResolvedValue([
        { testCaseKey: "tck-1", _count: { testCaseKey: 1 }, _min: { requestSentAt: latestExecRow().requestSentAt } },
      ]);
      prisma.comparison.findUnique.mockResolvedValue(mocks.comparison ?? null);
      prisma.comparisonAttempt.findFirst.mockResolvedValue(mocks.attempt ?? null);

      const [item] = await service.listTestCases("p-1", "api-1");
      return item.lastResult;
    }

    it("lastResult = INITIAL_RUN when no baseline existed yet (concept A had nothing to chain to)", async () => {
      const result = await lastResultFor({ comparisonAvailabilityReasonCode: "NO_BASELINE" }, {});
      expect(result).toBe("INITIAL_RUN");
    });

    it("lastResult = UNAVAILABLE when a baseline existed but this execution never produced a target Snapshot", async () => {
      const result = await lastResultFor({ comparisonAvailabilityReasonCode: "NO_NEW_SNAPSHOT" }, { comparison: null });
      expect(result).toBe("UNAVAILABLE");
    });

    it("lastResult = SAME/DIFFERENT only when the sourced Comparison's latest attempt actually COMPLETED", async () => {
      const diff = await lastResultFor({ comparisonAvailabilityReasonCode: null }, { comparison: { comparisonId: "cmp-1" }, attempt: { processingStatus: "COMPLETED", comparisonResult: "DIFFERENT" } });
      expect(diff).toBe("DIFFERENT");

      const same = await lastResultFor({ comparisonAvailabilityReasonCode: null }, { comparison: { comparisonId: "cmp-2" }, attempt: { processingStatus: "COMPLETED", comparisonResult: "SAME" } });
      expect(same).toBe("SAME");
    });

    it("lastResult = UNAVAILABLE (never SAME/DIFFERENT) when the Comparison exists but its latest attempt is BLOCKED", async () => {
      const result = await lastResultFor(
        { comparisonAvailabilityReasonCode: null },
        { comparison: { comparisonId: "cmp-3" }, attempt: { processingStatus: "BLOCKED", comparisonResult: null } },
      );
      expect(result).toBe("UNAVAILABLE");
    });
  });

  describe("listApiRunExecutions", () => {
    function runExecRow(overrides: Record<string, unknown> = {}) {
      return {
        runId: "run-1",
        runExecutionId: "re-1",
        executionStatus: "COMPLETED",
        executionOutcome: "RESPONSE_RECEIVED",
        httpStatus: 200,
        apiVersion: "1.0",
        databaseVersion: "UNKNOWN",
        createdAt: new Date("2026-10-01T00:00:00Z"),
        testCaseKey: "tck-1",
        authType: "NONE",
        rerunOfExecutionId: null,
        baselineSnapshotId: null,
        comparisonAvailabilityReasonCode: "NO_BASELINE",
        run: { runType: "SINGLE", environmentId: "env-1", testAccountId: null },
        ...overrides,
      };
    }

    it("throws NOT_FOUND when the API does not exist in this Project", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);

      const err = await service.listApiRunExecutions("p-1", "api-1", {}).catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "NOT_FOUND" });
    });

    it("scopes to this API and applies the optional environmentId/testCaseKey filters", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([]);
      prisma.runExecution.count.mockResolvedValue(0);

      await service.listApiRunExecutions("p-1", "api-1", { environmentId: "env-1", testCaseKey: "tck-1" });

      expect(prisma.runExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { apiId: "api-1", run: { environmentId: "env-1" }, testCaseKey: "tck-1" },
        }),
      );
    });

    it("derives comparisonResult=INITIAL_RUN and comparedWithAt=null when no baseline existed yet (concept A had nothing to chain to)", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([runExecRow()]);
      prisma.runExecution.count.mockResolvedValue(1);

      const result = await service.listApiRunExecutions("p-1", "api-1", {});

      expect(result.items[0]).toMatchObject({
        comparisonResult: "INITIAL_RUN",
        comparedWithAt: null,
        comparisonId: null,
      });
    });

    it("derives comparisonResult=SAME/DIFFERENT and comparedWithAt from the baseline Snapshot's completedAt when the sourced Comparison's latest attempt COMPLETED", async () => {
      const { service, prisma } = makeService();
      const baselineCompletedAt = new Date("2026-09-01T00:00:00Z");
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([
        runExecRow({ baselineSnapshotId: "snap-1", comparisonAvailabilityReasonCode: null }),
      ]);
      prisma.runExecution.count.mockResolvedValue(1);
      prisma.comparison.findUnique.mockResolvedValue({ comparisonId: "cmp-1" });
      prisma.comparisonAttempt.findFirst.mockResolvedValue({ processingStatus: "COMPLETED", comparisonResult: "DIFFERENT" });
      prisma.snapshot.findUnique.mockResolvedValue({ completedAt: baselineCompletedAt });

      const result = await service.listApiRunExecutions("p-1", "api-1", {});

      // Regression: a SAME/DIFFERENT row must carry the comparisonId its
      // "View Differences" action needs to open the Comparison page directly
      // — before this field existed, the UI had no way to do that and fell
      // back to the execution's own detail page instead.
      expect(result.items[0]).toMatchObject({
        comparisonResult: "DIFFERENT",
        comparedWithAt: baselineCompletedAt,
        comparisonId: "cmp-1",
      });
    });

    it("derives comparisonResult=UNAVAILABLE but still resolves comparedWithAt when a baseline existed but no Comparison ever completed against it", async () => {
      const { service, prisma } = makeService();
      const baselineCompletedAt = new Date("2026-09-01T00:00:00Z");
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "api-1" });
      prisma.runExecution.findMany.mockResolvedValue([
        runExecRow({ baselineSnapshotId: "snap-1", comparisonAvailabilityReasonCode: null }),
      ]);
      prisma.runExecution.count.mockResolvedValue(1);
      prisma.comparison.findUnique.mockResolvedValue(null);
      prisma.snapshot.findUnique.mockResolvedValue({ completedAt: baselineCompletedAt });

      const result = await service.listApiRunExecutions("p-1", "api-1", {});

      expect(result.items[0]).toMatchObject({
        comparisonResult: "UNAVAILABLE",
        comparedWithAt: baselineCompletedAt,
        comparisonId: null,
      });
    });
  });
});
