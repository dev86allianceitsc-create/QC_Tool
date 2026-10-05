import { BusinessException } from "../../common/exceptions/business.exception";
import { EnvironmentsService } from "./environments.service";

describe("EnvironmentsService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      project: { findFirst: jest.Mock };
      environment: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
      $transaction: jest.Mock;
    } = {
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      environment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new EnvironmentsService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  describe("create (API-ENV-002) — Allow Run defaults", () => {
    it("defaults allowRun=true for a NON_PRODUCTION environment", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue(null);
      prisma.environment.create.mockResolvedValue({ environmentId: "e-1", environmentStatus: "ACTIVE" });

      await service.create("p-1", { environmentName: "Staging", classification: "NON_PRODUCTION" } as never, "admin-1");

      expect(prisma.environment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ classification: "NON_PRODUCTION", allowRun: true, environmentStatus: "ACTIVE" }),
      });
    });

    it("defaults allowRun=false for a PRODUCTION environment", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue(null);
      prisma.environment.create.mockResolvedValue({ environmentId: "e-1", environmentStatus: "ACTIVE" });

      await service.create("p-1", { environmentName: "Prod", classification: "PRODUCTION" } as never, "admin-1");

      expect(prisma.environment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ classification: "PRODUCTION", allowRun: false }),
      });
    });

    it("rejects a case-insensitive duplicate name within the project with 409", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue({ environmentId: "e-existing" });

      await expect(
        service.create("p-1", { environmentName: "staging", classification: "NON_PRODUCTION" } as never, "admin-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe("create — baseUrl (Phase 1 domain binding)", () => {
    it("stores a trimmed, validated baseUrl when provided", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue(null);
      prisma.environment.create.mockResolvedValue({ environmentId: "e-1", environmentStatus: "ACTIVE", baseUrl: "https://api.example.com" });

      await service.create(
        "p-1",
        { environmentName: "Staging", classification: "NON_PRODUCTION", baseUrl: "  https://api.example.com  " } as never,
        "admin-1",
      );

      expect(prisma.environment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ baseUrl: "https://api.example.com" }),
      });
    });

    it("stores null when baseUrl is omitted", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue(null);
      prisma.environment.create.mockResolvedValue({ environmentId: "e-1", environmentStatus: "ACTIVE", baseUrl: null });

      await service.create("p-1", { environmentName: "Staging", classification: "NON_PRODUCTION" } as never, "admin-1");

      expect(prisma.environment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ baseUrl: null }),
      });
    });

    it("rejects a baseUrl containing a path", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          "p-1",
          { environmentName: "Staging", classification: "NON_PRODUCTION", baseUrl: "https://api.example.com/widgets" } as never,
          "admin-1",
        ),
      ).rejects.toBeInstanceOf(BusinessException);
      expect(prisma.environment.create).not.toHaveBeenCalled();
    });
  });

  describe("update (API-ENV-004) — Allow Run transition rules", () => {
    it("forces allowRun=false on NON_PRODUCTION -> PRODUCTION regardless of a submitted allowRun=true", async () => {
      const { service, prisma } = makeService();
      const existing = {
        environmentId: "e-1",
        environmentName: "Env",
        classification: "NON_PRODUCTION",
        allowRun: true,
        environmentStatus: "ACTIVE",
      };
      prisma.environment.findFirst.mockResolvedValue(existing);
      prisma.environment.update.mockResolvedValue({ ...existing, classification: "PRODUCTION", allowRun: false });

      await service.update("p-1", "e-1", { classification: "PRODUCTION", allowRun: true } as never, "admin-1");

      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: { environmentId: "e-1" },
        data: expect.objectContaining({ classification: "PRODUCTION", allowRun: false }),
      });
    });

    it("preserves existing allowRun on PRODUCTION -> NON_PRODUCTION when allowRun is omitted (no auto-enable)", async () => {
      const { service, prisma } = makeService();
      const existing = {
        environmentId: "e-1",
        environmentName: "Env",
        classification: "PRODUCTION",
        allowRun: false,
        environmentStatus: "ACTIVE",
      };
      prisma.environment.findFirst.mockResolvedValue(existing);
      prisma.environment.update.mockResolvedValue({ ...existing, classification: "NON_PRODUCTION" });

      await service.update("p-1", "e-1", { classification: "NON_PRODUCTION" } as never, "admin-1");

      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: { environmentId: "e-1" },
        data: expect.objectContaining({ classification: "NON_PRODUCTION" }),
      });
      const data = prisma.environment.update.mock.calls[0][0].data;
      expect(data.allowRun).toBeUndefined();
    });

    it("honors an explicit allowRun submitted alongside PRODUCTION -> NON_PRODUCTION", async () => {
      const { service, prisma } = makeService();
      const existing = {
        environmentId: "e-1",
        environmentName: "Env",
        classification: "PRODUCTION",
        allowRun: false,
        environmentStatus: "ACTIVE",
      };
      prisma.environment.findFirst.mockResolvedValue(existing);
      prisma.environment.update.mockResolvedValue({ ...existing, classification: "NON_PRODUCTION", allowRun: true });

      await service.update("p-1", "e-1", { classification: "NON_PRODUCTION", allowRun: true } as never, "admin-1");

      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: { environmentId: "e-1" },
        data: expect.objectContaining({ allowRun: true }),
      });
    });

    it("rejects any mutation other than reactivation while the environment is INACTIVE", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue({
        environmentId: "e-1",
        environmentName: "Env",
        classification: "NON_PRODUCTION",
        allowRun: true,
        environmentStatus: "INACTIVE",
      });

      await expect(service.update("p-1", "e-1", { environmentName: "New" } as never, "admin-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
    });

    it("allows reactivation alone (environmentStatus=ACTIVE, no other fields) while INACTIVE, preserving allowRun", async () => {
      const { service, prisma } = makeService();
      const existing = {
        environmentId: "e-1",
        environmentName: "Env",
        classification: "PRODUCTION",
        allowRun: false,
        environmentStatus: "INACTIVE",
      };
      prisma.environment.findFirst.mockResolvedValue(existing);
      prisma.environment.update.mockResolvedValue({ ...existing, environmentStatus: "ACTIVE" });

      await service.update("p-1", "e-1", { environmentStatus: "ACTIVE" } as never, "admin-1");

      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: { environmentId: "e-1" },
        data: { environmentStatus: "ACTIVE" },
      });
    });

    it("rejects an empty patch with 400 VALIDATION_ERROR", async () => {
      const { service } = makeService();

      await expect(service.update("p-1", "e-1", {} as never, "admin-1")).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe("update — baseUrl (Phase 1 domain binding)", () => {
    it("sets a trimmed, validated baseUrl and records before/after in the audit row", async () => {
      const { service, prisma, auditWriter } = makeService();
      const existing = {
        environmentId: "e-1",
        environmentName: "Env",
        classification: "NON_PRODUCTION",
        allowRun: true,
        environmentStatus: "ACTIVE",
        baseUrl: null,
      };
      prisma.environment.findFirst.mockResolvedValue(existing);
      prisma.environment.update.mockResolvedValue({ ...existing, baseUrl: "https://api.example.com" });

      await service.update("p-1", "e-1", { baseUrl: "  https://api.example.com  " } as never, "admin-1");

      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: { environmentId: "e-1" },
        data: { baseUrl: "https://api.example.com" },
      });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ENVIRONMENT_UPDATED",
          beforeData: { baseUrl: null },
          afterData: { baseUrl: "https://api.example.com" },
        }),
        prisma,
      );
    });

    it("clears an existing baseUrl to null when the empty string is submitted", async () => {
      const { service, prisma } = makeService();
      const existing = {
        environmentId: "e-1",
        environmentName: "Env",
        classification: "NON_PRODUCTION",
        allowRun: true,
        environmentStatus: "ACTIVE",
        baseUrl: "https://api.example.com",
      };
      prisma.environment.findFirst.mockResolvedValue(existing);
      prisma.environment.update.mockResolvedValue({ ...existing, baseUrl: null });

      await service.update("p-1", "e-1", { baseUrl: "" } as never, "admin-1");

      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: { environmentId: "e-1" },
        data: { baseUrl: null },
      });
    });

    it("rejects a baseUrl with a query component, leaving the environment unchanged", async () => {
      const { service, prisma } = makeService();
      const existing = {
        environmentId: "e-1",
        environmentName: "Env",
        classification: "NON_PRODUCTION",
        allowRun: true,
        environmentStatus: "ACTIVE",
        baseUrl: null,
      };
      prisma.environment.findFirst.mockResolvedValue(existing);

      await expect(
        service.update("p-1", "e-1", { baseUrl: "https://api.example.com?x=1" } as never, "admin-1"),
      ).rejects.toBeInstanceOf(BusinessException);
      expect(prisma.environment.update).not.toHaveBeenCalled();
    });

    it("rejects any baseUrl change while INACTIVE (not part of pure reactivation)", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue({
        environmentId: "e-1",
        environmentName: "Env",
        classification: "NON_PRODUCTION",
        allowRun: true,
        environmentStatus: "INACTIVE",
        baseUrl: null,
      });

      await expect(
        service.update("p-1", "e-1", { baseUrl: "https://api.example.com" } as never, "admin-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });
  });
});
