import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionsService } from "../../modules/sessions/sessions.service";
import { BusinessException } from "../exceptions/business.exception";
import { extractBearerToken } from "../utils/bearer-token";

export interface RequestWithUserId extends Request {
  userId?: string;
}

// Authentication guard: validates the session credential itself (existence,
// expiry, revocation) AND, per REQ-USR-007 BR-USR-007-10, that the session's
// owning account is still ACTIVE — re-read fresh from the DB on every
// request, never from session-cached state or client input. An otherwise
// still-valid session must stop working the moment its account becomes
// INACTIVE/BLOCKED. Role authorization stays separate — see RolesGuard.
// Logout has its own idempotent handling and does not use this guard — see
// AuthController.logout.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUserId>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "SESSION_INVALID", "Missing or malformed Bearer credential");
    }

    const resolution = await this.sessionsService.resolveByToken(token);
    switch (resolution.state) {
      case "NOT_FOUND":
        throw new BusinessException(HttpStatus.UNAUTHORIZED, "SESSION_INVALID", "Session credential is invalid");
      case "EXPIRED":
        throw new BusinessException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED", "Session has expired");
      case "REVOKED":
        throw new BusinessException(HttpStatus.UNAUTHORIZED, "SESSION_REVOKED", "Session has been revoked");
      case "ACTIVE": {
        const { userId } = resolution.session;
        const user = await this.prisma.user.findUnique({ where: { userId }, select: { accountStatus: true } });
        if (!user || user.accountStatus !== "ACTIVE") {
          throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_ALLOWED", "Account is not allowed to access this resource");
        }
        request.userId = userId;
        return true;
      }
    }
  }
}
