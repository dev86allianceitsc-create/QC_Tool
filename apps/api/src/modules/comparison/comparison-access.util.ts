import { isUUID } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";

// Mirrors ProjectAccessGuard's own membership check (common/guards/project-access.guard.ts)
// but returns a boolean instead of throwing. Used by the bare comparisonId/
// comparisonChainId access guards, which must check one or more Project
// scopes derived from a resolved resource rather than a single :projectId
// path param, so they cannot reuse ProjectAccessGuard directly.
export async function hasProjectAccess(prisma: PrismaService, userId: string, projectId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { userId }, select: { systemRole: true } });
  if (!user) {
    return false;
  }
  if (user.systemRole === "ADMIN") {
    return true;
  }
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { userId: true },
  });
  return !!membership;
}

// comparisonId/comparisonChainId columns are native Postgres uuid
// (@db.Uuid) — a malformed string reaching a Prisma `where` on them throws
// PrismaClientValidationError rather than a clean 404/empty result. Guards
// run before ParseUUIDPipe (Nest's Guards phase precedes its Pipes phase), so
// each bare-ID guard must validate the format itself before querying.
export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && isUUID(value);
}
