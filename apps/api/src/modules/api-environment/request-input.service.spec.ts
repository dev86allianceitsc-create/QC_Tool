import { BusinessException } from "../../common/exceptions/business.exception";
import { RequestInputService } from "./request-input.service";

describe("RequestInputService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      project: { findFirst: jest.Mock };
      apiConfiguration: { findFirst: jest.Mock };
      requestParameterDefinition: { findMany: jest.Mock; deleteMany: jest.Mock; createMany: jest.Mock };
      requestBodyDefinition: { findFirst: jest.Mock; deleteMany: jest.Mock; upsert: jest.Mock };
      $transaction: jest.Mock;
    } = {
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      apiConfiguration: { findFirst: jest.fn() },
      requestParameterDefinition: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany: jest.fn() },
      requestBodyDefinition: { findFirst: jest.fn().mockResolvedValue(null), deleteMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new RequestInputService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  describe("get (API-INP-001)", () => {
    it("throws 404 for an absent or deleted API", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);

      await expect(service.get("p-1", "a-1")).rejects.toBeInstanceOf(BusinessException);
    });

    it("returns derived Path Parameters plus persisted Query/Header/Body definitions", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", httpMethod: "GET", path: "/users/{id}/orders/{orderId}" });
      prisma.requestParameterDefinition.findMany.mockResolvedValue([
        { location: "QUERY", parameterName: "status", isRequired: true },
        { location: "HEADER", parameterName: "X-Trace-Id", isRequired: false },
      ]);
      prisma.requestBodyDefinition.findFirst.mockResolvedValue({ bodyType: "JSON" });

      const result = await service.get("p-1", "a-1");

      expect(result.pathParameters).toEqual([
        { name: "id", required: true, source: "AUTO_DETECTED" },
        { name: "orderId", required: true, source: "AUTO_DETECTED" },
      ]);
      expect(result.queryParameters).toEqual([{ name: "status", required: true }]);
      expect(result.headerParameters).toEqual([{ name: "X-Trace-Id", required: false }]);
      expect(result.requestBody).toEqual({ bodyType: "JSON" });
    });

    it("returns empty arrays and null Body Definition when nothing is configured", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", httpMethod: "GET", path: "/x" });

      const result = await service.get("p-1", "a-1");

      expect(result.queryParameters).toEqual([]);
      expect(result.headerParameters).toEqual([]);
      expect(result.requestBody).toBeNull();
      expect(result.pathParameters).toEqual([]);
    });
  });

  describe("replace (API-INP-002) — validation", () => {
    it("rejects a duplicate QUERY parameter name (case-sensitive) with 422 SEMANTIC_VALIDATION_ERROR", async () => {
      const { service, prisma } = makeService();

      const error = await service
        .replace("p-1", "a-1", { queryParameters: [{ name: "status", required: true }, { name: "status", required: false }], headerParameters: [], requestBody: null } as never, "user-1")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
      expect((error as BusinessException).getResponse()).toMatchObject({ errorCode: "SEMANTIC_VALIDATION_ERROR" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a duplicate HEADER parameter name that differs only by case with 422", async () => {
      const { service, prisma } = makeService();

      const error = await service
        .replace("p-1", "a-1", { queryParameters: [], headerParameters: [{ name: "X-Trace-Id", required: false }, { name: "x-trace-id", required: true }], requestBody: null } as never, "user-1")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(["Authorization", "authorization", "Content-Type", "content-type"])(
      "rejects reserved Header name '%s' with 422 SEMANTIC_VALIDATION_ERROR",
      async (name) => {
        const { service, prisma } = makeService();

        const error = await service
          .replace("p-1", "a-1", { queryParameters: [], headerParameters: [{ name, required: false }], requestBody: null } as never, "user-1")
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getStatus()).toBe(422);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it("rejects a QUERY parameter name containing disallowed characters with 422", async () => {
      const { service, prisma } = makeService();

      const error = await service
        .replace("p-1", "a-1", { queryParameters: [{ name: "bad name", required: false }], headerParameters: [], requestBody: null } as never, "user-1")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws 404 for an absent or deleted API inside the transaction", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue(null);

      await expect(
        service.replace("p-1", "a-1", { queryParameters: [], headerParameters: [], requestBody: null } as never, "user-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it("throws 409 INVALID_STATE when the Project is not ACTIVE", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue({ projectId: "p-1", projectStatus: "INACTIVE", deletedAt: null });

      await expect(
        service.replace("p-1", "a-1", { queryParameters: [], headerParameters: [], requestBody: null } as never, "user-1"),
      ).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe("replace (API-INP-002) — atomic replacement behavior", () => {
    it("deletes all existing parameters and recreates the full desired set, upserts the Body Definition, and audits before/after", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", httpMethod: "POST", path: "/x" });
      prisma.requestParameterDefinition.findMany
        .mockResolvedValueOnce([{ location: "QUERY", parameterName: "old", isRequired: true }])
        .mockResolvedValueOnce([
          { location: "QUERY", parameterName: "status", isRequired: true },
          { location: "HEADER", parameterName: "X-Trace-Id", isRequired: false },
        ]);
      prisma.requestBodyDefinition.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ bodyType: "JSON" });

      const result = await service.replace(
        "p-1",
        "a-1",
        { queryParameters: [{ name: "status", required: true }], headerParameters: [{ name: "X-Trace-Id", required: false }], requestBody: { bodyType: "JSON" } } as never,
        "user-1",
      );

      expect(prisma.requestParameterDefinition.deleteMany).toHaveBeenCalledWith({ where: { apiId: "a-1" } });
      expect(prisma.requestParameterDefinition.createMany).toHaveBeenCalledWith({
        data: [
          { apiId: "a-1", location: "QUERY", parameterName: "status", isRequired: true },
          { apiId: "a-1", location: "HEADER", parameterName: "X-Trace-Id", isRequired: false },
        ],
      });
      expect(prisma.requestBodyDefinition.upsert).toHaveBeenCalledWith({
        where: { apiId: "a-1" },
        create: { apiId: "a-1", bodyType: "JSON" },
        update: { bodyType: "JSON" },
      });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "REQUEST_INPUT_REPLACED",
          beforeData: expect.objectContaining({ queryParameters: [{ name: "old", required: true }] }),
          afterData: expect.objectContaining({ queryParameters: [{ name: "status", required: true }] }),
        }),
        prisma,
      );
      expect(result.queryParameters).toEqual([{ name: "status", required: true }]);
      expect(result.requestBody).toEqual({ bodyType: "JSON" });
    });

    it("removes the Body Definition when requestBody is null", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", httpMethod: "GET", path: "/x" });

      await service.replace("p-1", "a-1", { queryParameters: [], headerParameters: [], requestBody: null } as never, "user-1");

      expect(prisma.requestBodyDefinition.deleteMany).toHaveBeenCalledWith({ where: { apiId: "a-1" } });
      expect(prisma.requestBodyDefinition.upsert).not.toHaveBeenCalled();
    });

    it("clears all parameters when both arrays are empty, without calling createMany", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", httpMethod: "GET", path: "/x" });

      await service.replace("p-1", "a-1", { queryParameters: [], headerParameters: [], requestBody: null } as never, "user-1");

      expect(prisma.requestParameterDefinition.deleteMany).toHaveBeenCalledWith({ where: { apiId: "a-1" } });
      expect(prisma.requestParameterDefinition.createMany).not.toHaveBeenCalled();
    });

    it("maps a P2002 unique-constraint race to 409 CONFLICT", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "a-1", httpMethod: "GET", path: "/x" });
      prisma.requestParameterDefinition.createMany.mockRejectedValue({ code: "P2002" });

      const error = await service
        .replace("p-1", "a-1", { queryParameters: [{ name: "status", required: true }], headerParameters: [], requestBody: null } as never, "user-1")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(409);
    });
  });
});
