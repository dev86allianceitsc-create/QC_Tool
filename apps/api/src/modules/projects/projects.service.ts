import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import type { PagedResult } from "../audit/audit-query.service";

export interface ProjectListItem {
  projectId: string;
  projectName: string;
  description: string | null;
  projectStatus: string;
}

export interface ProjectDetail extends ProjectListItem {
  createdAt: Date;
  updatedAt: Date;
}

const PROJECT_STATUS_VALUES = new Set(["ACTIVE", "INACTIVE"]);

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-PRJ-001 — ADMIN sees every non-soft-deleted project; USER sees only
  // projects where a current project_memberships row exists for them
  // (REQ-PRJ-003). Membership/role are never taken from client input — the
  // caller's role and userId are resolved upstream by SessionGuard/RolesGuard
  // from the authenticated session, then passed in here.
  async list(query: ListProjectsQueryDto, callerUserId: string, isAdmin: boolean): Promise<PagedResult<ProjectListItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.ProjectWhereInput = { deletedAt: null };
    if (query.search) {
      where.projectName = { contains: query.search, mode: "insensitive" };
    }
    if (query.status) {
      where.projectStatus = query.status;
    }
    if (!isAdmin) {
      where.memberships = { some: { userId: callerUserId } };
    }

    const [rows, totalItems] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: { projectId: true, projectName: true, description: true, projectStatus: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: rows,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  // API-PRJ-002 — Admin only (enforced upstream by RolesGuard). New projects
  // always start ACTIVE (Initial Business Value, not a SQL default — Database
  // AnD Section 4 Notes); project names may duplicate, so there is no
  // uniqueness check.
  async create(dto: CreateProjectDto, actorUserId: string): Promise<ProjectDetail> {
    const projectName = dto.projectName.trim();
    if (!projectName) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "projectName must not be blank");
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          projectName,
          description: dto.description ?? null,
          projectStatus: "ACTIVE",
        },
      });

      await this.auditWriter.record(
        {
          eventType: "PROJECT_CREATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "PROJECT",
          targetId: created.projectId,
          targetDisplay: created.projectName,
          projectId: created.projectId,
          afterData: { projectName: created.projectName, description: created.description, projectStatus: created.projectStatus },
        },
        tx,
      );

      return this.toDetail(created);
    });
  }

  // API-PRJ-003 — Membership/role access itself is enforced by
  // ProjectAccessGuard at the route level; this only enforces existence and
  // the soft-delete boundary (a soft-deleted project is 404, not visible via
  // membership or admin access alike).
  async getById(projectId: string): Promise<ProjectDetail> {
    const project = await this.prisma.project.findFirst({ where: { projectId, deletedAt: null } });
    if (!project) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
    }
    return this.toDetail(project);
  }

  // API-PRJ-004 — Admin only. Handles both name/description edits and the
  // ACTIVE<->INACTIVE lifecycle transition in the same PATCH (no separate
  // activate/deactivate endpoint). At least one supported field must be
  // present; a status value equal to the current one is a no-op for audit
  // purposes (still a valid, idempotent PATCH).
  async update(projectId: string, dto: UpdateProjectDto, actorUserId: string): Promise<ProjectDetail> {
    if (dto.projectName === undefined && dto.description === undefined && dto.projectStatus === undefined) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "At least one of projectName, description, projectStatus is required");
    }
    if (dto.projectName !== undefined && dto.projectName.trim().length === 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "projectName must not be blank");
    }
    if (dto.projectStatus !== undefined && !PROJECT_STATUS_VALUES.has(dto.projectStatus)) {
      throw new BusinessException(HttpStatus.CONFLICT, "CONFLICT", "Invalid project status transition");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({ where: { projectId, deletedAt: null } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
      }

      const data: Prisma.ProjectUpdateInput = {};
      const beforeData: Record<string, unknown> = {};
      const afterData: Record<string, unknown> = {};
      let contentChanged = false;

      if (dto.projectName !== undefined) {
        const trimmed = dto.projectName.trim();
        if (trimmed !== existing.projectName) {
          data.projectName = trimmed;
          beforeData.projectName = existing.projectName;
          afterData.projectName = trimmed;
          contentChanged = true;
        }
      }
      if (dto.description !== undefined) {
        if (dto.description !== existing.description) {
          data.description = dto.description;
          beforeData.description = existing.description;
          afterData.description = dto.description;
          contentChanged = true;
        }
      }

      const statusChanged = dto.projectStatus !== undefined && dto.projectStatus !== existing.projectStatus;
      if (statusChanged) {
        data.projectStatus = dto.projectStatus;
      }

      const updated = Object.keys(data).length > 0 ? await tx.project.update({ where: { projectId }, data }) : existing;

      if (contentChanged) {
        await this.auditWriter.record(
          {
            eventType: "PROJECT_UPDATED",
            result: "SUCCESS",
            actorUserId,
            targetType: "PROJECT",
            targetId: projectId,
            targetDisplay: updated.projectName,
            projectId,
            beforeData,
            afterData,
          },
          tx,
        );
      }
      if (statusChanged) {
        await this.auditWriter.record(
          {
            eventType: dto.projectStatus === "ACTIVE" ? "PROJECT_ACTIVATED" : "PROJECT_DEACTIVATED",
            result: "SUCCESS",
            actorUserId,
            targetType: "PROJECT",
            targetId: projectId,
            targetDisplay: updated.projectName,
            projectId,
            beforeData: { projectStatus: existing.projectStatus },
            afterData: { projectStatus: dto.projectStatus },
          },
          tx,
        );
      }

      return this.toDetail(updated);
    });
  }

  // API-PRJ-005 — Admin only. Soft delete only; rejects an already-deleted
  // or absent project as 404 (Database AnD Section 13: no deleted_by column
  // — the delete actor is traced through audit_logs instead).
  async softDelete(projectId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({ where: { projectId, deletedAt: null } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
      }

      await tx.project.update({ where: { projectId }, data: { deletedAt: new Date() } });

      await this.auditWriter.record(
        {
          eventType: "PROJECT_SOFT_DELETED",
          result: "SUCCESS",
          actorUserId,
          targetType: "PROJECT",
          targetId: projectId,
          targetDisplay: existing.projectName,
          projectId,
        },
        tx,
      );
    });
  }

  private toDetail(project: { projectId: string; projectName: string; description: string | null; projectStatus: string; createdAt: Date; updatedAt: Date }): ProjectDetail {
    return {
      projectId: project.projectId,
      projectName: project.projectName,
      description: project.description,
      projectStatus: project.projectStatus,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
