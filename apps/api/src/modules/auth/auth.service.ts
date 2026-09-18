import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { User, UserSession } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { normalizeEmail } from "../../common/utils/email";
import { computeExpiresAt, SessionsService } from "../sessions/sessions.service";
import { AuditWriterService } from "../audit/audit-writer.service";
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

// Fixed, arbitrary key for a Postgres session-scoped advisory lock
// (pg_advisory_xact_lock) — see tryBootstrapFirstAdmin. Any stable int8 works;
// this one has no meaning beyond "the First Admin Bootstrap critical section".
const FIRST_ADMIN_BOOTSTRAP_LOCK_KEY = 91_1001n;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
    private readonly googleIdentityService: GoogleIdentityService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async loginWithGoogle(authorizationCode: string): Promise<GoogleLoginResult> {
    const identity = await this.exchangeIdentity(authorizationCode);

    if (!identity.emailVerified) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "EMAIL_NOT_VERIFIED", "Google email is not verified");
    }

    const normalizedEmail = normalizeEmail(identity.email);
    const user = await this.findUser(identity.sub, normalizedEmail);

    let activeUser: User;
    let session: UserSession;
    if (!user) {
      // FR-USR-001-23 / REQ-USR-001 First Admin Bootstrap: only reachable
      // when no existing account matches by subject id or email. Eligibility
      // is re-checked inside the transaction (users.count == 0), never
      // admin count == 0, and is concurrency-safe (advisory transaction lock).
      const bootstrapped = await this.tryBootstrapFirstAdmin(identity.sub, normalizedEmail);
      if (!bootstrapped) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_REGISTERED", "No pre-registered account found for this identity");
      }
      ({ user: activeUser, session } = bootstrapped);
    } else if (!user.googleSubjectId) {
      ({ user: activeUser, session } = await this.linkFirstLogin(user, identity.sub));
    } else {
      this.assertAccountUsable(user);
      activeUser = await this.syncEmailIfChanged(user, normalizedEmail);
      session = await this.sessionsService.create(activeUser.userId);
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

  private async findUser(googleSubjectId: string, normalizedEmail: string): Promise<User | null> {
    const user =
      (await this.prisma.user.findUnique({ where: { googleSubjectId } })) ??
      (await this.prisma.user.findUnique({ where: { email: normalizedEmail } }));

    if (user && user.googleSubjectId && user.googleSubjectId !== googleSubjectId) {
      throw new BusinessException(HttpStatus.CONFLICT, "IDENTITY_LINK_CONFLICT", "Account is already linked to a different Google identity");
    }
    return user;
  }

  // First Admin Bootstrap (REQ-USR-001 FR-USR-001-23, CONFIRMED business rule
  // change): when the users table is completely empty, the first verified
  // Google identity to log in becomes the first ACTIVE ADMIN automatically.
  // Eligibility is users.count == 0, never admin count == 0 — once any User
  // exists, this never runs again, regardless of whether an ADMIN exists.
  //
  // Concurrency: two simultaneous first-logins against an empty table must
  // not both bootstrap. A Postgres transaction-scoped advisory lock
  // (pg_advisory_xact_lock) serializes all bootstrap attempts on a fixed key
  // — the second caller blocks until the first commits/rolls back, then
  // re-reads users.count and (now > 0) safely returns null instead of
  // creating a second ADMIN. The lock is released automatically at
  // transaction end; no schema/migration change is required.
  private async tryBootstrapFirstAdmin(
    googleSubjectId: string,
    normalizedEmail: string,
  ): Promise<{ user: User; session: UserSession } | null> {
    const createdAt = new Date();
    const expiresAt = computeExpiresAt(createdAt);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FIRST_ADMIN_BOOTSTRAP_LOCK_KEY})`;

      const userCount = await tx.user.count();
      if (userCount > 0) {
        return null;
      }

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          googleSubjectId,
          systemRole: "ADMIN",
          accountStatus: "ACTIVE",
          activatedAt: createdAt,
        },
      });
      const session = await tx.userSession.create({
        data: { userId: user.userId, createdAt, expiresAt },
      });

      await this.auditWriter.record(
        {
          eventType: "FIRST_ADMIN_BOOTSTRAP",
          result: "SUCCESS",
          actorUserId: user.userId,
          actorDisplay: user.email,
          targetType: "USER",
          targetId: user.userId,
          targetDisplay: user.email,
          detail: "First verified Google login on an empty users table; auto-provisioned as the first ACTIVE ADMIN",
        },
        tx,
      );

      return { user, session };
    });
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

  // FR-USR-001-21 / BR-USR-001-18 / SF-07: on a returning login with a
  // matching Google Subject ID, re-sync the stored email if Google now
  // reports a different (already-verified) address. Per FR-USR-001-22 /
  // SF-07, if that email already belongs to a different account, the whole
  // login is rejected — no auto-merge, no relink, no session created.
  private async syncEmailIfChanged(user: User, normalizedEmail: string): Promise<User> {
    if (user.email === normalizedEmail) {
      return user;
    }

    const conflictingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (conflictingUser && conflictingUser.userId !== user.userId) {
      throw new BusinessException(HttpStatus.CONFLICT, "IDENTITY_LINK_CONFLICT", "Email is already used by a different account");
    }

    try {
      return await this.prisma.user.update({ where: { userId: user.userId }, data: { email: normalizedEmail } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessException(HttpStatus.CONFLICT, "IDENTITY_LINK_CONFLICT", "Email is already used by a different account");
      }
      throw error;
    }
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
