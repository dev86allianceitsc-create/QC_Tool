import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

// Declares which System Roles may access a route/controller. Enforced by
// RolesGuard, which resolves the caller's actual role from the database by
// the authenticated userId — this decorator only records the allow-list, it
// does not itself check anything. Routes without @Roles(...) are left
// unrestricted by RolesGuard (authentication via SessionGuard still applies
// separately).
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
