import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import type { PagedResult } from "../audit/audit-query.service";
import { assertProjectActive, isUniqueConstraintError } from "./apis.service";
import { CreateEnvironmentDto } from "./dto/create-environment.dto";
import { UpdateEnvironmentDto } from "./dto/update-environment.dto";
import { ListEnvironmentsQueryDto } from "./dto/list-environments-query.dto";

export interface EnvironmentListItem {
  environmentId: string;
  environmentName: string;
  classification: string;
  allowRun: boolean;
  environmentStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentDetail extends EnvironmentListItem {
  projectId: string;
}

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-ENV-001 — both Project ACTIVE and INACTIVE permit read; no
  // classification inferred from name.
  async list(projectId: string, query: ListEnvironmentsQueryDto): Promise<PagedResult<EnvironmentListItem>> {
    const project = await this.prisma.project.findFirst({ where: { projectId, deletedAt: null } });
    if (!project) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.EnvironmentWhereInput = { projectId };
    if (query.search) {
      where.environmentName = { contains: query.search, mode: "insensitive" };
    }
    if (query.status) {
      where.environmentStatus = query.status;
    }
    if (query.classification) {
      where.classification = query.classification;
    }

    const [rows, totalItems] = await Promise.all([
      this.prisma.environment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.environment.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toListItem(row)),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  // API-ENV-002 — ADMIN only. allowRun is server-derived from classification;
  // the client cannot supply it.
  async create(projectId: string, dto: CreateEnvironmentDto, actorUserId: string): Promise<EnvironmentDetail> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const normalizedName = dto.environmentName.trim();
      const duplicate = await tx.environment.findFirst({
        where: { projectId, environmentName: { equals: normalizedName, mode: "insensitive" } },
      });
      if (duplicate) {
        throw new BusinessException(HttpStatus.CONFLICT, "ENVIRONMENT_NAME_EXISTS", "An Environment with this name already exists in this Project");
      }

      const allowRun = dto.classification === "NON_PRODUCTION";

      let created;
      try {
        created = await tx.environment.create({
          data: {
            projectId,
            environmentName: normalizedName,
            classification: dto.classification,
            allowRun,
            environmentStatus: "ACTIVE",
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new BusinessException(HttpStatus.CONFLICT, "ENVIRONMENT_NAME_EXISTS", "An Environment with this name already exists in this Project");
        }
        throw err;
      }

      await this.auditWriter.record(
        {
          eventType: "ENVIRONMENT_CREATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "ENVIRONMENT",
          targetId: created.environmentId,
          targetDisplay: created.environmentName,
          projectId,
          afterData: {
            environmentName: created.environmentName,
            classification: created.classification,
            allowRun: created.allowRun,
            environmentStatus: created.environmentStatus,
          },
        },
        tx,
      );

      return this.toDetail(created);
    });
  }

  // API-ENV-003 — resolves the Environment including INACTIVE.
  async getById(projectId: string, environmentId: string): Promise<EnvironmentDetail> {
    const env = await this.prisma.environment.findFirst({ where: { environmentId, projectId } });
    if (!env) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Environment does not exist");
    }
    return this.toDetail(env);
  }

