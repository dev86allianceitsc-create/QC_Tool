import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import { assertProjectActive, isUniqueConstraintError } from "./apis.service";
import { PutRequestInputDto } from "./dto/put-request-input.dto";
import { assertNoDuplicateNames, derivePathParameters, isReservedHeaderName, validateParameterNameFormat } from "./request-input-validation.util";

export interface RequestInputParameter {
  name: string;
  required: boolean;
}

export interface RequestInputPathParameter {
  name: string;
  required: true;
  source: "AUTO_DETECTED";
}

export interface RequestInputBody {
  bodyType: string;
}

export interface RequestInputDefinition {
  apiId: string;
  httpMethod: string;
  path: string;
  pathParameters: RequestInputPathParameter[];
  queryParameters: RequestInputParameter[];
  headerParameters: RequestInputParameter[];
  requestBody: RequestInputBody | null;
}

async function findActiveApi(prisma: { apiConfiguration: { findFirst: (args: unknown) => Promise<unknown> } }, projectId: string, apiId: string) {
  const api = await prisma.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
  if (!api) {
    throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
  }
  return api as { apiId: string; httpMethod: string; path: string };
}

@Injectable()
export class RequestInputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-INP-001 — aggregate read; Path Parameters are re-derived from the
  // current API Path on every call (never persisted). No mutation audit.
  async get(projectId: string, apiId: string): Promise<RequestInputDefinition> {
    const api = await findActiveApi(this.prisma, projectId, apiId);

    const [parameters, body] = await Promise.all([
      this.prisma.requestParameterDefinition.findMany({ where: { apiId }, orderBy: { createdAt: "asc" } }),
      this.prisma.requestBodyDefinition.findFirst({ where: { apiId } }),
    ]);

    return this.toDefinition(api, parameters, body);
  }

  // API-INP-002 — atomic full replacement (DP-3B-API-02, FROZEN). Application
  // validates duplicate/reserved-name rules first (friendly 422s); the DB
  // partial unique indexes are the concurrency safety net (§18).
  async replace(projectId: string, apiId: string, dto: PutRequestInputDto, actorUserId: string): Promise<RequestInputDefinition> {
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

      const api = await findActiveApi(tx, projectId, apiId);

      const [beforeParameters, beforeBody] = await Promise.all([
        tx.requestParameterDefinition.findMany({ where: { apiId }, orderBy: { createdAt: "asc" } }),
        tx.requestBodyDefinition.findFirst({ where: { apiId } }),
      ]);

      try {
        await tx.requestParameterDefinition.deleteMany({ where: { apiId } });

        if (dto.queryParameters.length > 0 || dto.headerParameters.length > 0) {
          await tx.requestParameterDefinition.createMany({
            data: [
              ...dto.queryParameters.map((p) => ({ apiId, location: "QUERY", parameterName: p.name, isRequired: p.required })),
              ...dto.headerParameters.map((p) => ({ apiId, location: "HEADER", parameterName: p.name, isRequired: p.required })),
            ],
          });
        }

        if (dto.requestBody === null) {
          await tx.requestBodyDefinition.deleteMany({ where: { apiId } });
        } else {
          await tx.requestBodyDefinition.upsert({
            where: { apiId },
            create: { apiId, bodyType: dto.requestBody.bodyType },
            update: { bodyType: dto.requestBody.bodyType },
          });
        }
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new BusinessException(HttpStatus.CONFLICT, "CONFLICT", "Request Input Definition could not be saved due to a concurrent update");
        }
        throw err;
      }

      const [afterParameters, afterBody] = await Promise.all([
        tx.requestParameterDefinition.findMany({ where: { apiId }, orderBy: { createdAt: "asc" } }),
        tx.requestBodyDefinition.findFirst({ where: { apiId } }),
      ]);

      await this.auditWriter.record(
        {
          eventType: "REQUEST_INPUT_REPLACED",
          result: "SUCCESS",
          actorUserId,
          targetType: "API_CONFIGURATION",
          targetId: apiId,
          targetDisplay: api.path,
          projectId,
          beforeData: {
            queryParameters: beforeParameters.filter((p) => p.location === "QUERY").map((p) => ({ name: p.parameterName, required: p.isRequired })),
            headerParameters: beforeParameters.filter((p) => p.location === "HEADER").map((p) => ({ name: p.parameterName, required: p.isRequired })),
            requestBody: beforeBody ? { bodyType: beforeBody.bodyType } : null,
          },
          afterData: {
            queryParameters: afterParameters.filter((p) => p.location === "QUERY").map((p) => ({ name: p.parameterName, required: p.isRequired })),
            headerParameters: afterParameters.filter((p) => p.location === "HEADER").map((p) => ({ name: p.parameterName, required: p.isRequired })),
            requestBody: afterBody ? { bodyType: afterBody.bodyType } : null,
          },
        },
        tx,
      );

      return this.toDefinition(api, afterParameters, afterBody);
    });
  }

  private toDefinition(
    api: { apiId: string; httpMethod: string; path: string },
    parameters: { location: string; parameterName: string; isRequired: boolean }[],
    body: { bodyType: string } | null,
  ): RequestInputDefinition {
    return {
      apiId: api.apiId,
      httpMethod: api.httpMethod,
      path: api.path,
      pathParameters: derivePathParameters(api.path),
      queryParameters: parameters.filter((p) => p.location === "QUERY").map((p) => ({ name: p.parameterName, required: p.isRequired })),
      headerParameters: parameters.filter((p) => p.location === "HEADER").map((p) => ({ name: p.parameterName, required: p.isRequired })),
      requestBody: body ? { bodyType: body.bodyType } : null,
    };
  }
}
