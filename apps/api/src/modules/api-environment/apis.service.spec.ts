import { BusinessException } from "../../common/exceptions/business.exception";
import { ApisService } from "./apis.service";

describe("ApisService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      project: { findFirst: jest.Mock };
      apiConfiguration: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
      $transaction: jest.Mock;
    } = {
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      apiConfiguration: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new ApisService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  describe("create (API-API-002)", () => {
    it("rejects a duplicate active Project+Method+Path with 409 API_ALREADY_EXISTS", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "existing" });

      await expect(
        service.create("p-1", { apiName: "X", httpMethod: "GET", path: "/x" } as never, "admin-1"),
      ).rejects.toBeInstanceOf(BusinessException);
      expect(prisma.apiConfiguration.create).not.toHaveBeenCalled();
    });

    it("creates with creationSource=MANUAL and audits API_CREATED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);
      const created = { apiId: "a-1", apiName: "X", httpMethod: "GET", path: "/x", description: null, creationSource: "MANUAL" };
      prisma.apiConfiguration.create.mockResolvedValue(created);

      await service.create("p-1", { apiName: "X", httpMethod: "GET", path: "/x" } as never, "admin-1");

      expect(prisma.apiConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ creationSource: "MANUAL" }),
      });
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "API_CREATED" }), prisma);
    });

    it("throws 409 CONFLICT when the project is not ACTIVE", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1", projectStatus: "INACTIVE", deletedAt: null });

      await expect(
        service.create("p-1", { apiName: "X", httpMethod: "GET", path: "/x" } as never, "admin-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    // 3B FINAL FROZEN API Contract §9/§14 — unsupported Method is a 422
    // semantic violation, not a 400 malformed-shape error.
    it("rejects an unsupported HTTP Method with 422 SEMANTIC_VALIDATION_ERROR, before touching the DB", async () => {
      const { service, prisma } = makeService();

      const error = await service
        .create("p-1", { apiName: "X", httpMethod: "TRACE", path: "/x" } as never, "admin-1")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
      expect((error as BusinessException).getResponse()).toMatchObject({ errorCode: "SEMANTIC_VALIDATION_ERROR" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])("accepts supported Method %s", async (httpMethod) => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);
      prisma.apiConfiguration.create.mockResolvedValue({ apiId: "a-1", apiName: "X", httpMethod, path: "/x", description: null, creationSource: "MANUAL" });

      await expect(service.create("p-1", { apiName: "X", httpMethod, path: "/x" } as never, "admin-1")).resolves.toBeDefined();
    });
  });

  describe("update (API-API-004) — PATCH semantics", () => {
    it("rejects an empty patch with 400 VALIDATION_ERROR", async () => {
      const { service } = makeService();

      await expect(service.update("p-1", "a-1", {} as never, "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("only re-checks the duplicate identity when method or path actually changes", async () => {
      const { service, prisma } = makeService();
      const existing = { apiId: "a-1", apiName: "Old", httpMethod: "GET", path: "/x", description: null };
      prisma.apiConfiguration.findFirst.mockResolvedValueOnce(existing);
      prisma.apiConfiguration.update.mockResolvedValue({ ...existing, apiName: "New" });

      await service.update("p-1", "a-1", { apiName: "New" } as never, "admin-1");

      expect(prisma.apiConfiguration.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.apiConfiguration.update).toHaveBeenCalledWith({ where: { apiId: "a-1" }, data: { apiName: "New" } });
    });

    it("rejects a change of method/path that collides with another active API (409)", async () => {
      const { service, prisma } = makeService();
      const existing = { apiId: "a-1", apiName: "Old", httpMethod: "GET", path: "/x", description: null };
      prisma.apiConfiguration.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ apiId: "other" });

      await expect(
        service.update("p-1", "a-1", { path: "/y" } as never, "admin-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it("treats a no-op patch (values equal to existing) as unchanged — no update, no audit", async () => {
      const { service, prisma, auditWriter } = makeService();
      const existing = { apiId: "a-1", apiName: "Same", httpMethod: "GET", path: "/x", description: null };
      prisma.apiConfiguration.findFirst.mockResolvedValueOnce(existing);

      const result = await service.update("p-1", "a-1", { apiName: "Same" } as never, "admin-1");

      expect(prisma.apiConfiguration.update).not.toHaveBeenCalled();
      expect(auditWriter.record).not.toHaveBeenCalled();
      expect(result.apiName).toBe("Same");
    });

    it("rejects an unsupported HTTP Method with 422 SEMANTIC_VALIDATION_ERROR when httpMethod is supplied", async () => {
      const { service, prisma } = makeService();

      const error = await service.update("p-1", "a-1", { httpMethod: "TRACE" } as never, "admin-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("does not enforce the Method allowlist when httpMethod is omitted from the patch", async () => {
      const { service, prisma } = makeService();
      const existing = { apiId: "a-1", apiName: "Old", httpMethod: "GET", path: "/x", description: null };
      prisma.apiConfiguration.findFirst.mockResolvedValueOnce(existing);
      prisma.apiConfiguration.update.mockResolvedValue({ ...existing, apiName: "New" });

      await expect(service.update("p-1", "a-1", { apiName: "New" } as never, "admin-1")).resolves.toBeDefined();
    });
  });

  describe("softDelete (API-API-005)", () => {
    it("throws 404 for an absent or already-deleted API", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);

      await expect(service.softDelete("p-1", "a-1", "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("sets deletedAt and audits API_SOFT_DELETED, never hard-deleting the row", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", apiName: "X" });
      prisma.apiConfiguration.update.mockResolvedValue({ apiId: "a-1", deletedAt: new Date() });

      await service.softDelete("p-1", "a-1", "admin-1");

      expect(prisma.apiConfiguration.update).toHaveBeenCalledWith({
        where: { apiId: "a-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "API_SOFT_DELETED" }), prisma);
    });
  });
});
