import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import type { PagedResult } from "../audit/audit-query.service";
import { CreateApiDto } from "./dto/create-api.dto";
import { UpdateApiDto } from "./dto/update-api.dto";
import { ListApisQueryDto } from "./dto/list-apis-query.dto";
import { assertSupportedHttpMethod } from "./http-method.constants";

export interface ApiListItem {
  apiId: string;
  apiName: string;
  httpMethod: string;
  path: string;
  description: string | null;
  creationSource: string;
  configuredEnvironmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiDetail {
  apiId: string;
  projectId: string;
  apiName: string;
  httpMethod: string;
  path: string;
  description: string | null;
  creationSource: string;
  createdAt: Date;
  updatedAt: Date;
}

async function assertProjectActive(prisma: Prisma.TransactionClient | PrismaService, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({ where: { projectId, deletedAt: null } });
  if (!project) {
    throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
  }
  if (project.projectStatus !== "ACTIVE") {
    throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Project is not ACTIVE");
  }
}

@Injectable()
export class ApisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-API-001 — no audit for ordinary read.
  async list(projectId: string, query: ListApisQueryDto): Promise<PagedResult<ApiListItem>> {
    const project = await this.prisma.project.findFirst({ where: { projectId, deletedAt: null } });
    if (!project) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ApiConfigurationWhereInput = { projectId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { apiName: { contains: query.search, mode: "insensitive" } },
        { path: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.httpMethod) {
      where.httpMethod = query.httpMethod;
    }

    const [rows, totalItems] = await Promise.all([
      this.prisma.apiConfiguration.findMany({
        where,
        include: { _count: { select: { configs: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.apiConfiguration.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        apiId: row.apiId,
        apiName: row.apiName,
        httpMethod: row.httpMethod,
        path: row.path,
        description: row.description,
        creationSource: row.creationSource,
        configuredEnvironmentCount: row._count.configs,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  // API-API-002
  async create(projectId: string, dto: CreateApiDto, actorUserId: string): Promise<ApiDetail> {
    assertSupportedHttpMethod(dto.httpMethod);

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
            creationSource: "MANUAL",
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new BusinessException(HttpStatus.CONFLICT, "API_ALREADY_EXISTS", "An active API with this Method and Path already exists in this Project");
        }
        throw err;
      }

      await this.auditWriter.record(
        {
          eventType: "API_CREATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "API_CONFIGURATION",
          targetId: created.apiId,
          targetDisplay: created.apiName,
          projectId,
          afterData: { apiName: created.apiName, httpMethod: created.httpMethod, path: created.path, creationSource: created.creationSource },
        },
        tx,
      );

      return this.toDetail(created);
    });
  }

  // API-API-003
  async getById(projectId: string, apiId: string): Promise<ApiDetail> {
    const api = await this.prisma.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
    if (!api) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
    }
    return this.toDetail(api);
  }

  // API-API-004
  async update(projectId: string, apiId: string, dto: UpdateApiDto, actorUserId: string): Promise<ApiDetail> {
    if (dto.apiName === undefined && dto.httpMethod === undefined && dto.path === undefined && dto.description === undefined) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "At least one field is required");
    }

    if (dto.httpMethod !== undefined) {
      assertSupportedHttpMethod(dto.httpMethod);
    }

    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const existing = await tx.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
      }

      const finalMethod = dto.httpMethod ?? existing.httpMethod;
      const finalPath = dto.path ?? existing.path;

      if (finalMethod !== existing.httpMethod || finalPath !== existing.path) {
        const duplicate = await tx.apiConfiguration.findFirst({
          where: { projectId, httpMethod: finalMethod, path: finalPath, deletedAt: null, NOT: { apiId } },
        });
        if (duplicate) {
          throw new BusinessException(HttpStatus.CONFLICT, "API_ALREADY_EXISTS", "An active API with this Method and Path already exists in this Project");
        }
      }

      const data: Prisma.ApiConfigurationUpdateInput = {};
      const beforeData: Record<string, unknown> = {};
      const afterData: Record<string, unknown> = {};
      let changed = false;

      if (dto.apiName !== undefined && dto.apiName !== existing.apiName) {
        data.apiName = dto.apiName;
        beforeData.apiName = existing.apiName;
        afterData.apiName = dto.apiName;
        changed = true;
      }
      if (dto.httpMethod !== undefined && dto.httpMethod !== existing.httpMethod) {
        data.httpMethod = dto.httpMethod;
        beforeData.httpMethod = existing.httpMethod;
        afterData.httpMethod = dto.httpMethod;
        changed = true;
      }
      if (dto.path !== undefined && dto.path !== existing.path) {
        data.path = dto.path;
        beforeData.path = existing.path;
        afterData.path = dto.path;
        changed = true;
      }
      if (dto.description !== undefined && dto.description !== existing.description) {
        data.description = dto.description;
        beforeData.description = existing.description;
        afterData.description = dto.description;
        changed = true;
      }

      let updated = existing;
      if (Object.keys(data).length > 0) {
        try {
          updated = await tx.apiConfiguration.update({ where: { apiId }, data });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new BusinessException(HttpStatus.CONFLICT, "API_ALREADY_EXISTS", "An active API with this Method and Path already exists in this Project");
          }
          throw err;
        }
      }

      if (changed) {
        await this.auditWriter.record(
          {
            eventType: "API_UPDATED",
            result: "SUCCESS",
            actorUserId,
            targetType: "API_CONFIGURATION",
            targetId: apiId,
            targetDisplay: updated.apiName,
            projectId,
            beforeData,
            afterData,
          },
          tx,
        );
      }

      return this.toDetail(updated);
    });
  }

  // API-API-005 — ADMIN only (enforced by RolesGuard upstream). Soft delete
  // only, never a hard delete; does not block future reuse of the same
  // Method+Path (the partial unique index only covers deleted_at IS NULL).
  async softDelete(projectId: string, apiId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const existing = await tx.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
      }

      await tx.apiConfiguration.update({ where: { apiId }, data: { deletedAt: new Date() } });

      await this.auditWriter.record(
        {
          eventType: "API_SOFT_DELETED",
          result: "SUCCESS",
          actorUserId,
          targetType: "API_CONFIGURATION",
          targetId: apiId,
          targetDisplay: existing.apiName,
          projectId,
        },
        tx,
      );
    });
  }

  private toDetail(api: {
    apiId: string;
    projectId: string;
    apiName: string;
    httpMethod: string;
    path: string;
    description: string | null;
    creationSource: string;
    createdAt: Date;
    updatedAt: Date;
  }): ApiDetail {
    return {
      apiId: api.apiId,
      projectId: api.projectId,
      apiName: api.apiName,
      httpMethod: api.httpMethod,
      path: api.path,
      description: api.description,
      creationSource: api.creationSource,
      createdAt: api.createdAt,
      updatedAt: api.updatedAt,
    };
  }
}

export function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

export { assertProjectActive };
