import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import { ApiDetail, assertProjectActive, isUniqueConstraintError } from "./apis.service";
import { ImportCurlFetchDto } from "./dto/import-curl-fetch.dto";
import { ImportOpenApiDto } from "./dto/import-openapi.dto";
import { UploadedMulterFile } from "./uploaded-file.type";
import { assertSupportedHttpMethod, isSupportedHttpMethod } from "./http-method.constants";
import { candidateKey, ExtractedImportWarning, extractCandidates, parseOpenApiFile } from "./openapi-import.util";
import { assertNoDuplicateNames, isReservedHeaderName, validateParameterNameFormat } from "./request-input-validation.util";

export type PreviewCandidateStatus = "VALID" | "DUPLICATE" | "INVALID";

export interface PreviewCandidate {
  httpMethod: string;
  path: string;
  suggestedApiName?: string;
  status: PreviewCandidateStatus;
  reason?: string;
  warnings: ExtractedImportWarning[];
}

export interface PreviewImportResult {
  specification: { format: "JSON" | "YAML"; detectedVersion: string };
  items: PreviewCandidate[];
  totalCandidates: number;
}

export type ImportCandidateResult = "IMPORTED" | "SKIPPED" | "FAILED";

export interface ImportedCandidate {
  httpMethod: string;
  path: string;
  result: ImportCandidateResult;
  reason?: string;
  apiId?: string;
  warnings: ExtractedImportWarning[];
}

export interface ImportOutcome {
  results: ImportedCandidate[];
  summary: { imported: number; skipped: number; failed: number };
}

// 3B FINAL FROZEN API Contract §9/§12 — a candidate whose Method is outside
// the REQ-INP-002 supported allowlist must not become a valid API
// Configuration; this is reported as INVALID at preview time (existing
// VALID/DUPLICATE/INVALID status semantics unchanged, additive reason only).
function classifyCandidate(httpMethod: string, path: string, seenKeys: Set<string>, activeKeys: Set<string>): { status: PreviewCandidateStatus; reason?: string } {
  if (!path || !httpMethod) {
    return { status: "INVALID", reason: "Missing HTTP method or path" };
  }
  if (!isSupportedHttpMethod(httpMethod)) {
    return { status: "INVALID", reason: `Unsupported HTTP Method '${httpMethod}'. Supported methods are GET, POST, PUT, PATCH, DELETE.` };
  }
  const key = candidateKey(httpMethod, path);
  if (activeKeys.has(key) || seenKeys.has(key)) {
    return { status: "DUPLICATE", reason: "An active API with this Method and Path already exists" };
  }
  return { status: "VALID" };
}

