import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isEmail } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { normalizeEmail } from "../../common/utils/email";

export interface CurrentUserView {
  userId: string;
  email: string;
  systemRole: string;
  accountStatus: string;
}

// Response shape per API-USR-005 §6.4 — intentionally omits systemRole and
// googleSubjectId, since this endpoint neither reads nor changes them.
export interface UpdatedInvitedUserView {
  userId: string;
  email: string;
  accountStatus: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Reloads the User row fresh — never trusts anything cached on the
  // request/session — and re-checks accountStatus independently of session
  // validity, since status can change after a session was already issued.
  async getCurrentUser(userId: string): Promise<CurrentUserView> {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) {
      // FK user_sessions.user_id -> users.user_id is ON DELETE RESTRICT, so a
      // valid session can't outlive its user. Unreachable in practice.
      throw new Error(`Session referenced non-existent user ${userId}`);
    }
    if (user.accountStatus !== "ACTIVE") {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_ALLOWED", "Account is not allowed to access this resource");
    }
    return {
      userId: user.userId,
      email: user.email,
      systemRole: user.systemRole,
      accountStatus: user.accountStatus,
    };
  }

  // API-USR-005 — Admin-only edit of an INVITED user's email (REQ-USR-008).
  // Authorization (caller must be ADMIN) is enforced upstream by
  // SessionGuard + RolesGuard on the route; this method only enforces the
  // target-user business rules and touches nothing but `email`.
  async updateInvitedUserEmail(targetUserId: string, rawEmail: string): Promise<UpdatedInvitedUserView> {
    // Syntactic validation of userId (UUID format) happens at the controller
    // boundary (ParseUUIDPipe) per API Design Standard §12 — this method can
    // assume targetUserId is a syntactically valid UUID and only needs to
    // check existence.
    const target = await this.prisma.user.findUnique({ where: { userId: targetUserId } });
    if (!target) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Target user does not exist");
    }
    if (target.accountStatus !== "INVITED") {
      throw new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_NOT_INVITED", "Target account is no longer INVITED");
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    if (!isEmail(normalizedEmail)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_EMAIL_FORMAT", "Email format is invalid");
    }

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.userId !== targetUserId) {
      throw new BusinessException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Email is already in use by another account");
    }

    try {
      const updated = await this.prisma.user.update({
        where: { userId: targetUserId },
        data: { email: normalizedEmail },
      });
      return {
        userId: updated.userId,
        email: updated.email,
        accountStatus: updated.accountStatus,
      };
    } catch (error) {
      // Final integrity backstop for a concurrent request that slipped past
      // the pre-check above — the DB unique constraint on `email` is the
      // actual source of truth here, this only translates its violation
      // into the same business error code the pre-check uses.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Email is already in use by another account");
      }
      throw error;
    }
  }
}
