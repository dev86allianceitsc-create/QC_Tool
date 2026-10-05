import { BusinessException } from "../../common/exceptions/business.exception";
import { IgnoreRulesService } from "./ignore-rules.service";

function p2002() {
  return { code: "P2002" };
}

describe("IgnoreRulesService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      project: { findFirst: jest.Mock };
      apiConfiguration: { findFirst: jest.Mock };
      ignoreRule: { findMany: jest.Mock; create: jest.Mock; createMany: jest.Mock; update: jest.Mock; delete: jest.Mock; findFirst: jest.Mock };
      $transaction: jest.Mock;
    } = {
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      apiConfiguration: { findFirst: jest.fn().mockResolvedValue({ apiId: "a-1", projectId: "p-1", deletedAt: null }) },
      ignoreRule: { findMany: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new IgnoreRulesService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  const ROW = {
    ignoreRuleId: "ir-1",
    projectId: "p-1",
    apiId: "a-1",
    scope: "API",
    path: "$.StartTime",
    enabled: true,
    note: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    api: { apiName: "Get Widget", httpMethod: "GET", path: "/widgets/:id" },
  };

  describe("list", () => {
    it("returns rules scoped to the project, newest-first within scope", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([ROW]);

      const result = await service.list("p-1", {});

      expect(prisma.ignoreRule.findMany).toHaveBeenCalledWith({
        where: { projectId: "p-1" },
        include: { api: { select: { apiName: true, httpMethod: true, path: true } } },
        orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
      });
      expect(result).toEqual([
        {
          ignoreRuleId: "ir-1",
          projectId: "p-1",
          apiId: "a-1",
          apiName: "Get Widget",
          apiMethod: "GET",
          apiPath: "/widgets/:id",
          scope: "API",
          path: "$.StartTime",
          enabled: true,
          note: null,
          createdAt: ROW.createdAt,
          updatedAt: ROW.updatedAt,
        },
      ]);
    });

    it("applies apiId/scope/enabled filters when provided", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([]);

      await service.list("p-1", { apiId: "a-1", scope: "API", enabled: true } as never);

      expect(prisma.ignoreRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: "p-1", apiId: "a-1", scope: "API", enabled: true } }),
      );
    });

    it("rejects with 404 when the Project does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      const error = await service.list("p-1", {}).catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.ignoreRule.findMany).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("creates an API-scoped rule and audits IGNORE_RULE_CREATED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.ignoreRule.create.mockResolvedValue(ROW);

      const result = await service.create("p-1", { scope: "API", apiId: "a-1", path: "$.StartTime" } as never, "user-1");

      expect(prisma.ignoreRule.create).toHaveBeenCalledWith({
        data: { projectId: "p-1", apiId: "a-1", scope: "API", path: "$.StartTime", enabled: true, note: null, createdByUserId: "user-1" },
        include: { api: { select: { apiName: true, httpMethod: true, path: true } } },
      });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "IGNORE_RULE_CREATED",
          targetId: "ir-1",
          afterData: { scope: "API", apiId: "a-1", path: "$.StartTime" },
        }),
        prisma,
      );
      expect(result.scope).toBe("API");
      expect(result.apiName).toBe("Get Widget");
    });

    it("creates a PROJECT-scoped rule with a null apiId, never looking up an API", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.create.mockResolvedValue({ ...ROW, scope: "PROJECT", apiId: null, api: null });

      await service.create("p-1", { scope: "PROJECT", path: "$.Data.Status" } as never, "user-1");

      expect(prisma.apiConfiguration.findFirst).not.toHaveBeenCalled();
      expect(prisma.ignoreRule.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ apiId: null, scope: "PROJECT" }) }));
    });

    it("rejects with 400 VALIDATION_ERROR when apiId is provided alongside scope=PROJECT", async () => {
      const { service, prisma } = makeService();

      const error = await service.create("p-1", { scope: "PROJECT", apiId: "a-1", path: "$.X" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(400);
      expect(prisma.ignoreRule.create).not.toHaveBeenCalled();
    });

    it("rejects with 404 when scope=API targets an API that does not exist (or is soft-deleted)", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);

      const error = await service.create("p-1", { scope: "API", apiId: "missing", path: "$.X" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.ignoreRule.create).not.toHaveBeenCalled();
    });

    it("rejects with 409 IGNORE_RULE_ALREADY_EXISTS on a unique-constraint violation", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.create.mockRejectedValue(p2002());

      const error = await service.create("p-1", { scope: "API", apiId: "a-1", path: "$.StartTime" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect((error as BusinessException).getResponse()).toMatchObject({ errorCode: "IGNORE_RULE_ALREADY_EXISTS" });
    });

    it("rejects a soft-deleted or INACTIVE Project with the assertProjectActive error", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      const error = await service.create("p-1", { scope: "API", apiId: "a-1", path: "$.StartTime" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.ignoreRule.create).not.toHaveBeenCalled();
    });
  });

  describe("bulkCreate", () => {
    it("creates one rule per distinct path via createMany+skipDuplicates and audits the whole batch once", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([
        { ...ROW, ignoreRuleId: "ir-1", path: "$.StartTime" },
        { ...ROW, ignoreRuleId: "ir-2", path: "$.EndTime" },
        { ...ROW, ignoreRuleId: "ir-3", path: "$.TotalMilli" },
      ]);

      const result = await service.bulkCreate("p-1", { scope: "API", apiId: "a-1", paths: ["$.StartTime", "$.EndTime", "$.TotalMilli"] } as never, "user-1");

      expect(prisma.ignoreRule.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ projectId: "p-1", apiId: "a-1", scope: "API", path: "$.StartTime", enabled: true }),
            expect.objectContaining({ path: "$.EndTime" }),
            expect.objectContaining({ path: "$.TotalMilli" }),
          ]),
          skipDuplicates: true,
        }),
      );
      expect(result.created).toHaveLength(3);
      expect(result.skippedCount).toBe(0);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "IGNORE_RULES_BULK_CREATED" }), prisma);
    });

    it("dedupes repeated paths in the same request before insert", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([{ ...ROW, path: "$.StartTime" }]);

      await service.bulkCreate("p-1", { scope: "API", apiId: "a-1", paths: ["$.StartTime", "$.StartTime"] } as never, "user-1");

      expect(prisma.ignoreRule.createMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it("reports a non-zero skippedCount when some paths already exist as rules (ON CONFLICT DO NOTHING)", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([{ ...ROW, path: "$.StartTime" }]);

      const result = await service.bulkCreate("p-1", { scope: "API", apiId: "a-1", paths: ["$.StartTime", "$.EndTime"] } as never, "user-1");

      expect(result.created).toHaveLength(1);
      expect(result.skippedCount).toBe(1);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ afterData: expect.objectContaining({ skippedCount: 1 }) }), prisma);
    });

    it("skips the audit entry entirely when every path in the batch was already a duplicate", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([]);

      const result = await service.bulkCreate("p-1", { scope: "API", apiId: "a-1", paths: ["$.StartTime"] } as never, "user-1");

      expect(result.created).toHaveLength(0);
      expect(result.skippedCount).toBe(1);
      expect(auditWriter.record).not.toHaveBeenCalled();
    });

    it("creates PROJECT-scoped rules with a null apiId", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([{ ...ROW, scope: "PROJECT", apiId: null, api: null }]);

      await service.bulkCreate("p-1", { scope: "PROJECT", paths: ["$.Data.Status"] } as never, "user-1");

      expect(prisma.ignoreRule.createMany.mock.calls[0][0].data[0]).toMatchObject({ apiId: null, scope: "PROJECT" });
    });
  });

  describe("update", () => {
    it("enables a disabled rule and audits IGNORE_RULE_ENABLED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.ignoreRule.findFirst.mockResolvedValue({ ...ROW, enabled: false });
      prisma.ignoreRule.update.mockResolvedValue({ ...ROW, enabled: true });

      const result = await service.update("p-1", "ir-1", { enabled: true } as never, "user-1");

      expect(prisma.ignoreRule.update).toHaveBeenCalledWith({ where: { ignoreRuleId: "ir-1" }, data: { enabled: true }, include: expect.anything() });
      expect(result.enabled).toBe(true);
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "IGNORE_RULE_ENABLED", beforeData: { enabled: false }, afterData: { enabled: true } }),
        prisma,
      );
    });

    it("disables an enabled rule and audits IGNORE_RULE_DISABLED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.ignoreRule.findFirst.mockResolvedValue({ ...ROW, enabled: true });
      prisma.ignoreRule.update.mockResolvedValue({ ...ROW, enabled: false });

      await service.update("p-1", "ir-1", { enabled: false } as never, "user-1");

      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "IGNORE_RULE_DISABLED" }), prisma);
    });

    it("rejects with 404 when the rule does not exist in this Project", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.findFirst.mockResolvedValue(null);

      const error = await service.update("p-1", "missing", { enabled: false } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.ignoreRule.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("deletes the rule and audits IGNORE_RULE_REMOVED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.ignoreRule.findFirst.mockResolvedValue(ROW);

      await service.remove("p-1", "ir-1", "user-1");

      expect(prisma.ignoreRule.delete).toHaveBeenCalledWith({ where: { ignoreRuleId: "ir-1" } });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "IGNORE_RULE_REMOVED", targetId: "ir-1", beforeData: { scope: "API", apiId: "a-1", path: "$.StartTime", enabled: true } }),
        prisma,
      );
    });

    it("rejects with 404 when the rule does not exist in this Project", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.findFirst.mockResolvedValue(null);

      const error = await service.remove("p-1", "missing", "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.ignoreRule.delete).not.toHaveBeenCalled();
    });
  });

  describe("listActiveRulesForScope", () => {
    it("returns enabled PROJECT-scope and API-scope rules for this exact pair, as a plain ref shape", async () => {
      const { service, prisma } = makeService();
      prisma.ignoreRule.findMany.mockResolvedValue([
        { ignoreRuleId: "ir-1", scope: "API", path: "$.StartTime" },
        { ignoreRuleId: "ir-2", scope: "PROJECT", path: "$.Data.Status" },
      ]);

      const result = await service.listActiveRulesForScope("p-1", "a-1");

      expect(prisma.ignoreRule.findMany).toHaveBeenCalledWith({
        where: { enabled: true, OR: [{ scope: "PROJECT", projectId: "p-1" }, { scope: "API", apiId: "a-1" }] },
        select: { ignoreRuleId: true, scope: true, path: true },
      });
      expect(result).toEqual([
        { ignoreRuleId: "ir-1", scope: "API", path: "$.StartTime" },
        { ignoreRuleId: "ir-2", scope: "PROJECT", path: "$.Data.Status" },
      ]);
    });
  });
});
