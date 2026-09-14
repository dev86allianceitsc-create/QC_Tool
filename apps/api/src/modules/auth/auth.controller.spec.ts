import type { Request } from "express";
import { BusinessException } from "../../common/exceptions/business.exception";
import { SessionsService } from "../sessions/sessions.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

function makeRequest(authorization?: string): Request {
  return { headers: { authorization } } as unknown as Request;
}

describe("AuthController.logout", () => {
  let sessionsService: { resolveByToken: jest.Mock; revoke: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    sessionsService = { resolveByToken: jest.fn(), revoke: jest.fn() };
    controller = new AuthController({} as AuthService, sessionsService as unknown as SessionsService);
  });

  it("revokes an ACTIVE session and returns (204, no body)", async () => {
    const session = { sessionId: "sess-1", userId: "u1" };
    sessionsService.resolveByToken.mockResolvedValue({ state: "ACTIVE", session });

    await expect(controller.logout(makeRequest("Bearer sess-1"))).resolves.toBeUndefined();
    expect(sessionsService.revoke).toHaveBeenCalledWith("sess-1");
  });

  it("is idempotent: logging out an already-REVOKED session still succeeds without another DB write", async () => {
    sessionsService.resolveByToken.mockResolvedValue({ state: "REVOKED", session: { sessionId: "sess-1", userId: "u1" } });

    await expect(controller.logout(makeRequest("Bearer sess-1"))).resolves.toBeUndefined();
    expect(sessionsService.revoke).not.toHaveBeenCalled();
  });

  it("succeeds (204) for an already-EXPIRED session, without revoking it", async () => {
    sessionsService.resolveByToken.mockResolvedValue({ state: "EXPIRED", session: { sessionId: "sess-1", userId: "u1" } });

    await expect(controller.logout(makeRequest("Bearer sess-1"))).resolves.toBeUndefined();
    expect(sessionsService.revoke).not.toHaveBeenCalled();
  });

  it("rejects a malformed/unknown credential with SESSION_INVALID", async () => {
    sessionsService.resolveByToken.mockResolvedValue({ state: "NOT_FOUND" });

    const err = await controller.logout(makeRequest("Bearer unknown-token")).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_INVALID" });
  });

  it("rejects a missing Bearer credential with SESSION_INVALID", async () => {
    const err = await controller.logout(makeRequest(undefined)).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "SESSION_INVALID" });
    expect(sessionsService.resolveByToken).not.toHaveBeenCalled();
  });

  it("only revokes the session identified by the Bearer credential — never other sessions or the account itself", async () => {
    const session = { sessionId: "sess-1", userId: "u1" };
    sessionsService.resolveByToken.mockResolvedValue({ state: "ACTIVE", session });

    await controller.logout(makeRequest("Bearer sess-1"));

    expect(sessionsService.revoke).toHaveBeenCalledTimes(1);
    expect(sessionsService.revoke).toHaveBeenCalledWith("sess-1");
  });
});
