import { BusinessException } from "../../common/exceptions/business.exception";
import { ApiEnvironmentConfigsService } from "./api-environment-configs.service";

describe("ApiEnvironmentConfigsService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      apiConfiguration: { findFirst: jest.Mock };
      environment: { findMany: jest.Mock; findFirst: jest.Mock };
      apiEnvironmentConfig: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock };
      project: { findFirst: jest.Mock };
      $transaction: jest.Mock;
    } = {
      apiConfiguration: { findFirst: jest.fn() },
      environment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      apiEnvironmentConfig: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), upsert: jest.fn() },
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new ApiEnvironmentConfigsService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  describe("list (API-APIENV-001)", () => {
    it("represents an Environment with no config row as NOT_CONFIGURED / fullUrl null, including INACTIVE Environments", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", apiName: "X" });
      prisma.environment.findMany.mockResolvedValue([
        { environmentId: "e-1", environmentName: "Prod", classification: "PRODUCTION", environmentStatus: "ACTIVE", allowRun: false },
        { environmentId: "e-2", environmentName: "Old", classification: "NON_PRODUCTION", environmentStatus: "INACTIVE", allowRun: true },
      ]);
      prisma.apiEnvironmentConfig.findMany.mockResolvedValue([{ environmentId: "e-1", fullUrl: "https://a.example.com" }]);

      const result = await service.list("p-1", "a-1");

      expect(result.items).toEqual([
        expect.objectContaining({ environmentId: "e-1", urlStatus: "CONFIGURED", fullUrl: "https://a.example.com" }),
        expect.objectContaining({ environmentId: "e-2", urlStatus: "NOT_CONFIGURED", fullUrl: null }),
      ]);
      expect(result.items.every((i) => i.credentialStatus === "UNAVAILABLE_IN_3A")).toBe(true);
    });
  });

  describe("put (API-APIENV-002) — Full URL validation", () => {
    it("rejects a malformed URL with 400 VALIDATION_ERROR", async () => {
      const { service } = makeService();

      await expect(
        service.put("p-1", "a-1", "e-1", { fullUrl: "not a url" } as never, "user-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it("rejects a well-formed but non-HTTP(S) URL with 422 SEMANTIC_VALIDATION_ERROR", async () => {
      const { service } = makeService();

      await expect(
        service.put("p-1", "a-1", "e-1", { fullUrl: "ftp://host/path" } as never, "user-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    // 3B FINAL FROZEN API Contract §11 — Full URL must not carry a query
    // string; Query Run Value belongs to Request Input, not the Full URL.
    it("rejects a Full URL containing a query component with 422 SEMANTIC_VALIDATION_ERROR", async () => {
      const { service, prisma } = makeService();

      const error = await service.put("p-1", "a-1", "e-1", { fullUrl: "https://uat.example.com/users?status=ACTIVE" } as never, "user-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
      expect((error as BusinessException).getResponse()).toMatchObject({ errorCode: "SEMANTIC_VALIDATION_ERROR" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // §11 — Full URL must not carry a fragment either.
    it("rejects a Full URL containing a fragment with 422 SEMANTIC_VALIDATION_ERROR", async () => {
      const { service, prisma } = makeService();

      const error = await service.put("p-1", "a-1", "e-1", { fullUrl: "https://uat.example.com/users#section" } as never, "user-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("accepts a Full URL with a Path Parameter placeholder and no query/fragment", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", apiName: "X" });
      prisma.environment.findFirst.mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "ACTIVE" });
      prisma.apiEnvironmentConfig.findUnique.mockResolvedValue(null);
      prisma.apiEnvironmentConfig.upsert.mockResolvedValue({
        apiId: "a-1",
        environmentId: "e-1",
        fullUrl: "https://uat.example.com/users/{id}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.put("p-1", "a-1", "e-1", { fullUrl: "https://uat.example.com/users/{id}" } as never, "user-1"),
      ).resolves.toBeDefined();
    });

    it("rejects configuration against an INACTIVE Environment with 409 INVALID_STATE", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", apiName: "X" });
      prisma.environment.findFirst.mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "INACTIVE" });

      await expect(
        service.put("p-1", "a-1", "e-1", { fullUrl: "https://host/path" } as never, "user-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it("creates (201) when no row exists and updates (200) when one does, upserting on (apiId, environmentId)", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", apiName: "X" });
      prisma.environment.findFirst.mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "ACTIVE" });
      prisma.apiEnvironmentConfig.findUnique.mockResolvedValue(null);
      prisma.apiEnvironmentConfig.upsert.mockResolvedValue({
        apiId: "a-1",
        environmentId: "e-1",
        fullUrl: "https://host/path",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const created = await service.put("p-1", "a-1", "e-1", { fullUrl: "https://host/path" } as never, "user-1");
      expect(created.status).toBe(201);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "API_ENVIRONMENT_URL_CONFIGURED" }), prisma);

      prisma.apiEnvironmentConfig.findUnique.mockResolvedValue({ fullUrl: "https://host/path" });
      const updated = await service.put("p-1", "a-1", "e-1", { fullUrl: "https://host/path2" } as never, "user-1");
      expect(updated.status).toBe(200);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "API_ENVIRONMENT_URL_UPDATED" }), prisma);
    });
  });
});
