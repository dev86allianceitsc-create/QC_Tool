import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../exceptions/business.exception";
import { AuditWriterService } from "../../modules/audit/audit-writer.service";
import type { RequestWithUserId } from "./session.guard";

// Project-level authorization (REQ-PRJ-003): a reusable guard for any route
// with a :projectId param that Admin and member Users may both reach (e.g.
// PRJ-003 get project, PRJ-006 list members). Must run after SessionGuard,
// since it relies on request.userId already having been set.
//
// Like RolesGuard, this never trusts client-declared role or membership: it
// re-reads systemRole and, for non-admins, the project_memberships row fresh
// from the database on every request (AC-PRJ-003-03/05/08) — an ADMIN bypasses
// the membership check entirely (AC-PRJ-003-07); a USER without a current
// membership is denied even if the projectId is otherwise valid, and access
// is revoked immediately once their membership row is removed, with no
// re-login required (AC-PRJ-003-05).
//
// Existence/soft-delete of the project itself is NOT checked here — that
// stays the responsibility of the route's service layer (404 vs 403 needs
// business-specific handling), so this guard only decides membership-based
// ALLOW/DENY.
//
// A membership-miss also writes a PROJECT_ACCESS_DENIED/DENIED audit row
// (REQ-SEC-001, AnD Section 13: "Authorization denied events ... are written
// by the backend audit mechanism"). The two "unable to resolve authenticated
// user" branches above are not audited — they're pre-authentication edge
// cases with no resolvable actor, not the membership-denial case the AnD
// describes.
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUserId & { params: Record<string, string> }>();
    const userId = request.userId;
    if (!userId) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Unable to resolve authenticated user");
    }

    const projectId = request.params.projectId;

    const user = await this.prisma.user.findUnique({ where: { userId }, select: { systemRole: true } });
    if (!user) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Unable to resolve authenticated user");
    }

    if (user.systemRole === "ADMIN") {
      return true;
    }

    const membership = await this.prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { userId: true },
    });
    if (!membership) {
      await this.auditWriter.record({
        eventType: "PROJECT_ACCESS_DENIED",
        result: "DENIED",
        actorUserId: userId,
        targetType: "PROJECT",
        targetId: projectId,
        projectId,
      });
      throw new BusinessException(
        HttpStatus.FORBIDDEN,
        "PROJECT_ACCESS_DENIED",
        "User does not have current membership in this project",
      );
    }

    return true;
  }
}
