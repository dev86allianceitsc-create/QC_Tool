import type { ExecutionContext } from "@nestjs/common";
import { BusinessException } from "../exceptions/business.exception";
import { ProjectAccessGuard } from "./project-access.guard";
import type { RequestWithUserId } from "./session.guard";

function makeContext(
  request: Partial<RequestWithUserId> & { params?: Record<string, string> } = {},
): { context: ExecutionContext; request: RequestWithUserId & { params: Record<string, string> } } {
  const req = { headers: {}, params: {}, ...request } as unknown as RequestWithUserId & { params: Record<string, string> };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { context, request: req };
}

function makeGuard(systemRole: string | null | undefined, membership: { userId: string } | null) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(systemRole === undefined ? null : { systemRole }) },
    projectMembership: { findUnique: jest.fn().mockResolvedValue(membership) },
  };
  const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
  const guard = new ProjectAccessGuard(prisma as never, auditWriter as never);
  return { guard, prisma, auditWriter };
}

describe("ProjectAccessGuard", () => {
  it("allows an ADMIN caller without checking membership", async () => {
    const { guard, prisma } = makeGuard("ADMIN", null);
    const { context } = makeContext({ userId: "admin-1", params: { projectId: "p-1" } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.projectMembership.findUnique).not.toHaveBeenCalled();
  });

  it("allows a USER caller who has a current membership in the project", async () => {
    const { guard, prisma } = makeGuard("USER", { userId: "user-1" });
    const { context } = makeContext({ userId: "user-1", params: { projectId: "p-1" } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.projectMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_projectId: { userId: "user-1", projectId: "p-1" } },
      select: { userId: true },
    });
  });

  it("denies a USER caller with no membership in the project, with PROJECT_ACCESS_DENIED, and audits a DENIED event", async () => {
    const { guard, auditWriter } = makeGuard("USER", null);
    const { context } = makeContext({ userId: "user-1", params: { projectId: "p-1" } });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "PROJECT_ACCESS_DENIED" });
    expect(auditWriter.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PROJECT_ACCESS_DENIED",
        result: "DENIED",
        actorUserId: "user-1",
        projectId: "p-1",
      }),
    );
  });

  it("denies when no authenticated userId is present on the request, without auditing (no resolvable actor)", async () => {
    const { guard, prisma, auditWriter } = makeGuard("ADMIN", null);
    const { context } = makeContext({ params: { projectId: "p-1" } });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCESS_DENIED" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(auditWriter.record).not.toHaveBeenCalled();
  });

  it("denies when the caller's user record cannot be resolved from the database, without auditing (no resolvable actor)", async () => {
    const { guard, auditWriter } = makeGuard(undefined, null);
    const { context } = makeContext({ userId: "ghost-1", params: { projectId: "p-1" } });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCESS_DENIED" });
    expect(auditWriter.record).not.toHaveBeenCalled();
  });

  it("never trusts a client-claimed role and always resolves systemRole from the database by userId", async () => {
    const { guard, prisma } = makeGuard("USER", null);
    const { context } = makeContext({
      userId: "user-1",
      params: { projectId: "p-1" },
      body: { systemRole: "ADMIN" },
    } as never);

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" }, select: { systemRole: true } });
  });
});
