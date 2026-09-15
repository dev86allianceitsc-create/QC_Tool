import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../exceptions/business.exception";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { RequestWithUserId } from "./session.guard";

const VALID_SYSTEM_ROLES = new Set(["ADMIN", "USER"]);

// Authorization only — kept separate from authentication (SessionGuard).
// Must run after SessionGuard on the same route, since it relies on
// request.userId already having been set from a validated session.
//
// The allowed-role check re-reads systemRole from the database by that
// userId on every request; it never reads a role from the client (body,
// query, header). Routes with no @Roles(...) metadata are left unrestricted
// by this guard (opt-in per route/controller via @Roles(...)).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUserId>();
    const userId = request.userId;
    if (!userId) {
      // SessionGuard is expected to run first and set this. Its absence
      // means identity was never authenticated for this request — fail
      // closed rather than trusting any other source.
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Unable to resolve authenticated user");
    }

    const user = await this.prisma.user.findUnique({ where: { userId }, select: { systemRole: true } });
    if (!user) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Unable to resolve authenticated user");
    }

    const role = user.systemRole;
    if (!role) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ROLE_NOT_ASSIGNED", "User has no assigned system role");
    }
    if (!VALID_SYSTEM_ROLES.has(role)) {
      // Defensive — the DB CHECK constraint (ck_users_system_role) already
      // guarantees this in practice.
      throw new BusinessException(HttpStatus.FORBIDDEN, "INVALID_SYSTEM_ROLE", "User has an invalid system role");
    }
    if (!allowedRoles.includes(role)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "User's role is not permitted to access this resource");
    }

    return true;
  }
}
