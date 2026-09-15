import type { ExecutionContext } from "@nestjs/common";
import { BusinessException } from "../exceptions/business.exception";
import { RolesGuard } from "./roles.guard";
import type { RequestWithUserId } from "./session.guard";

function makeContext(
  request: Partial<RequestWithUserId> & Record<string, unknown> = {},
): { context: ExecutionContext; request: RequestWithUserId } {
  const req = { headers: {}, ...request } as unknown as RequestWithUserId;
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request: req };
}

function makeGuard(allowedRoles: string[] | undefined, systemRole: string | null | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(allowedRoles) };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(systemRole === undefined ? null : { systemRole }) } };
  const guard = new RolesGuard(reflector as never, prisma as never);
  return { guard, reflector, prisma };
}

describe("RolesGuard", () => {
  it("allows ADMIN on an ADMIN-only route", async () => {
    const { guard, prisma } = makeGuard(["ADMIN"], "ADMIN");
    const { context, request } = makeContext({ userId: "admin-1" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: request.userId }, select: { systemRole: true } });
  });

  it("denies USER on an ADMIN-only route with ACCESS_DENIED", async () => {
    const { guard } = makeGuard(["ADMIN"], "USER");
    const { context } = makeContext({ userId: "user-1" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCESS_DENIED" });
  });

  it("allows USER on a route that permits both ADMIN and USER", async () => {
    const { guard } = makeGuard(["ADMIN", "USER"], "USER");
    const { context } = makeContext({ userId: "user-1" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("denies an invalid system role with INVALID_SYSTEM_ROLE", async () => {
    const { guard } = makeGuard(["ADMIN"], "SUPERUSER");
    const { context } = makeContext({ userId: "user-1" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "INVALID_SYSTEM_ROLE" });
  });

  it("denies a missing/unassigned system role with ROLE_NOT_ASSIGNED", async () => {
    const { guard } = makeGuard(["ADMIN"], null);
    const { context } = makeContext({ userId: "user-1" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ROLE_NOT_ASSIGNED" });
  });

  it("ignores any role claimed by the client and always resolves the role from the database by userId", async () => {
    const { guard, prisma } = makeGuard(["ADMIN"], "USER");
    // Simulate a client attempting to smuggle an elevated role via the
    // request body — the guard must never read this.
    const { context, request } = makeContext({ userId: "user-1", body: { systemRole: "ADMIN" } } as never);

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCESS_DENIED" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: request.userId }, select: { systemRole: true } });
  });

  it("leaves a route with no declared roles unrestricted and does not query the database", async () => {
    const { guard, prisma } = makeGuard(undefined, "USER");
    const { context } = makeContext({ userId: "user-1" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("denies when no authenticated userId is present on the request (SessionGuard did not run)", async () => {
    const { guard, prisma } = makeGuard(["ADMIN"], "ADMIN");
    const { context } = makeContext({});

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCESS_DENIED" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
