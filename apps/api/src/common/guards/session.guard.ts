import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { SessionsService } from "../../modules/sessions/sessions.service";
import { BusinessException } from "../exceptions/business.exception";
import { extractBearerToken } from "../utils/bearer-token";

export interface RequestWithUserId extends Request {
  userId?: string;
}

// Strict guard for endpoints that must reject non-ACTIVE sessions (e.g.
// GET /users/me). Logout has its own idempotent handling and does not use
// this guard — see AuthController.logout.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

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
      case "ACTIVE":
        request.userId = resolution.session.userId;
        return true;
    }
  }
}
