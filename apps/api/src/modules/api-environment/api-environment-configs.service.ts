import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import { PutApiEnvironmentConfigDto } from "./dto/put-api-environment-config.dto";

export interface ApiEnvironmentConfigListItem {
  environmentId: string;
  environmentName: string;
  classification: string;
  environmentStatus: string;
  allowRun: boolean;
  urlStatus: "CONFIGURED" | "NOT_CONFIGURED";
  fullUrl: string | null;
  credentialStatus: "NOT_REQUIRED" | "CONFIGURED" | "NOT_CONFIGURED";
}

export interface ApiEnvironmentConfigResult {
  apiId: string;
  environmentId: string;
  urlStatus: "CONFIGURED";
  fullUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

// 3B FINAL FROZEN API Contract §11 — Full URL must not carry a query string
// (REQ-INP-003 BR-INP-003-11: Query Run Value belongs to Request Input, not
// the configured Full URL) or a fragment. Endpoint/response shape unchanged;
// this only narrows what fullUrl values API-APIENV-002 accepts.
function validateAbsoluteHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "fullUrl is not a well-formed URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "fullUrl must be an absolute HTTP or HTTPS URL");
  }
  if (parsed.search !== "") {
    throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "fullUrl must not contain a query component; configure Query parameters via Request Input");
  }
  if (parsed.hash !== "") {
    throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "fullUrl must not contain a fragment component");
  }
}

@Injectable()
export class ApiEnvironmentConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-APIENV-001 — reads all Project Environments including INACTIVE for
  // traceability; a missing api_environment_configs row is represented as
  // NOT_CONFIGURED (left-join semantics), never as an error. credentialStatus
  // (Group 3C) mirrors the same left-join convention against
  // authentication_configurations: no row = auth_type NONE = NOT_REQUIRED.
  async list(projectId: string, apiId: string): Promise<{ apiId: string; items: ApiEnvironmentConfigListItem[] }> {
    const api = await this.prisma.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
    if (!api) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
    }

    const [environments, configs, authConfigs] = await Promise.all([
      this.prisma.environment.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      this.prisma.apiEnvironmentConfig.findMany({ where: { apiId } }),
      this.prisma.authenticationConfiguration.findMany({ where: { apiId } }),
    ]);
    const configByEnvironmentId = new Map(configs.map((c) => [c.environmentId, c]));
    const authConfigByEnvironmentId = new Map(authConfigs.map((c) => [c.environmentId, c]));

    return {
      apiId,
      items: environments.map((env) => {
        const config = configByEnvironmentId.get(env.environmentId);
        const authConfig = authConfigByEnvironmentId.get(env.environmentId);
        const authType = authConfig?.authType ?? "NONE";
        const secretPresent = authConfig ? authConfig.passwordCiphertext !== null || authConfig.bearerTokenCiphertext !== null : false;
        return {
          environmentId: env.environmentId,
          environmentName: env.environmentName,
          classification: env.classification,
          environmentStatus: env.environmentStatus,
          allowRun: env.allowRun,
          urlStatus: config ? "CONFIGURED" : "NOT_CONFIGURED",
          fullUrl: config?.fullUrl ?? null,
          credentialStatus: authType === "NONE" ? "NOT_REQUIRED" : secretPresent ? "CONFIGURED" : "NOT_CONFIGURED",
        };
      }),
    };
  }

  // API-APIENV-002 — upsert on (apiId, environmentId). Requires Project
  // ACTIVE, Environment ACTIVE, and both API and Environment to belong to the
  // same supplied Project (checked transactionally before write, since
  // api_environment_configs intentionally does not duplicate projectId).
  async put(projectId: string, apiId: string, environmentId: string, dto: PutApiEnvironmentConfigDto, actorUserId: string): Promise<{ status: 200 | 201; body: ApiEnvironmentConfigResult }> {
    validateAbsoluteHttpUrl(dto.fullUrl);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { projectId, deletedAt: null } });
      if (!project) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
      }
      if (project.projectStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Project is not ACTIVE");
      }

      const api = await tx.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
      if (!api) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
      }

      const environment = await tx.environment.findFirst({ where: { environmentId, projectId } });
      if (!environment) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Environment does not exist");
      }
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }

      const existing = await tx.apiEnvironmentConfig.findUnique({
        where: { apiId_environmentId: { apiId, environmentId } },
      });

      const saved = await tx.apiEnvironmentConfig.upsert({
        where: { apiId_environmentId: { apiId, environmentId } },
        create: { apiId, environmentId, fullUrl: dto.fullUrl },
        update: { fullUrl: dto.fullUrl },
      });

      await this.auditWriter.record(
        {
          eventType: existing ? "API_ENVIRONMENT_URL_UPDATED" : "API_ENVIRONMENT_URL_CONFIGURED",
          result: "SUCCESS",
          actorUserId,
          targetType: "API_ENVIRONMENT_CONFIG",
          targetId: `${apiId}:${environmentId}`,
          targetDisplay: `${api.apiName} @ ${environment.environmentName}`,
          projectId,
          beforeData: existing ? { fullUrl: existing.fullUrl } : undefined,
          afterData: { fullUrl: saved.fullUrl },
        },
        tx,
      );

      return {
        status: existing ? 200 : 201,
        body: {
          apiId: saved.apiId,
          environmentId: saved.environmentId,
          urlStatus: "CONFIGURED",
          fullUrl: saved.fullUrl,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        },
      };
    });
  }
}