  // API-ENV-004 — ADMIN only. Single atomic PATCH covering Rename,
  // Classification, Allow Run and lifecycle. See REQ-ENV-003 Allow Run
  // transition rules in the frozen AnD: a NON_PRODUCTION -> PRODUCTION
  // classification change always forces allowRun to false regardless of any
  // allowRun submitted in the same request (safety cannot be overridden by
  // the same call that turns a environment into Production); a
  // PRODUCTION -> NON_PRODUCTION change never auto-enables allowRun on its
  // own (an explicit allowRun in the same request is still honored, since
  // "do not auto-enable" describes the classification change's own side
  // effect, not a ban on the general "Only ADMIN may mutate allowRun" path).
  // While INACTIVE, an Environment is otherwise read-only — the only
  // permitted mutation is the explicit Reactivate transition on its own.
  async update(projectId: string, environmentId: string, dto: UpdateEnvironmentDto, actorUserId: string): Promise<EnvironmentDetail> {
    if (
      dto.environmentName === undefined &&
      dto.classification === undefined &&
      dto.allowRun === undefined &&
      dto.environmentStatus === undefined
    ) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "At least one field is required");
    }

    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const existing = await tx.environment.findFirst({ where: { environmentId, projectId } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Environment does not exist");
      }

      if (existing.environmentStatus === "INACTIVE") {
        const onlyReactivating =
          dto.environmentStatus === "ACTIVE" &&
          dto.environmentName === undefined &&
          dto.classification === undefined &&
          dto.allowRun === undefined;
        if (!onlyReactivating) {
          throw new BusinessException(
            HttpStatus.CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Environment is INACTIVE; only reactivation (environmentStatus=ACTIVE, no other fields) is permitted",
          );
        }
      }

      if (dto.environmentName !== undefined) {
        const normalizedName = dto.environmentName.trim();
        const duplicate = await tx.environment.findFirst({
          where: { projectId, environmentName: { equals: normalizedName, mode: "insensitive" }, NOT: { environmentId } },
        });
        if (duplicate) {
          throw new BusinessException(HttpStatus.CONFLICT, "ENVIRONMENT_NAME_EXISTS", "An Environment with this name already exists in this Project");
        }
      }

      const classificationChanging = dto.classification !== undefined && dto.classification !== existing.classification;
      let finalAllowRun = existing.allowRun;
      if (classificationChanging && existing.classification === "NON_PRODUCTION" && dto.classification === "PRODUCTION") {
        finalAllowRun = false;
      } else if (dto.allowRun !== undefined) {
        finalAllowRun = dto.allowRun;
      }

      const data: Prisma.EnvironmentUpdateInput = {};
      const beforeData: Record<string, unknown> = {};
      const afterData: Record<string, unknown> = {};
      let changed = false;

      if (dto.environmentName !== undefined) {
        const normalizedName = dto.environmentName.trim();
        if (normalizedName !== existing.environmentName) {
          data.environmentName = normalizedName;
          beforeData.environmentName = existing.environmentName;
          afterData.environmentName = normalizedName;
          changed = true;
        }
      }
      if (dto.classification !== undefined && dto.classification !== existing.classification) {
        data.classification = dto.classification;
        beforeData.classification = existing.classification;
        afterData.classification = dto.classification;
        changed = true;
      }
      if (finalAllowRun !== existing.allowRun) {
        data.allowRun = finalAllowRun;
        beforeData.allowRun = existing.allowRun;
        afterData.allowRun = finalAllowRun;
        changed = true;
      }
      if (dto.environmentStatus !== undefined && dto.environmentStatus !== existing.environmentStatus) {
        data.environmentStatus = dto.environmentStatus;
        beforeData.environmentStatus = existing.environmentStatus;
        afterData.environmentStatus = dto.environmentStatus;
        changed = true;
      }

      let updated = existing;
      if (Object.keys(data).length > 0) {
        try {
          updated = await tx.environment.update({ where: { environmentId }, data });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new BusinessException(HttpStatus.CONFLICT, "ENVIRONMENT_NAME_EXISTS", "An Environment with this name already exists in this Project");
          }
          throw err;
        }
      }

      if (changed) {
        await this.auditWriter.record(
          {
            eventType: "ENVIRONMENT_UPDATED",
            result: "SUCCESS",
            actorUserId,
            targetType: "ENVIRONMENT",
            targetId: environmentId,
            targetDisplay: updated.environmentName,
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

  private toListItem(env: {
    environmentId: string;
    environmentName: string;
    classification: string;
    allowRun: boolean;
    environmentStatus: string;
    createdAt: Date;
    updatedAt: Date;
  }): EnvironmentListItem {
    return {
      environmentId: env.environmentId,
      environmentName: env.environmentName,
      classification: env.classification,
      allowRun: env.allowRun,
      environmentStatus: env.environmentStatus,
      createdAt: env.createdAt,
      updatedAt: env.updatedAt,
    };
  }

  private toDetail(env: {
    environmentId: string;
    projectId: string;
    environmentName: string;
    classification: string;
    allowRun: boolean;
    environmentStatus: string;
    createdAt: Date;
    updatedAt: Date;
  }): EnvironmentDetail {
    return { ...this.toListItem(env), projectId: env.projectId };
  }
}
