import { BusinessException } from "../../common/exceptions/business.exception";
import { candidateKey, extractCandidates, parseOpenApiFile } from "./openapi-import.util";

describe("openapi-import.util", () => {
  describe("parseOpenApiFile", () => {
    it("parses a JSON OpenAPI 3.x document and detects its version", () => {
      const buffer = Buffer.from(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: {} } } }));

      const result = parseOpenApiFile(buffer);

      expect(result.format).toBe("JSON");
      expect(result.detectedVersion).toBe("3.0.0");
    });

    it("parses a YAML Swagger 2.0 document and detects its version", () => {
      const buffer = Buffer.from("swagger: '2.0'\npaths:\n  /x:\n    get: {}\n");

      const result = parseOpenApiFile(buffer);

      expect(result.format).toBe("YAML");
      expect(result.detectedVersion).toBe("2.0");
    });

    it("throws 422 OPENAPI_PARSE_ERROR for content that is neither valid JSON nor YAML-with-paths", () => {
      const buffer = Buffer.from("not: [valid, yaml, or, json:::");

      expect(() => parseOpenApiFile(buffer)).toThrow(BusinessException);
    });

    it("throws 422 OPENAPI_PARSE_ERROR when a well-formed document lacks a paths object", () => {
      const buffer = Buffer.from(JSON.stringify({ openapi: "3.0.0" }));

      expect(() => parseOpenApiFile(buffer)).toThrow(BusinessException);
    });
  });

  describe("extractCandidates", () => {
    it("extracts one candidate per operation key, ignoring non-operation path-item keys", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: {
              "/pets": { get: { summary: "List pets" }, post: {}, parameters: [] },
              "/pets/{id}": { get: { operationId: "getPet" } },
            },
          }),
        ),
      );

      const candidates = extractCandidates(spec);

      expect(candidates).toHaveLength(3);
      expect(candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ httpMethod: "GET", path: "/pets", suggestedApiName: "List pets" }),
          expect.objectContaining({ httpMethod: "POST", path: "/pets" }),
          expect.objectContaining({ httpMethod: "GET", path: "/pets/{id}", suggestedApiName: "getPet" }),
        ]),
      );
    });

    it("prefers summary over operationId for the suggested name", () => {
      const spec = parseOpenApiFile(
        Buffer.from(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: { summary: "Sum", operationId: "opId" } } } })),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.suggestedApiName).toBe("Sum");
    });

    // 3B FINAL FROZEN API Contract §12 — query/header parameter mapping.
    it("maps supported query and header parameters to Request Input rows, skipping path and reserved header entries", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: {
              "/pets/{id}": {
                get: {
                  parameters: [
                    { name: "id", in: "path", required: true },
                    { name: "status", in: "query", required: true },
                    { name: "limit", in: "query", required: false },
                    { name: "X-Trace-Id", in: "header", required: false },
                    { name: "Authorization", in: "header", required: true },
                    { name: "Content-Type", in: "header", required: false },
                  ],
                },
              },
            },
          }),
        ),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.queryParameters).toEqual([
        { name: "status", required: true },
        { name: "limit", required: false },
      ]);
      expect(candidate.headerParameters).toEqual([{ name: "X-Trace-Id", required: false }]);
      expect(candidate.warnings).toEqual(
        expect.arrayContaining([
          { code: "RESERVED_HEADER_PARAMETER_IGNORED", detail: "Header 'Authorization' is reserved and was not imported as a normal Header parameter." },
          { code: "RESERVED_HEADER_PARAMETER_IGNORED", detail: "Header 'Content-Type' is reserved and was not imported as a normal Header parameter." },
        ]),
      );
    });

    // Finding 2 — a duplicate QUERY parameter (exact-case match) is not
    // persisted twice; it is reported as an additive warning instead of
    // being dropped silently.
    it("ignores a duplicate QUERY parameter (case-sensitive match) and reports a warning, keeping only the first occurrence", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: {
              "/x": {
                get: {
                  parameters: [
                    { name: "status", in: "query", required: true },
                    { name: "status", in: "query", required: false },
                  ],
                },
              },
            },
          }),
        ),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.queryParameters).toEqual([{ name: "status", required: true }]);
      expect(candidate.warnings).toEqual([{ code: "DUPLICATE_QUERY_PARAMETER_IGNORED", detail: "Duplicate QUERY parameter 'status' was ignored; only the first occurrence was imported." }]);
    });

    // Finding 2 — QUERY duplicate comparison stays case-sensitive: two
    // differently-cased names are NOT treated as duplicates.
    it("treats differently-cased QUERY parameter names as distinct, not duplicates", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: { "/x": { get: { parameters: [{ name: "status", in: "query" }, { name: "Status", in: "query" }] } } },
          }),
        ),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.queryParameters).toEqual([
        { name: "status", required: false },
        { name: "Status", required: false },
      ]);
      expect(candidate.warnings).toEqual([]);
    });

    // Finding 2 — a duplicate HEADER parameter that differs only by casing
    // is treated as a duplicate (case-insensitive), not persisted twice, and
    // reported as an additive warning.
    it("ignores a duplicate HEADER parameter that differs only by casing and reports a warning", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: {
              "/x": {
                get: {
                  parameters: [
                    { name: "X-Trace-Id", in: "header", required: true },
                    { name: "x-trace-id", in: "header", required: false },
                  ],
                },
              },
            },
          }),
        ),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.headerParameters).toEqual([{ name: "X-Trace-Id", required: true }]);
      expect(candidate.warnings).toEqual([{ code: "DUPLICATE_HEADER_PARAMETER_IGNORED", detail: "Duplicate HEADER parameter 'x-trace-id' was ignored; only the first occurrence was imported." }]);
    });

    // Finding 2 — reserved Authorization header is not persisted and is
    // reported via an additive warning rather than dropped silently.
    it("does not persist a reserved Authorization header and reports a warning", () => {
      const spec = parseOpenApiFile(
        Buffer.from(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: { parameters: [{ name: "Authorization", in: "header", required: true }] } } } })),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.headerParameters).toEqual([]);
      expect(candidate.warnings).toEqual([{ code: "RESERVED_HEADER_PARAMETER_IGNORED", detail: "Header 'Authorization' is reserved and was not imported as a normal Header parameter." }]);
    });

    // Finding 2 — reserved Content-Type header is not persisted and is
    // reported via an additive warning rather than dropped silently.
    it("does not persist a reserved Content-Type header and reports a warning", () => {
      const spec = parseOpenApiFile(
        Buffer.from(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: { parameters: [{ name: "Content-Type", in: "header", required: false }] } } } })),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.headerParameters).toEqual([]);
      expect(candidate.warnings).toEqual([{ code: "RESERVED_HEADER_PARAMETER_IGNORED", detail: "Header 'Content-Type' is reserved and was not imported as a normal Header parameter." }]);
    });

    // Finding 2 — parameter warnings and body warnings both flow through the
    // same combined `warnings` array on one candidate (one consistent
    // collection path, not separate mechanisms).
    it("combines parameter-level and body-level warnings on the same candidate", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: {
              "/x": {
                post: {
                  parameters: [{ name: "Authorization", in: "header", required: true }],
                  requestBody: { content: { "multipart/form-data": {} } },
                },
              },
            },
          }),
        ),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.warnings).toEqual([
        { code: "RESERVED_HEADER_PARAMETER_IGNORED", detail: "Header 'Authorization' is reserved and was not imported as a normal Header parameter." },
        { code: "UNSUPPORTED_REQUEST_BODY_MEDIA_TYPE", detail: "multipart/form-data is not supported in the current MVP." },
      ]);
    });

    // §12 — requestBody.content.application/json maps to Body Definition.
    it("maps an application/json request body to bodyType JSON", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: { "/pets": { post: { requestBody: { content: { "application/json": { schema: {} } } } } } },
          }),
        ),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.requestBody).toEqual({ bodyType: "JSON" });
      expect(candidate.warnings).toEqual([]);
    });

    // §12/§13 — an only-unsupported media type must not be silently
    // converted to JSON; it is reported as an additive warning instead.
    it("does not convert an unsupported-only request body media type to JSON, and reports a warning", () => {
      const spec = parseOpenApiFile(
        Buffer.from(
          JSON.stringify({
            openapi: "3.0.0",
            paths: { "/pets": { post: { requestBody: { content: { "multipart/form-data": {} } } } } },
          }),
        ),
      );

      const [candidate] = extractCandidates(spec);

      expect(candidate.requestBody).toBeNull();
      expect(candidate.warnings).toEqual([{ code: "UNSUPPORTED_REQUEST_BODY_MEDIA_TYPE", detail: "multipart/form-data is not supported in the current MVP." }]);
    });
  });

  describe("candidateKey", () => {
    it("is a deterministic Method+Path composite", () => {
      expect(candidateKey("GET", "/x")).toBe("GET /x");
      expect(candidateKey("GET", "/x")).toBe(candidateKey("GET", "/x"));
      expect(candidateKey("GET", "/x")).not.toBe(candidateKey("POST", "/x"));
    });
  });
});
