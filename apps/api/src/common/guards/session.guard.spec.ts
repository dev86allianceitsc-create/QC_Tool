import type { ExecutionContext } from "@nestjs/common";
import { BusinessException } from "../exceptions/business.exception";
import { SessionGuard, type RequestWithUserId } from "./session.guard";

function makeContext(headers: Record<string, string | undefined>): { context: ExecutionContext; request: RequestWithUserId } {
  const request = { headers, userId: undefined } as unknown as RequestWithUserId;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function makePrisma(accountStatus: string | null | undefined) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(accountStatus === undefined ? null : { accountStatus }),
    },
  };
}

describe("SessionGuard", () => {
  it("rejects a missing Bearer credential with SESSION_INVALID", async () => {
    const sessionsService = { resolveByToken: jest.fn() };
    const prisma = makePrisma("ACTIVE");
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context } = makeContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(BusinessException);
    expect(sessionsService.resolveByToken).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a malformed/unknown credential with SESSION_INVALID", async () => {
    const sessionsService = { resolveByToken: jest.fn().mockResolvedValue({ state: "NOT_FOUND" }) };
    const prisma = makePrisma("ACTIVE");
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context } = makeContext({ authorization: "Bearer garbage" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_INVALID" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an expired session with SESSION_EXPIRED, without checking account status", async () => {
    const sessionsService = { resolveByToken: jest.fn().mockResolvedValue({ state: "EXPIRED", session: { userId: "u1" } }) };
    const prisma = makePrisma("ACTIVE");
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_EXPIRED" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a revoked session with SESSION_REVOKED, without checking account status", async () => {
    const sessionsService = { resolveByToken: jest.fn().mockResolvedValue({ state: "REVOKED", session: { userId: "u1" } }) };
    const prisma = makePrisma("ACTIVE");
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_REVOKED" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("passes through for an ACTIVE session whose account is ACTIVE, attaching userId from the session, never from client input", async () => {
    const sessionsService = {
      resolveByToken: jest.fn().mockResolvedValue({ state: "ACTIVE", session: { userId: "u1" } }),
    };
    const prisma = makePrisma("ACTIVE");
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context, request } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.userId).toBe("u1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: "u1" }, select: { accountStatus: true } });
  });

  it("rejects an ACTIVE session whose account is INACTIVE, with 403 ACCOUNT_NOT_ALLOWED — re-checked fresh from the DB, not session-cached", async () => {
    const sessionsService = {
      resolveByToken: jest.fn().mockResolvedValue({ state: "ACTIVE", session: { userId: "u1" } }),
    };
    const prisma = makePrisma("INACTIVE");
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context, request } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_NOT_ALLOWED" });
    expect(request.userId).toBeUndefined();
  });

  it("rejects an ACTIVE session whose account is BLOCKED, with 403 ACCOUNT_NOT_ALLOWED", async () => {
    const sessionsService = {
      resolveByToken: jest.fn().mockResolvedValue({ state: "ACTIVE", session: { userId: "u1" } }),
    };
    const prisma = makePrisma("BLOCKED");
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context, request } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_NOT_ALLOWED" });
    expect(request.userId).toBeUndefined();
  });

  it("rejects an ACTIVE session whose user record no longer exists, with 403 ACCOUNT_NOT_ALLOWED (defensive)", async () => {
    const sessionsService = {
      resolveByToken: jest.fn().mockResolvedValue({ state: "ACTIVE", session: { userId: "u1" } }),
    };
    const prisma = makePrisma(undefined);
    const guard = new SessionGuard(sessionsService as never, prisma as never);
    const { context } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_NOT_ALLOWED" });
  });
});