@Injectable()
export class ApiImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-API-006 — Preview only: parses and classifies candidates, never
  // persists ApiConfiguration/Environment URL/Run data. Duplicate identity is
  // Project+Method+Path against currently-active (non-deleted) APIs.
  async preview(projectId: string, file: UploadedMulterFile): Promise<PreviewImportResult> {
    await assertProjectActive(this.prisma, projectId);

    const spec = parseOpenApiFile(file.buffer);
    const candidates = extractCandidates(spec);

    const activeApis = await this.prisma.apiConfiguration.findMany({
      where: { projectId, deletedAt: null },
      select: { httpMethod: true, path: true },
    });
    const activeKeys = new Set(activeApis.map((a) => candidateKey(a.httpMethod, a.path)));
    const seenKeys = new Set<string>();

    const items: PreviewCandidate[] = candidates.map((c) => {
      const { status, reason } = classifyCandidate(c.httpMethod, c.path, seenKeys, activeKeys);
      if (status !== "INVALID") {
        seenKeys.add(candidateKey(c.httpMethod, c.path));
      }
      return { httpMethod: c.httpMethod, path: c.path, suggestedApiName: c.suggestedApiName, status, reason, warnings: c.warnings };
    });

    return {
      specification: { format: spec.format, detectedVersion: spec.detectedVersion },
      items,
      totalCandidates: items.length,
    };
  }

  // API-API-007 — Confirm Import: reparses the file server-side (never
  // trusts client-supplied candidate metadata beyond httpMethod+path used to
  // select which parsed candidates to import); imports only the selected,
  // currently-valid candidates. Each candidate is evaluated independently —
  // the batch is not all-or-nothing, so one FAILED/SKIPPED entry does not
  // roll back another candidate's successful IMPORTED row.
  async confirmImport(projectId: string, file: UploadedMulterFile, dto: ImportOpenApiDto, actorUserId: string): Promise<ImportOutcome> {
    await assertProjectActive(this.prisma, projectId);

    const spec = parseOpenApiFile(file.buffer);
    const parsedCandidates = extractCandidates(spec);
    const parsedByKey = new Map(parsedCandidates.map((c) => [candidateKey(c.httpMethod, c.path), c]));

    const results: ImportedCandidate[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const selected of dto.selectedCandidates) {
      const key = candidateKey(selected.httpMethod, selected.path);
      const parsed = parsedByKey.get(key);
      if (!parsed) {
        results.push({ httpMethod: selected.httpMethod, path: selected.path, result: "FAILED", reason: "Candidate not found in the uploaded specification", warnings: [] });
        failed += 1;
        continue;
      }

      // Defensive re-check: preview may go stale (§18); a candidate whose
      // Method fell outside the REQ-INP-002 allowlist must never be
      // persisted as an API Configuration even if selected.
      if (!isSupportedHttpMethod(parsed.httpMethod)) {
        results.push({
          httpMethod: parsed.httpMethod,
          path: parsed.path,
          result: "FAILED",
          reason: `Unsupported HTTP Method '${parsed.httpMethod}'. Supported methods are GET, POST, PUT, PATCH, DELETE.`,
          warnings: parsed.warnings,
        });
        failed += 1;
        continue;
      }

      try {
        const outcome = await this.prisma.$transaction(async (tx) => {
          const duplicate = await tx.apiConfiguration.findFirst({
            where: { projectId, httpMethod: parsed.httpMethod, path: parsed.path, deletedAt: null },
          });
          if (duplicate) {
            return { result: "SKIPPED" as const, reason: "An active API with this Method and Path already exists" };
          }

          const created = await tx.apiConfiguration.create({
            data: {
              projectId,
              apiName: parsed.suggestedApiName?.trim() || `${parsed.httpMethod} ${parsed.path}`,
              httpMethod: parsed.httpMethod,
              path: parsed.path,
              description: null,
              creationSource: "OPENAPI_IMPORT",
            },
          });

          // 3B FINAL FROZEN API Contract §12 — the imported Request Input
          // Definition must be committed atomically with the API core row;
          // a failure here must not leave a misleading partial/supported
          // definition, so this stays inside the same per-candidate
          // transaction as apiConfiguration.create above.
          if (parsed.queryParameters.length > 0 || parsed.headerParameters.length > 0) {
            await tx.requestParameterDefinition.createMany({
              data: [
                ...parsed.queryParameters.map((p) => ({ apiId: created.apiId, location: "QUERY", parameterName: p.name, isRequired: p.required })),
                ...parsed.headerParameters.map((p) => ({ apiId: created.apiId, location: "HEADER", parameterName: p.name, isRequired: p.required })),
              ],
            });
          }
          if (parsed.requestBody) {
            await tx.requestBodyDefinition.create({ data: { apiId: created.apiId, bodyType: parsed.requestBody.bodyType } });
          }

          await this.auditWriter.record(
            {
              eventType: "API_IMPORTED",
              result: "SUCCESS",
              actorUserId,
              targetType: "API_CONFIGURATION",
              targetId: created.apiId,
              targetDisplay: created.apiName,
              projectId,
              afterData: {
                apiName: created.apiName,
                httpMethod: created.httpMethod,
                path: created.path,
                creationSource: created.creationSource,
                requestInputCounts: { query: parsed.queryParameters.length, header: parsed.headerParameters.length, body: parsed.requestBody ? 1 : 0 },
              },
            },
            tx,
          );

          return { result: "IMPORTED" as const, apiId: created.apiId };
        });

        if (outcome.result === "IMPORTED") {
          results.push({ httpMethod: parsed.httpMethod, path: parsed.path, result: "IMPORTED", apiId: outcome.apiId, warnings: parsed.warnings });
          imported += 1;
        } else {
          results.push({ httpMethod: parsed.httpMethod, path: parsed.path, result: "SKIPPED", reason: outcome.reason, warnings: parsed.warnings });
          skipped += 1;
        }
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          results.push({ httpMethod: parsed.httpMethod, path: parsed.path, result: "SKIPPED", reason: "An active API with this Method and Path already exists", warnings: parsed.warnings });
          skipped += 1;
        } else {
          results.push({ httpMethod: parsed.httpMethod, path: parsed.path, result: "FAILED", reason: "Unexpected error while importing this endpoint", warnings: parsed.warnings });
          failed += 1;
        }
      }
    }

    return { results, summary: { imported, skipped, failed } };
  }

  // Phase 2 (customer feedback #1) importApiFromCurlFetch. Unlike the
  // Swagger flow above, parsing already happened client-side and the user
  // has reviewed/edited the result — this is a single, already-confirmed
  // candidate, so it creates the API core row and its Request Input
  // atomically in one transaction (no preview/multi-candidate batch).
  // Query/header name validation runs before the transaction opens, mirroring
  // RequestInputService.replace().
  async importFromCurlFetch(projectId: string, dto: ImportCurlFetchDto, actorUserId: string): Promise<ApiDetail> {
    assertSupportedHttpMethod(dto.httpMethod);

    for (const param of dto.queryParameters) {
      validateParameterNameFormat(param.name, "QUERY");
    }
    assertNoDuplicateNames(
      dto.queryParameters.map((p) => p.name),
      "QUERY",
    );

    for (const param of dto.headerParameters) {
      validateParameterNameFormat(param.name, "HEADER");
      if (isReservedHeaderName(param.name)) {
        throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", `Header parameter name '${param.name}' is reserved and cannot be configured as a normal Header`);
      }
    }
    assertNoDuplicateNames(
      dto.headerParameters.map((p) => p.name),
      "HEADER",
    );

    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const duplicate = await tx.apiConfiguration.findFirst({
        where: { projectId, httpMethod: dto.httpMethod, path: dto.path, deletedAt: null },
      });
      if (duplicate) {
        throw new BusinessException(HttpStatus.CONFLICT, "API_ALREADY_EXISTS", "An active API with this Method and Path already exists in this Project");
      }

      let created;
      try {
        created = await tx.apiConfiguration.create({
          data: {
            projectId,
            apiName: dto.apiName,
            httpMethod: dto.httpMethod,
            path: dto.path,
            description: dto.description ?? null,
            creationSource: "CURL_IMPORT",
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new BusinessException(HttpStatus.CONFLICT, "API_ALREADY_EXISTS", "An active API with this Method and Path already exists in this Project");
        }
        throw err;
      }

      if (dto.queryParameters.length > 0 || dto.headerParameters.length > 0) {
        await tx.requestParameterDefinition.createMany({
          data: [
            ...dto.queryParameters.map((p) => ({ apiId: created.apiId, location: "QUERY", parameterName: p.name, isRequired: p.required })),
            ...dto.headerParameters.map((p) => ({ apiId: created.apiId, location: "HEADER", parameterName: p.name, isRequired: p.required })),
          ],
        });
      }
      if (dto.requestBody) {
        await tx.requestBodyDefinition.create({ data: { apiId: created.apiId, bodyType: dto.requestBody.bodyType } });
      }

      await this.auditWriter.record(
        {
          eventType: "API_IMPORTED",
          result: "SUCCESS",
          actorUserId,
          targetType: "API_CONFIGURATION",
          targetId: created.apiId,
          targetDisplay: created.apiName,
          projectId,
          afterData: {
            apiName: created.apiName,
            httpMethod: created.httpMethod,
            path: created.path,
            creationSource: created.creationSource,
            requestInputCounts: { query: dto.queryParameters.length, header: dto.headerParameters.length, body: dto.requestBody ? 1 : 0 },
          },
        },
        tx,
      );

      return {
        apiId: created.apiId,
        projectId: created.projectId,
        apiName: created.apiName,
        httpMethod: created.httpMethod,
        path: created.path,
        description: created.description,
        creationSource: created.creationSource,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    });
  }
}
