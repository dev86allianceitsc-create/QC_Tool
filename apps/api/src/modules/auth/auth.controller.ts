import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { BusinessException } from "../../common/exceptions/business.exception";
import { extractBearerToken } from "../../common/utils/bearer-token";
import { SessionsService } from "../sessions/sessions.service";
import { AuthService, type GoogleLoginResult } from "./auth.service";
import { GoogleLoginDto } from "./dto/google-login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post("google/login")
  @ApiOperation({ summary: "Google login (API-USR-001)" })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({ status: 200, description: "Login succeeded" })
  @ApiResponse({ status: 400, description: "EMAIL_NOT_VERIFIED" })
  @ApiResponse({ status: 401, description: "AUTHENTICATION_FAILED" })
  @ApiResponse({ status: 403, description: "ACCOUNT_INACTIVE / ACCOUNT_BLOCKED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "ACCOUNT_NOT_REGISTERED" })
  @ApiResponse({ status: 409, description: "IDENTITY_LINK_CONFLICT" })
  async googleLogin(@Body() body: GoogleLoginDto): Promise<GoogleLoginResult> {
    return this.authService.loginWithGoogle(body.authorizationCode);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout (API-USR-003) — idempotent, revokes only the current session" })
  @ApiResponse({ status: 204, description: "Logged out" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID" })
  async logout(@Req() request: Request): Promise<void> {
    const token = extractBearerToken(request);
    if (!token) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "SESSION_INVALID", "Missing or malformed Bearer credential");
    }

    const resolution = await this.sessionsService.resolveByToken(token);
    if (resolution.state === "NOT_FOUND") {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "SESSION_INVALID", "Session credential is invalid");
    }
    if (resolution.state === "ACTIVE") {
      await this.sessionsService.revoke(resolution.session.sessionId);
    }
    // EXPIRED/REVOKED: no DB write, logout still succeeds (idempotent).
  }
}
