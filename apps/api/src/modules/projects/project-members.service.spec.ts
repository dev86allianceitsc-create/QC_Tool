import { Prisma } from "@prisma/client";
import { BusinessException } from "../../common/exceptions/business.exception";
import { ProjectMembersService } from "./project-members.service";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("ProjectMembersService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      project: { findFirst: jest.Mock };
      user: { findUnique: jest.Mock; create: jest.Mock };
      projectMembership: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; delete: jest.Mock };
      $transaction: jest.Mock;
    } = {
      project: { findFirst: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn() },
      projectMembership: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new ProjectMembersService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  describe("list (API-PRJ-006)", () => {
    it("throws 404 for an absent/soft-deleted project", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.list("p-1", {} as never)).rejects.toBeInstanceOf(BusinessException);
    });

    it("returns the mapped member list for an existing project", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1" });
      prisma.projectMembership.findMany.mockResolvedValue([
        { user: { userId: "u-1", email: "a@example.com", systemRole: "USER", accountStatus: "ACTIVE" } },
      ]);
      prisma.projectMembership.count.mockResolvedValue(1);

      const result = await service.list("p-1", {} as never);

      expect(result.items).toEqual([{ userId: "u-1", email: "a@example.com", systemRole: "USER", accountStatus: "ACTIVE" }]);
    });
  });

  describe("addMember (API-PRJ-007)", () => {
    it("rejects an invalid email format with 400 VALIDATION_ERROR", async () => {
      const { service } = makeService();

      await expect(service.addMember("p-1", { email: "not-an-email" } as never, "admin-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
    });

    it("throws 404 when the project does not exist or is soft-deleted", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.addMember("p-1", { email: "user@example.com" } as never, "admin-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
    });

    it("resolve-or-create: creates a new INVITED user when none exists by email, then creates the membership atomically", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1" });
      prisma.user.findUnique.mockResolvedValue(null);
      const createdUser = { userId: "u-new", email: "new@example.com", systemRole: "USER", accountStatus: "INVITED" };
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.projectMembership.findUnique.mockResolvedValue(null);

      const result = await service.addMember("p-1", { email: "new@example.com" } as never, "admin-1");

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: "new@example.com", systemRole: "USER", accountStatus: "INVITED" },
      });
      expect(prisma.projectMembership.create).toHaveBeenCalledWith({ data: { userId: "u-new", projectId: "p-1" } });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PROJECT_MEMBER_ADDED", result: "SUCCESS" }),
        prisma,
      );
      expect(result.userId).toBe("u-new");
    });

    it("rejects an existing but INACTIVE/BLOCKED target user with 422 MEMBER_NOT_ELIGIBLE", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1" });
      prisma.user.findUnique.mockResolvedValue({ userId: "u-1", email: "x@example.com", accountStatus: "BLOCKED" });

      await expect(service.addMember("p-1", { email: "x@example.com" } as never, "admin-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
      expect(prisma.projectMembership.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate membership (pre-check) with 409 CONFLICT", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1" });
      prisma.user.findUnique.mockResolvedValue({ userId: "u-1", email: "x@example.com", accountStatus: "ACTIVE" });
      prisma.projectMembership.findUnique.mockResolvedValue({ userId: "u-1", projectId: "p-1" });

      await expect(service.addMember("p-1", { email: "x@example.com" } as never, "admin-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
      expect(prisma.projectMembership.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent P2002 unique-violation into the same 409 CONFLICT as the pre-check", async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValue(p2002());

      const err = await service.addMember("p-1", { email: "race@example.com" } as never, "admin-1").catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "CONFLICT" });
    });
  });

  describe("removeMember (API-PRJ-008)", () => {
    it("throws 404 for an absent/soft-deleted project", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.removeMember("p-1", "u-1", "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("throws 404 when the membership does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1" });
      prisma.projectMembership.findUnique.mockResolvedValue(null);

      await expect(service.removeMember("p-1", "u-1", "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("hard-deletes only the membership row and records PROJECT_MEMBER_REMOVED, without touching the user record", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1" });
      prisma.projectMembership.findUnique.mockResolvedValue({ userId: "u-1", projectId: "p-1", user: { email: "x@example.com" } });

      await service.removeMember("p-1", "u-1", "admin-1");

      expect(prisma.projectMembership.delete).toHaveBeenCalledWith({ where: { userId_projectId: { userId: "u-1", projectId: "p-1" } } });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PROJECT_MEMBER_REMOVED", result: "SUCCESS" }),
        prisma,
      );
    });
  });
});
