import { BusinessException } from "../../common/exceptions/business.exception";
import { TestAccountService } from "./test-account.service";

process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

function p2002() {
  return { code: "P2002" };
}

describe("TestAccountService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      environment: { findFirst: jest.Mock };
      authenticationConfiguration: { findUnique: jest.Mock };
      testAccount: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock; findFirst: jest.Mock };
      project: { findFirst: jest.Mock };
      $transaction: jest.Mock;
    } = {
      environment: { findFirst: jest.fn().mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "ACTIVE" }) },
      authenticationConfiguration: { findUnique: jest.fn().mockResolvedValue({ authType: "LOGIN_FORM" }) },
      testAccount: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new TestAccountService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  const ROW = {
    testAccountId: "ta-1",
    environmentId: "e-1",
    label: "QA lead",
    username: "qa.lead",
    passwordCiphertext: Buffer.from("ct"),
    passwordIv: Buffer.from("iv"),
    passwordAuthTag: Buffer.from("tag"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };

  describe("list", () => {
    it("returns Test Accounts ordered by label, never exposing the password", async () => {
      const { service, prisma } = makeService();
      prisma.testAccount.findMany.mockResolvedValue([ROW]);

      const result = await service.list("p-1", "e-1");

      expect(prisma.testAccount.findMany).toHaveBeenCalledWith({ where: { environmentId: "e-1" }, orderBy: { label: "asc" } });
      expect(result).toEqual([
        { testAccountId: "ta-1", environmentId: "e-1", label: "QA lead", username: "qa.lead", createdAt: ROW.createdAt, updatedAt: ROW.updatedAt },
      ]);
      expect(JSON.stringify(result)).not.toMatch(/password|ciphertext/i);
    });

    it("propagates 404 when the Environment does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue(null);

      await expect(service.list("p-1", "e-1")).rejects.toBeInstanceOf(BusinessException);
      expect(prisma.testAccount.findMany).not.toHaveBeenCalled();
    });

    it("rejects with 409 INVALID_STATE when the Environment's authType is not LOGIN_FORM", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "BEARER_TOKEN" });

      const error = await service.list("p-1", "e-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.testAccount.findMany).not.toHaveBeenCalled();
    });

    it("rejects with 409 INVALID_STATE when no Authentication Configuration exists yet", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);

      const error = await service.list("p-1", "e-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
    });
  });

  describe("create", () => {
    const DTO = { label: "QA lead", username: "qa.lead", password: "s3cret!" };

    it("encrypts the password, creates the row, and audits TEST_ACCOUNT_CREATED without ever including the password", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.testAccount.create.mockResolvedValue(ROW);

      const result = await service.create("p-1", "e-1", DTO as never, "user-1");

      const createArgs = prisma.testAccount.create.mock.calls[0][0].data;
      expect(createArgs).toMatchObject({ environmentId: "e-1", label: "QA lead", username: "qa.lead" });
      expect(createArgs).toHaveProperty("passwordCiphertext");
      expect(Buffer.from(createArgs.passwordCiphertext as Uint8Array).toString("utf8")).not.toContain("s3cret!");

      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "TEST_ACCOUNT_CREATED",
          actorUserId: "user-1",
          targetType: "TEST_ACCOUNT",
          targetId: "ta-1",
          afterData: { environmentId: "e-1", label: "QA lead", username: "qa.lead" },
        }),
        prisma,
      );
      expect(JSON.stringify(auditWriter.record.mock.calls[0][0])).not.toMatch(/s3cret!|ciphertext/i);
      expect(result).toEqual({
        testAccountId: "ta-1",
        environmentId: "e-1",
        label: "QA lead",
        username: "qa.lead",
        createdAt: ROW.createdAt,
        updatedAt: ROW.updatedAt,
      });
    });

    it("rejects with 409 INVALID_STATE when the Environment is not ACTIVE", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "INACTIVE" });

      const error = await service.create("p-1", "e-1", DTO as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.testAccount.create).not.toHaveBeenCalled();
    });

    it("rejects with 409 INVALID_STATE when authType is not LOGIN_FORM", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "NONE" });

      const error = await service.create("p-1", "e-1", DTO as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.testAccount.create).not.toHaveBeenCalled();
    });

    it("rejects with 409 TEST_ACCOUNT_LABEL_EXISTS on a unique-constraint violation", async () => {
      const { service, prisma } = makeService();
      prisma.testAccount.create.mockRejectedValue(p2002());

      const error = await service.create("p-1", "e-1", DTO as never, "user-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(409);
      expect((error as BusinessException).getResponse()).toMatchObject({ errorCode: "TEST_ACCOUNT_LABEL_EXISTS" });
    });

    it("rejects a soft-deleted or INACTIVE Project with the assertProjectActive error", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      const error = await service.create("p-1", "e-1", DTO as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.testAccount.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("renames label/username without touching the password when password is omitted", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.testAccount.findFirst.mockResolvedValue(ROW);
      prisma.testAccount.update.mockResolvedValue({ ...ROW, label: "QA lead 2", username: "qa.lead2" });

      const result = await service.update("p-1", "e-1", "ta-1", { label: "QA lead 2", username: "qa.lead2" } as never, "user-1");

      const updateArgs = prisma.testAccount.update.mock.calls[0][0].data;
      expect(updateArgs).toEqual({ label: "QA lead 2", username: "qa.lead2" });
      expect(result.label).toBe("QA lead 2");
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "TEST_ACCOUNT_UPDATED",
          beforeData: { label: "QA lead", username: "qa.lead" },
          afterData: { label: "QA lead 2", username: "qa.lead2" },
        }),
        prisma,
      );
    });

    it("rotates and encrypts the password when provided, leaving label/username untouched", async () => {
      const { service, prisma } = makeService();
      prisma.testAccount.findFirst.mockResolvedValue(ROW);
      prisma.testAccount.update.mockResolvedValue(ROW);

      await service.update("p-1", "e-1", "ta-1", { password: "new-secret" } as never, "user-1");

      const updateArgs = prisma.testAccount.update.mock.calls[0][0].data;
      expect(updateArgs).not.toHaveProperty("label");
      expect(updateArgs).not.toHaveProperty("username");
      expect(updateArgs).toHaveProperty("passwordCiphertext");
      expect(Buffer.from(updateArgs.passwordCiphertext as Uint8Array).toString("utf8")).not.toContain("new-secret");
    });

    it("rejects with 404 when the Test Account does not exist in this Environment", async () => {
      const { service, prisma } = makeService();
      prisma.testAccount.findFirst.mockResolvedValue(null);

      const error = await service.update("p-1", "e-1", "ta-missing", { label: "X" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.testAccount.update).not.toHaveBeenCalled();
    });

    it("rejects with 409 TEST_ACCOUNT_LABEL_EXISTS on a unique-constraint violation", async () => {
      const { service, prisma } = makeService();
      prisma.testAccount.findFirst.mockResolvedValue(ROW);
      prisma.testAccount.update.mockRejectedValue(p2002());

      const error = await service.update("p-1", "e-1", "ta-1", { label: "Taken" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getResponse()).toMatchObject({ errorCode: "TEST_ACCOUNT_LABEL_EXISTS" });
    });

    it("rejects with 409 INVALID_STATE when the Environment's authType is no longer LOGIN_FORM", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "BEARER_TOKEN" });

      const error = await service.update("p-1", "e-1", "ta-1", { label: "X" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.testAccount.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("deletes the row and audits TEST_ACCOUNT_REMOVED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.testAccount.findFirst.mockResolvedValue(ROW);

      await service.remove("p-1", "e-1", "ta-1", "user-1");

      expect(prisma.testAccount.delete).toHaveBeenCalledWith({ where: { testAccountId: "ta-1" } });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "TEST_ACCOUNT_REMOVED",
          targetId: "ta-1",
          beforeData: { environmentId: "e-1", label: "QA lead", username: "qa.lead" },
        }),
        prisma,
      );
    });

    it("rejects with 404 when the Test Account does not exist in this Environment", async () => {
      const { service, prisma } = makeService();
      prisma.testAccount.findFirst.mockResolvedValue(null);

      const error = await service.remove("p-1", "e-1", "ta-missing", "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
      expect(prisma.testAccount.delete).not.toHaveBeenCalled();
    });

    it("rejects with 409 INVALID_STATE when the Environment is not ACTIVE", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "INACTIVE" });

      const error = await service.remove("p-1", "e-1", "ta-1", "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.testAccount.delete).not.toHaveBeenCalled();
    });
  });
});
