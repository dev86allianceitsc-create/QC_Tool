import { BusinessException } from "../../common/exceptions/business.exception";
import { ProjectsService } from "./projects.service";

describe("ProjectsService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      project: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
      $transaction: jest.Mock;
    } = {
      project: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new ProjectsService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  describe("list (API-PRJ-001)", () => {
    it("does not scope by membership for an admin caller", async () => {
      const { service, prisma } = makeService();

      await service.list({} as never, "admin-1", true);

      const where = prisma.project.findMany.mock.calls[0][0].where;
      expect(where.memberships).toBeUndefined();
      expect(where.deletedAt).toBeNull();
    });

    it("scopes to the caller's own memberships for a non-admin caller", async () => {
      const { service, prisma } = makeService();

      await service.list({} as never, "user-1", false);

      const where = prisma.project.findMany.mock.calls[0][0].where;
      expect(where.memberships).toEqual({ some: { userId: "user-1" } });
    });
  });

  describe("create (API-PRJ-002)", () => {
    it("rejects a blank projectName with 400 VALIDATION_ERROR", async () => {
      const { service } = makeService();

      await expect(service.create({ projectName: "   " } as never, "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("creates the project as ACTIVE and records a PROJECT_CREATED audit row in the same transaction", async () => {
      const { service, prisma, auditWriter } = makeService();
      const created = {
        projectId: "p-1",
        projectName: "New Project",
        description: null,
        projectStatus: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.project.create.mockResolvedValue(created);

      const result = await service.create({ projectName: "New Project" } as never, "admin-1");

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { projectName: "New Project", description: null, projectStatus: "ACTIVE" },
      });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PROJECT_CREATED", result: "SUCCESS", actorUserId: "admin-1" }),
        prisma,
      );
      expect(result.projectStatus).toBe("ACTIVE");
    });
  });

  describe("getById (API-PRJ-003)", () => {
    it("throws 404 NOT_FOUND for a soft-deleted or absent project", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.getById("missing")).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe("update (API-PRJ-004)", () => {
    it("rejects an empty patch with 400 VALIDATION_ERROR", async () => {
      const { service } = makeService();

      await expect(service.update("p-1", {} as never, "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("rejects an invalid projectStatus value with 409 CONFLICT", async () => {
      const { service } = makeService();

      await expect(service.update("p-1", { projectStatus: "ARCHIVED" } as never, "admin-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
    });

    it("throws 404 for a missing project", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.update("p-1", { projectName: "X" } as never, "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("updates name/description and emits a single PROJECT_UPDATED audit row when content changes", async () => {
      const { service, prisma, auditWriter } = makeService();
      const existing = {
        projectId: "p-1",
        projectName: "Old",
        description: "old desc",
        projectStatus: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.project.update.mockResolvedValue({ ...existing, projectName: "New" });

      await service.update("p-1", { projectName: "New" } as never, "admin-1");

      expect(prisma.project.update).toHaveBeenCalledWith({ where: { projectId: "p-1" }, data: { projectName: "New" } });
      expect(auditWriter.record).toHaveBeenCalledTimes(1);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PROJECT_UPDATED" }), prisma);
    });

    it("emits PROJECT_ACTIVATED/DEACTIVATED only when projectStatus actually changes, separate from content updates", async () => {
      const { service, prisma, auditWriter } = makeService();
      const existing = {
        projectId: "p-1",
        projectName: "Name",
        description: null,
        projectStatus: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.project.update.mockResolvedValue({ ...existing, projectStatus: "INACTIVE" });

      await service.update("p-1", { projectStatus: "INACTIVE" } as never, "admin-1");

      expect(auditWriter.record).toHaveBeenCalledTimes(1);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PROJECT_DEACTIVATED" }), prisma);
    });

    it("treats a status PATCH equal to the current value as a no-op — no status audit event, still succeeds", async () => {
      const { service, prisma, auditWriter } = makeService();
      const existing = {
        projectId: "p-1",
        projectName: "Name",
        description: null,
        projectStatus: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.project.findFirst.mockResolvedValue(existing);

      const result = await service.update("p-1", { projectStatus: "ACTIVE" } as never, "admin-1");

      expect(prisma.project.update).not.toHaveBeenCalled();
      expect(auditWriter.record).not.toHaveBeenCalled();
      expect(result.projectStatus).toBe("ACTIVE");
    });
  });

  describe("softDelete (API-PRJ-005)", () => {
    it("throws 404 for an absent or already-deleted project", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.softDelete("p-1", "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("sets deletedAt and records a PROJECT_SOFT_DELETED audit row in the same transaction", async () => {
      const { service, prisma, auditWriter } = makeService();
      const existing = { projectId: "p-1", projectName: "Name", description: null, projectStatus: "ACTIVE" };
      prisma.project.findFirst.mockResolvedValue(existing);
      prisma.project.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.softDelete("p-1", "admin-1");

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { projectId: "p-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PROJECT_SOFT_DELETED", result: "SUCCESS" }),
        prisma,
      );
    });
  });
});
