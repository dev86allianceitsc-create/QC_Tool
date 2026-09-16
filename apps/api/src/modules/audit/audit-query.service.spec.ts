import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditQueryService } from "./audit-query.service";

describe("AuditQueryService", () => {
  function makeService() {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
    };
    const service = new AuditQueryService(prisma as never);
    return { service, prisma };
  }

  describe("buildWhere", () => {
    it("builds an empty filter when nothing is supplied", () => {
      const { service } = makeService();
      expect(service.buildWhere({})).toEqual({});
    });

    it("builds a case-insensitive OR search across actorDisplay/targetDisplay", () => {
      const { service } = makeService();
      expect(service.buildWhere({ search: "alice" })).toMatchObject({
        OR: [
          { actorDisplay: { contains: "alice", mode: "insensitive" } },
          { targetDisplay: { contains: "alice", mode: "insensitive" } },
        ],
      });
    });

    it("applies direct equality filters for eventType/result/projectId/actorUserId", () => {
      const { service } = makeService();
      const where = service.buildWhere({
        eventType: "PROJECT_CREATED",
        result: "SUCCESS",
        projectId: "p-1",
        actorUserId: "u-1",
      });
      expect(where).toMatchObject({
        eventType: "PROJECT_CREATED",
        result: "SUCCESS",
        projectId: "p-1",
        actorUserId: "u-1",
      });
    });

    it("builds an occurredAt range from from/to", () => {
      const { service } = makeService();
      const where = service.buildWhere({ from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T00:00:00.000Z" });
      expect(where.occurredAt).toEqual({
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-01-31T00:00:00.000Z"),
      });
    });

    it("rejects a `to` earlier than `from` with 400 VALIDATION_ERROR, for both list and export callers", () => {
      const { service } = makeService();
      expect(() => service.buildWhere({ from: "2026-02-01T00:00:00.000Z", to: "2026-01-01T00:00:00.000Z" })).toThrow(
        BusinessException,
      );
    });
  });

  describe("list", () => {
    it("paginates and orders by occurredAt per sortOrder, applying the same buildWhere() filters", async () => {
      const { service, prisma } = makeService();
      prisma.auditLog.count.mockResolvedValue(45);

      const result = await service.list({ page: 2, pageSize: 20, sortOrder: "asc", projectId: "p-1" } as never);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: "p-1" }),
          orderBy: { occurredAt: "asc" },
          skip: 20,
          take: 20,
        }),
      );
      expect(result).toMatchObject({ page: 2, pageSize: 20, totalItems: 45, totalPages: 3 });
    });
  });

  describe("getById", () => {
    it("returns full detail including beforeData/afterData for an existing row", async () => {
      const { service, prisma } = makeService();
      const row = {
        auditId: "a-1",
        eventType: "PROJECT_CREATED",
        result: "SUCCESS",
        occurredAt: new Date(),
        actorUserId: "u-1",
        actorDisplay: "admin@example.com",
        targetType: "PROJECT",
        targetId: "p-1",
        targetDisplay: "Project X",
        projectId: "p-1",
        beforeData: null,
        afterData: { projectName: "Project X" },
        requestId: "req-1",
        detail: null,
      };
      prisma.auditLog.findUnique.mockResolvedValue(row);

      await expect(service.getById("a-1")).resolves.toEqual(row);
    });

    it("throws 404 NOT_FOUND when the audit row does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.auditLog.findUnique.mockResolvedValue(null);

      const err = await service.getById("missing").catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "NOT_FOUND" });
    });
  });

  describe("listAllForExport", () => {
    it("returns the full matching set with no pagination, using the same buildWhere() filters as list()", async () => {
      const { service, prisma } = makeService();

      await service.listAllForExport({ result: "FAILURE" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { result: "FAILURE" },
        orderBy: { occurredAt: "desc" },
      });
    });
  });
});
