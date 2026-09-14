import { HttpStatus, Injectable } from "@nestjs/common";
import type { User, UserSession } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { computeExpiresAt, SessionsService } from "../sessions/sessions.service";
import { GoogleIdentityService } from "./google-identity.service";

export interface GoogleLoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: {
    userId: string;
    email: string;
    systemRole: string;
    accountStatus: string;
  };
}

const VALID_SYSTEM_ROLES = new Set(["ADMIN", "USER"]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
    private readonly googleIdentityService: GoogleIdentityService,
  ) {}

  async loginWithGoogle(authorizationCode: string): Promise<GoogleLoginResult> {
    const identity = await this.exchangeIdentity(authorizationCode);

    if (!identity.emailVerified) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "EMAIL_NOT_VERIFIED", "Google email is not verified");
    }

    const normalizedEmail = normalizeEmail(identity.email);
    const user = await this.resolveUser(identity.sub, normalizedEmail);

    let activeUser: User;
    let session: UserSession;
    if (!user.googleSubjectId) {
      ({ user: activeUser, session } = await this.linkFirstLogin(user, identity.sub));
    } else {
      this.assertAccountUsable(user);
      activeUser = user;
      session = await this.sessionsService.create(user.userId);
    }

    this.assertValidSystemRole(activeUser);

    return {
      accessToken: session.sessionId,
      tokenType: "Bearer",
      expiresAt: session.expiresAt.toISOString(),
      user: {
        userId: activeUser.userId,
        email: activeUser.email,
        systemRole: activeUser.systemRole,
        accountStatus: activeUser.accountStatus,
      },
    };
  }

  private async exchangeIdentity(authorizationCode: string) {
    try {
      return await this.googleIdentityService.exchange(authorizationCode);
    } catch {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", "Google authentication failed");
    }
  }

  private async resolveUser(googleSubjectId: string, normalizedEmail: string): Promise<User> {
    const user =
      (await this.prisma.user.findUnique({ where: { googleSubjectId } })) ??
      (await this.prisma.user.findUnique({ where: { email: normalizedEmail } }));

    if (!user) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_REGISTERED", "No pre-registered account found for this identity");
    }
    if (user.googleSubjectId && user.googleSubjectId !== googleSubjectId) {
      throw new BusinessException(HttpStatus.CONFLICT, "IDENTITY_LINK_CONFLICT", "Account is already linked to a different Google identity");
    }
    return user;
  }

  // First-time linking: the user is pre-registered but unlinked. Only
  // INVITED accounts are eligible; link + activate + create the session
  // atomically so a partial link-without-session (or vice versa) is
  // impossible.
  private async linkFirstLogin(user: User, googleSubjectId: string): Promise<{ user: User; session: UserSession }> {
    if (user.accountStatus !== "INVITED") {
      // Anomalous given the confirmed lifecycle (unlinked + non-INVITED
      // shouldn't occur) — reject rather than silently linking outside the
      // INVITED stage.
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", "Account is not eligible for first-time Google linking");
    }

    const createdAt = new Date();
    const activatedAt = createdAt;
    const expiresAt = computeExpiresAt(createdAt);

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { userId: user.userId },
        data: { googleSubjectId, accountStatus: "ACTIVE", activatedAt },
      });
      const session = await tx.userSession.create({
        data: { userId: updatedUser.userId, createdAt, expiresAt },
      });
      return { user: updatedUser, session };
    });
  }

  private assertAccountUsable(user: User): void {
    if (user.accountStatus === "ACTIVE") {
      return;
    }
    if (user.accountStatus === "INACTIVE") {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_INACTIVE", "Account is inactive");
    }
    if (user.accountStatus === "BLOCKED") {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_BLOCKED", "Account is blocked");
    }
    // Defensive fallback for any value outside the confirmed domain — the DB
    // CHECK constraint (ck_users_account_status) already guarantees this in
    // practice, so this is practically unreachable.
    throw new BusinessException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", "Account status does not allow login");
  }

  private assertValidSystemRole(user: User): void {
    if (!VALID_SYSTEM_ROLES.has(user.systemRole)) {
      // Defensive — the DB CHECK constraint (ck_users_system_role) already
      // guarantees this in practice.
      throw new BusinessException(HttpStatus.FORBIDDEN, "INVALID_SYSTEM_ROLE", "User has an invalid system role");
    }
  }
}
