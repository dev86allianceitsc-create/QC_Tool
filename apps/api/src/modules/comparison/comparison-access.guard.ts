import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { BusinessException } from "../../common/exceptions/business.exception";
import type { RequestWithUserId } from "../../common/guards/session.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { hasProjectAccess, isValidUuid } from "./comparison-access.util";

// Group 6/7 Comparison bare-ID routes (`/comparisons/:comparisonId/...`) have
// no :projectId in their path, so ProjectAccessGuard cannot apply. A
// Comparison's own projectId/apiId/environmentId columns only reflect
// Snapshot A's scope (RS-CMP-016-01) — a CONTEXT_MISMATCH-blocked pair can
// legitimately span two different Projects — so REQ-CMP-016's "check
// permission for BOTH Snapshot A and B before returning any reason" requires
// checking access to both baselineSnapshot's and targetSnapshot's Project
// here. Any failure (Comparison not found, or access denied to either side)
// collapses to the same 404 NOT_FOUND — never 403 — so a cross-project actor
// can never distinguish "does not exist" from "exists but I can't see it"
// (AnD API §2.1: "cross-project không lộ thông tin qua reason").
@Injectable()
export class ComparisonAccessGuard implements CanActivate {
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

    const comparisonId = request.params.comparisonId;
    if (!isValidUuid(comparisonId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "comparisonId must be a UUID");
    }

    const comparison = await this.prisma.comparison.findUnique({
      where: { comparisonId },
      select: {
        baselineSnapshot: { select: { projectId: true } },
        targetSnapshot: { select: { projectId: true } },
      },
    });

    const [baselineAccess, targetAccess] = comparison
      ? await Promise.all([
          hasProjectAccess(this.prisma, userId, comparison.baselineSnapshot.projectId),
          hasProjectAccess(this.prisma, userId, comparison.targetSnapshot.projectId),
        ])
      : [false, false];

    if (!comparison || !baselineAccess || !targetAccess) {
      await this.auditWriter.record({
        eventType: "COMPARISON_ACCESS_DENIED",
        result: "DENIED",
        actorUserId: userId,
        targetType: "COMPARISON",
        targetId: comparisonId,
      });
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comparison does not exist");
    }

    return true;
  }
}
