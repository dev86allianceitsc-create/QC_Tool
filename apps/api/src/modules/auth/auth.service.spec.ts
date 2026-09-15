import { Prisma } from "@prisma/client";
import type { User, UserSession } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { SessionsService } from "../sessions/sessions.service";
import { AuthService } from "./auth.service";
import { GoogleAuthError, GoogleIdentityService } from "./google-identity.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: "22222222-2222-2222-2222-222222222222",
    email: "user@example.com",
    googleSubjectId: null,
    systemRole: "USER",
    accountStatus: "INVITED",
    activatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    note: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    sessionId: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    revokedAt: null,
    revocationReason: null,
    note: null,
    ...overrides,
  };
}

describe("AuthService.loginWithGoogle", () => {
  let prisma: {
    user: Record<string, jest.Mock>;
    userSession: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let sessionsService: { create: jest.Mock };
  let googleIdentityService: { exchange: jest.Mock };
  let service: AuthService;

  const identity = { sub: "google-sub-1", email: "USER@Example.com", emailVerified: true };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      userSession: { create: jest.fn() },
      $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    sessionsService = { create: jest.fn() };
    googleIdentityService = { exchange: jest.fn() };
    service = new AuthService(
      prisma as unknown as PrismaService,
      sessionsService as unknown as SessionsService,
      googleIdentityService as unknown as GoogleIdentityService,
    );
  });

  it("rejects with AUTHENTICATION_FAILED when Google identity is invalid/unresolvable", async () => {
    googleIdentityService.exchange.mockRejectedValue(new GoogleAuthError("bad code"));

    const err = await service.loginWithGoogle("bad-code").catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "AUTHENTICATION_FAILED" });
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects with EMAIL_NOT_VERIFIED when Google reports the email as unverified", async () => {
    googleIdentityService.exchange.mockResolvedValue({ ...identity, emailVerified: false });

    const err = await service.loginWithGoogle("code").catch((e) => e);
    expect(err.getResponse()).toMatchObject({ errorCode: "EMAIL_NOT_VERIFIED" });
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  it("rejects with ACCOUNT_NOT_REGISTERED when no user matches by subject id or normalized email", async () => {
    googleIdentityService.exchange.mockResolvedValue(identity);
    prisma.user.findUnique.mockResolvedValue(null);

    const err = await service.loginWithGoogle("code").catch((e) => e);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_NOT_REGISTERED" });
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  it("rejects with IDENTITY_LINK_CONFLICT when the resolved user is linked to a different Google subject id", async () => {
    googleIdentityService.exchange.mockResolvedValue(identity);
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser({ googleSubjectId: "some-other-sub" }));

    const err = await service.loginWithGoogle("code").catch((e) => e);
    expect(err.getResponse()).toMatchObject({ errorCode: "IDENTITY_LINK_CONFLICT" });
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  describe("first login (INVITED, unlinked)", () => {
    beforeEach(() => {
      googleIdentityService.exchange.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser({ accountStatus: "INVITED", googleSubjectId: null }));
    });

    it("links the Google subject id, transitions INVITED to ACTIVE, and creates a new session — atomically", async () => {
      prisma.user.update.mockImplementation(({ data }) => Promise.resolve(makeUser({ accountStatus: "ACTIVE", ...data })));
      prisma.userSession.create.mockImplementation(({ data }) => Promise.resolve(makeSession(data)));

      const result = await service.loginWithGoogle("code");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { userId: "22222222-2222-2222-2222-222222222222" },
        data: expect.objectContaining({ googleSubjectId: "google-sub-1", accountStatus: "ACTIVE", activatedAt: expect.any(Date) }),
      });
      expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
      expect(result.user.accountStatus).toBe("ACTIVE");
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.tokenType).toBe("Bearer");
    });

    it("normalizes the email (trim/lowercase) when resolving the user by email", async () => {
      prisma.user.update.mockImplementation(({ data }) => Promise.resolve(makeUser({ accountStatus: "ACTIVE", ...data })));
      prisma.userSession.create.mockImplementation(({ data }) => Promise.resolve(makeSession(data)));

      await service.loginWithGoogle("code");

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, { where: { email: "user@example.com" } });
    });
  });

  describe("returning login (already linked)", () => {
    it("allows login for an ACTIVE account and creates a new session without touching existing sessions", async () => {
      googleIdentityService.exchange.mockResolvedValue(identity);
      const user = makeUser({ accountStatus: "ACTIVE", googleSubjectId: "google-sub-1" });
      prisma.user.findUnique.mockResolvedValue(user);
      sessionsService.create.mockResolvedValue(makeSession());

      const result = await service.loginWithGoogle("code");

      expect(sessionsService.create).toHaveBeenCalledWith(user.userId);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.user.accountStatus).toBe("ACTIVE");
    });

    it("rejects INACTIVE accounts with ACCOUNT_INACTIVE", async () => {
      googleIdentityService.exchange.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValue(makeUser({ accountStatus: "INACTIVE", googleSubjectId: "google-sub-1" }));

      const err = await service.loginWithGoogle("code").catch((e) => e);
      expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_INACTIVE" });
      expect(sessionsService.create).not.toHaveBeenCalled();
    });

    it("rejects BLOCKED accounts with ACCOUNT_BLOCKED", async () => {
      googleIdentityService.exchange.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValue(makeUser({ accountStatus: "BLOCKED", googleSubjectId: "google-sub-1" }));

      const err = await service.loginWithGoogle("code").catch((e) => e);
      expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_BLOCKED" });
      expect(sessionsService.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid systemRole with INVALID_SYSTEM_ROLE", async () => {
      googleIdentityService.exchange.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValue(makeUser({ accountStatus: "ACTIVE", googleSubjectId: "google-sub-1", systemRole: "SUPERUSER" }));
      sessionsService.create.mockResolvedValue(makeSession());

      const err = await service.loginWithGoogle("code").catch((e) => e);
      expect(err.getResponse()).toMatchObject({ errorCode: "INVALID_SYSTEM_ROLE" });
    });

    it("does not query for duplicates or touch the stored email when Google's email matches the stored email (FR-USR-001-21)", async () => {
      googleIdentityService.exchange.mockResolvedValue(identity);
      const user = makeUser({ accountStatus: "ACTIVE", googleSubjectId: "google-sub-1", email: "user@example.com" });
      prisma.user.findUnique.mockResolvedValueOnce(user);
      sessionsService.create.mockResolvedValue(makeSession());

      await service.loginWithGoogle("code");

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("re-syncs the stored email when Google reports a different, verified email not used by another account (FR-USR-001-21 / SF-07)", async () => {
      googleIdentityService.exchange.mockResolvedValue({ ...identity, email: "New.Email@Example.com" });
      const user = makeUser({ accountStatus: "ACTIVE", googleSubjectId: "google-sub-1", email: "old@example.com" });
      prisma.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
      prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ ...user, ...data }));
      sessionsService.create.mockResolvedValue(makeSession());

      const result = await service.loginWithGoogle("code");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { userId: user.userId },
        data: { email: "new.email@example.com" },
      });
      expect(result.user.email).toBe("new.email@example.com");
      expect(sessionsService.create).toHaveBeenCalledWith(user.userId);
    });

    it("rejects with IDENTITY_LINK_CONFLICT when the new verified email already belongs to a different account — no merge, no session (FR-USR-001-22 / SF-07)", async () => {
      googleIdentityService.exchange.mockResolvedValue({ ...identity, email: "taken@example.com" });
      const user = makeUser({ accountStatus: "ACTIVE", googleSubjectId: "google-sub-1", email: "old@example.com" });
      const otherUser = makeUser({ userId: "44444444-4444-4444-4444-444444444444", email: "taken@example.com" });
      prisma.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(otherUser);

      const err = await service.loginWithGoogle("code").catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "IDENTITY_LINK_CONFLICT" });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(sessionsService.create).not.toHaveBeenCalled();
    });

    it("maps a concurrent duplicate-email race (P2002) during email sync to IDENTITY_LINK_CONFLICT", async () => {
      googleIdentityService.exchange.mockResolvedValue({ ...identity, email: "new@example.com" });
      const user = makeUser({ accountStatus: "ACTIVE", googleSubjectId: "google-sub-1", email: "old@example.com" });
      prisma.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
      prisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
          code: "P2002",
          clientVersion: "7.10.0",
        }),
      );

      const err = await service.loginWithGoogle("code").catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getResponse()).toMatchObject({ errorCode: "IDENTITY_LINK_CONFLICT" });
      expect(sessionsService.create).not.toHaveBeenCalled();
    });
  });
});
