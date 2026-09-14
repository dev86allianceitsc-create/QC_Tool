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

describe("SessionGuard", () => {
  it("rejects a missing Bearer credential with SESSION_INVALID", async () => {
    const sessionsService = { resolveByToken: jest.fn() };
    const guard = new SessionGuard(sessionsService as never);
    const { context } = makeContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(BusinessException);
    expect(sessionsService.resolveByToken).not.toHaveBeenCalled();
  });

  it("rejects a malformed/unknown credential with SESSION_INVALID", async () => {
    const sessionsService = { resolveByToken: jest.fn().mockResolvedValue({ state: "NOT_FOUND" }) };
    const guard = new SessionGuard(sessionsService as never);
    const { context } = makeContext({ authorization: "Bearer garbage" });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      getResponse: expect.any(Function),
    });
    const err = await guard.canActivate(context).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_INVALID" });
  });

  it("rejects an expired session with SESSION_EXPIRED", async () => {
    const sessionsService = { resolveByToken: jest.fn().mockResolvedValue({ state: "EXPIRED", session: { userId: "u1" } }) };
    const guard = new SessionGuard(sessionsService as never);
    const { context } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_EXPIRED" });
  });

  it("rejects a revoked session with SESSION_REVOKED", async () => {
    const sessionsService = { resolveByToken: jest.fn().mockResolvedValue({ state: "REVOKED", session: { userId: "u1" } }) };
    const guard = new SessionGuard(sessionsService as never);
    const { context } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const err = await guard.canActivate(context).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_REVOKED" });
  });

  it("passes through for an ACTIVE session and attaches userId from the session, never from client input", async () => {
    const sessionsService = {
      resolveByToken: jest.fn().mockResolvedValue({ state: "ACTIVE", session: { userId: "u1" } }),
    };
    const guard = new SessionGuard(sessionsService as never);
    const { context, request } = makeContext({ authorization: "Bearer 11111111-1111-1111-1111-111111111111" });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.userId).toBe("u1");
  });
});
