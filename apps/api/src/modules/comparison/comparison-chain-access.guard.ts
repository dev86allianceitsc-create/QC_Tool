import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { BusinessException } from "../../common/exceptions/business.exception";
import type { RequestWithUserId } from "../../common/guards/session.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { hasProjectAccess, isValidUuid } from "./comparison-access.util";

// Group 6/7 `/comparison-chains/:comparisonChainId` has no :projectId in its
// path either, but unlike Comparison, ComparisonChain owns a single
// authoritative projectId (both chain endpoints are required to share one
// Project/API/Environment/auth context — CMP-004-07/10), so only one access
// check is needed. Same 404-collapse convention as ComparisonAccessGuard:
// missing chain and denied access are indistinguishable to the caller.
@Injectable()
export class ComparisonChainAccessGuard implements CanActivate {
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

    const comparisonChainId = request.params.comparisonChainId;
    if (!isValidUuid(comparisonChainId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "comparisonChainId must be a UUID");
    }

    const chain = await this.prisma.comparisonChain.findUnique({
      where: { comparisonChainId },
      select: { projectId: true },
    });

    const access = chain ? await hasProjectAccess(this.prisma, userId, chain.projectId) : false;
    if (!chain || !access) {
      await this.auditWriter.record({
        eventType: "COMPARISON_ACCESS_DENIED",
        result: "DENIED",
        actorUserId: userId,
        targetType: "COMPARISON_CHAIN",
        targetId: comparisonChainId,
      });
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comparison chain does not exist");
    }

    return true;
  }
}
