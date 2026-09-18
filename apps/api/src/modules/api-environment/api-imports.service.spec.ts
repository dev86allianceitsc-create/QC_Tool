import { ApiImportsService } from "./api-imports.service";

describe("ApiImportsService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      project: { findFirst: jest.Mock };
      apiConfiguration: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
      requestParameterDefinition: { createMany: jest.Mock };
      requestBodyDefinition: { create: jest.Mock };
      $transaction: jest.Mock;
    } = {
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      apiConfiguration: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      requestParameterDefinition: { createMany: jest.fn() },
      requestBodyDefinition: { create: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new ApiImportsService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  function file(spec: unknown) {
    return { buffer: Buffer.from(JSON.stringify(spec)) } as never;
  }

  describe("preview (API-API-006)", () => {
    it("classifies a candidate with an unsupported HTTP Method as INVALID, with a reason", async () => {
      const { service } = makeService();
      const spec = { openapi: "3.0.0", paths: { "/x": { trace: {} } } };

      const result = await service.preview("p-1", file(spec));

      expect(result.items).toEqual([
        expect.objectContaining({ httpMethod: "TRACE", path: "/x", status: "INVALID", reason: expect.stringContaining("Unsupported HTTP Method") }),
      ]);
    });

    it("classifies a candidate colliding with an active API as DUPLICATE", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findMany.mockResolvedValue([{ httpMethod: "GET", path: "/x" }]);
      const spec = { openapi: "3.0.0", paths: { "/x": { get: {} } } };

      const result = await service.preview("p-1", file(spec));

      expect(result.items).toEqual([expect.objectContaining({ httpMethod: "GET", path: "/x", status: "DUPLICATE" })]);
    });

    it("classifies a well-formed, non-duplicate, supported-method candidate as VALID", async () => {
      const { service } = makeService();
      const spec = { openapi: "3.0.0", paths: { "/x": { post: { summary: "Create X" } } } };

      const result = await service.preview("p-1", file(spec));

      expect(result.items).toEqual([expect.objectContaining({ httpMethod: "POST", path: "/x", status: "VALID", suggestedApiName: "Create X" })]);
    });

    it("propagates UNSUPPORTED_REQUEST_BODY_MEDIA_TYPE warnings without affecting VALID status", async () => {
      const { service } = makeService();
      const spec = { openapi: "3.0.0", paths: { "/x": { post: { requestBody: { content: { "multipart/form-data": {} } } } } } };

      const result = await service.preview("p-1", file(spec));

      expect(result.items).toEqual([
        expect.objectContaining({
          status: "VALID",
          warnings: [{ code: "UNSUPPORTED_REQUEST_BODY_MEDIA_TYPE", detail: "multipart/form-data is not supported in the current MVP." }],
        }),
      ]);
    });

    // Finding 2 — a duplicate/reserved parameter is surfaced as a warning
    // while candidate status stays VALID (no new status is introduced).
    it("surfaces duplicate-parameter and reserved-header warnings at preview time without affecting VALID status", async () => {
      const { service } = makeService();
      const spec = {
        openapi: "3.0.0",
        paths: {
          "/x": {
            get: {
              parameters: [
                { name: "status", in: "query", required: true },
                { name: "status", in: "query", required: false },
                { name: "Authorization", in: "header", required: true },
              ],
            },
          },
        },
      };

      const result = await service.preview("p-1", file(spec));

      expect(result.items).toEqual([
        expect.objectContaining({
          status: "VALID",
          warnings: expect.arrayContaining([
            { code: "DUPLICATE_QUERY_PARAMETER_IGNORED", detail: "Duplicate QUERY parameter 'status' was ignored; only the first occurrence was imported." },
            { code: "RESERVED_HEADER_PARAMETER_IGNORED", detail: "Header 'Authorization' is reserved and was not imported as a normal Header parameter." },
          ]),
        }),
      ]);
    });

    it("never persists anything during preview", async () => {
      const { service, prisma } = makeService();
      const spec = { openapi: "3.0.0", paths: { "/x": { post: {} } } };

      await service.preview("p-1", file(spec));

      expect(prisma.apiConfiguration.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("confirmImport (API-API-007)", () => {
    it("fails a selected candidate not present in the reparsed specification", async () => {
      const { service } = makeService();
      const spec = { openapi: "3.0.0", paths: { "/x": { get: {} } } };

      const result = await service.confirmImport("p-1", file(spec), { selectedCandidates: [{ httpMethod: "POST", path: "/y" }] } as never, "admin-1");

      expect(result.results).toEqual([expect.objectContaining({ result: "FAILED", reason: expect.stringContaining("not found") })]);
      expect(result.summary).toEqual({ imported: 0, skipped: 0, failed: 1 });
    });

    it("fails a selected candidate whose Method is unsupported, without opening a transaction", async () => {
      const { service, prisma } = makeService();
      const spec = { openapi: "3.0.0", paths: { "/x": { trace: {} } } };

      const result = await service.confirmImport("p-1", file(spec), { selectedCandidates: [{ httpMethod: "TRACE", path: "/x" }] } as never, "admin-1");

      expect(result.results).toEqual([expect.objectContaining({ result: "FAILED", reason: expect.stringContaining("Unsupported HTTP Method") })]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("skips a selected candidate that collides with an active API inside the transaction", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.findFirst.mockResolvedValue({ apiId: "existing" });
      const spec = { openapi: "3.0.0", paths: { "/x": { get: {} } } };

      const result = await service.confirmImport("p-1", file(spec), { selectedCandidates: [{ httpMethod: "GET", path: "/x" }] } as never, "admin-1");

      expect(result.results).toEqual([expect.objectContaining({ result: "SKIPPED" })]);
      expect(prisma.apiConfiguration.create).not.toHaveBeenCalled();
    });

    it("imports a candidate, creating the API atomically with its Query/Header parameters and Body Definition, and audits API_IMPORTED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.apiConfiguration.create.mockResolvedValue({ apiId: "a-1", apiName: "Create X", httpMethod: "POST", path: "/x", creationSource: "OPENAPI_IMPORT" });
      const spec = {
        openapi: "3.0.0",
        paths: {
          "/x": {
            post: {
              summary: "Create X",
              parameters: [
                { name: "status", in: "query", required: true },
                { name: "X-Trace-Id", in: "header", required: false },
                { name: "Authorization", in: "header", required: true },
              ],
              requestBody: { content: { "application/json": {} } },
            },
          },
        },
      };

      const result = await service.confirmImport("p-1", file(spec), { selectedCandidates: [{ httpMethod: "POST", path: "/x" }] } as never, "admin-1");

      expect(prisma.apiConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ apiName: "Create X", httpMethod: "POST", path: "/x", creationSource: "OPENAPI_IMPORT" }),
      });
      expect(prisma.requestParameterDefinition.createMany).toHaveBeenCalledWith({
        data: [
          { apiId: "a-1", location: "QUERY", parameterName: "status", isRequired: true },
          { apiId: "a-1", location: "HEADER", parameterName: "X-Trace-Id", isRequired: false },
        ],
      });
      expect(prisma.requestBodyDefinition.create).toHaveBeenCalledWith({ data: { apiId: "a-1", bodyType: "JSON" } });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "API_IMPORTED", afterData: expect.objectContaining({ requestInputCounts: { query: 1, header: 1, body: 1 } }) }),
        prisma,
      );
      expect(result.results).toEqual([expect.objectContaining({ result: "IMPORTED", apiId: "a-1" })]);
      expect(result.summary).toEqual({ imported: 1, skipped: 0, failed: 0 });
    });

    // Finding 2 — duplicate Query/Header and reserved-header entries must
    // not be persisted, even though the candidate still IMPORTS
    // successfully; the ignored entries surface only as warnings.
    it("does not persist a duplicate QUERY parameter, a duplicate HEADER (case-insensitive), or a reserved Header, and reports warnings on the IMPORTED result", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.create.mockResolvedValue({ apiId: "a-1", apiName: "GET /x", httpMethod: "GET", path: "/x", creationSource: "OPENAPI_IMPORT" });
      const spec = {
        openapi: "3.0.0",
        paths: {
          "/x": {
            get: {
              parameters: [
                { name: "status", in: "query", required: true },
                { name: "status", in: "query", required: false },
                { name: "X-Trace-Id", in: "header", required: true },
                { name: "x-trace-id", in: "header", required: false },
                { name: "Content-Type", in: "header", required: false },
              ],
            },
          },
        },
      };

      const result = await service.confirmImport("p-1", file(spec), { selectedCandidates: [{ httpMethod: "GET", path: "/x" }] } as never, "admin-1");

      expect(prisma.requestParameterDefinition.createMany).toHaveBeenCalledWith({
        data: [
          { apiId: "a-1", location: "QUERY", parameterName: "status", isRequired: true },
          { apiId: "a-1", location: "HEADER", parameterName: "X-Trace-Id", isRequired: true },
        ],
      });
      expect(result.results).toEqual([
        expect.objectContaining({
          result: "IMPORTED",
          warnings: expect.arrayContaining([
            { code: "DUPLICATE_QUERY_PARAMETER_IGNORED", detail: "Duplicate QUERY parameter 'status' was ignored; only the first occurrence was imported." },
            { code: "DUPLICATE_HEADER_PARAMETER_IGNORED", detail: "Duplicate HEADER parameter 'x-trace-id' was ignored; only the first occurrence was imported." },
            { code: "RESERVED_HEADER_PARAMETER_IGNORED", detail: "Header 'Content-Type' is reserved and was not imported as a normal Header parameter." },
          ]),
        }),
      ]);
      expect(result.summary).toEqual({ imported: 1, skipped: 0, failed: 0 });
    });

    it("does not persist Request Input rows when the candidate has no parameters or body", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.create.mockResolvedValue({ apiId: "a-1", apiName: "GET /x", httpMethod: "GET", path: "/x", creationSource: "OPENAPI_IMPORT" });
      const spec = { openapi: "3.0.0", paths: { "/x": { get: {} } } };

      await service.confirmImport("p-1", file(spec), { selectedCandidates: [{ httpMethod: "GET", path: "/x" }] } as never, "admin-1");

      expect(prisma.requestParameterDefinition.createMany).not.toHaveBeenCalled();
      expect(prisma.requestBodyDefinition.create).not.toHaveBeenCalled();
    });

    it("maps a P2002 race on create to SKIPPED, not FAILED", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.create.mockRejectedValue({ code: "P2002" });
      const spec = { openapi: "3.0.0", paths: { "/x": { get: {} } } };

      const result = await service.confirmImport("p-1", file(spec), { selectedCandidates: [{ httpMethod: "GET", path: "/x" }] } as never, "admin-1");

      expect(result.results).toEqual([expect.objectContaining({ result: "SKIPPED" })]);
      expect(result.summary).toEqual({ imported: 0, skipped: 1, failed: 0 });
    });

    it("evaluates each candidate independently — one FAILED entry does not roll back a successful IMPORTED entry", async () => {
      const { service, prisma } = makeService();
      prisma.apiConfiguration.create.mockResolvedValue({ apiId: "a-1", apiName: "GET /x", httpMethod: "GET", path: "/x", creationSource: "OPENAPI_IMPORT" });
      const spec = { openapi: "3.0.0", paths: { "/x": { get: {} } } };

      const result = await service.confirmImport(
        "p-1",
        file(spec),
        { selectedCandidates: [{ httpMethod: "GET", path: "/x" }, { httpMethod: "POST", path: "/missing" }] } as never,
        "admin-1",
      );

      expect(result.summary).toEqual({ imported: 1, skipped: 0, failed: 1 });
      expect(result.results).toEqual([
        expect.objectContaining({ httpMethod: "GET", path: "/x", result: "IMPORTED" }),
        expect.objectContaining({ httpMethod: "POST", path: "/missing", result: "FAILED" }),
      ]);
    });
  });
});
