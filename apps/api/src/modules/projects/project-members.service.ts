import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isEmail } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { normalizeEmail } from "../../common/utils/email";
import { AuditWriterService } from "../audit/audit-writer.service";
import type { PagedResult } from "../audit/audit-query.service";
import { AddMemberDto } from "./dto/add-member.dto";
import { ListMembersQueryDto } from "./dto/list-members-query.dto";

export interface ProjectMemberView {
  userId: string;
  email: string;
  systemRole: string;
  accountStatus: string;
}

const ELIGIBLE_ACCOUNT_STATUSES = new Set(["ACTIVE", "INVITED"]);

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-PRJ-006 — Admin or member User (membership enforced by
  // ProjectAccessGuard at the route). Only enforces the project's own
  // existence/soft-delete boundary here.
  async list(projectId: string, query: ListMembersQueryDto): Promise<PagedResult<ProjectMemberView>> {
    await this.requireActiveProject(projectId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProjectMembershipWhereInput = {
      projectId,
      user: {
        ...(query.search ? { email: { contains: query.search, mode: "insensitive" } } : {}),
        ...(query.accountStatus ? { accountStatus: query.accountStatus } : {}),
      },
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.projectMembership.findMany({
        where,
        select: { user: { select: { userId: true, email: true, systemRole: true, accountStatus: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.projectMembership.count({ where }),
    ]);

    return {
      items: rows.map((row) => row.user),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  // API-PRJ-007 — Admin only. Resolve-or-create the target user and create
  // the membership atomically (REQ-PRJ-002 SF-06/SF-07: no partial state) —
  // a P2002 on the membership's composite PK is the concurrency backstop for
  // a duplicate add racing this same check, translated to the same
  // CONFLICT the pre-check would have raised.
  async addMember(projectId: string, dto: AddMemberDto, actorUserId: string): Promise<ProjectMemberView> {
    const normalizedEmail = normalizeEmail(dto.email);
    if (!isEmail(normalizedEmail)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Email format is invalid");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.findFirst({ where: { projectId, deletedAt: null } });
        if (!project) {
          throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
        }

        let user = await tx.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
          user = await tx.user.create({
            data: { email: normalizedEmail, systemRole: "USER", accountStatus: "INVITED" },
          });
        } else if (!ELIGIBLE_ACCOUNT_STATUSES.has(user.accountStatus)) {
          throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "MEMBER_NOT_ELIGIBLE", "Target account is not eligible for project membership");
        }

        const existingMembership = await tx.projectMembership.findUnique({
          where: { userId_projectId: { userId: user.userId, projectId } },
        });
        if (existingMembership) {
          throw new BusinessException(HttpStatus.CONFLICT, "CONFLICT", "User is already a member of this project");
        }

        await tx.projectMembership.create({ data: { userId: user.userId, projectId } });

        await this.auditWriter.record(
          {
            eventType: "PROJECT_MEMBER_ADDED",
            result: "SUCCESS",
            actorUserId,
            targetType: "USER",
            targetId: user.userId,
            targetDisplay: user.email,
            projectId,
            afterData: { userId: user.userId, email: user.email, accountStatus: user.accountStatus },
          },
          tx,
        );

        return { userId: user.userId, email: user.email, systemRole: user.systemRole, accountStatus: user.accountStatus };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessException(HttpStatus.CONFLICT, "CONFLICT", "User is already a member of this project");
      }
      throw error;
    }
  }

  // API-PRJ-008 — Admin only. Hard-deletes only the membership row; the
  // target user's account/role/other memberships are never touched.
  async removeMember(projectId: string, userId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireActiveProject(projectId, tx);

      const membership = await tx.projectMembership.findUnique({
        where: { userId_projectId: { userId, projectId } },
        include: { user: { select: { email: true } } },
      });
      if (!membership) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Membership does not exist");
      }

      await tx.projectMembership.delete({ where: { userId_projectId: { userId, projectId } } });

      await this.auditWriter.record(
        {
          eventType: "PROJECT_MEMBER_REMOVED",
          result: "SUCCESS",
          actorUserId,
          targetType: "USER",
          targetId: userId,
          targetDisplay: membership.user.email,
          projectId,
        },
        tx,
      );
    });
  }

  private async requireActiveProject(projectId: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    const project = await tx.project.findFirst({ where: { projectId, deletedAt: null }, select: { projectId: true } });
    if (!project) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
    }
  }
}
