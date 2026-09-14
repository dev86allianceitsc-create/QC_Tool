import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";

export interface CurrentUserView {
  userId: string;
  email: string;
  systemRole: string;
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
}
