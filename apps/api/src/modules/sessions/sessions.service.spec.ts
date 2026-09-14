import type { UserSession } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionsService } from "./sessions.service";

function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    sessionId: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2026-01-01T08:00:00Z"),
    revokedAt: null,
    revocationReason: null,
    note: null,
    ...overrides,
  };
}

describe("SessionsService", () => {
  let prisma: { userSession: Record<string, jest.Mock> };
  let service: SessionsService;

  beforeEach(() => {
    prisma = {
      userSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new SessionsService(prisma as unknown as PrismaService);
    delete process.env.SESSION_TTL_HOURS;
  });

  describe("resolveByToken", () => {
    it("returns NOT_FOUND for a malformed (non-UUID) token", async () => {
      const result = await service.resolveByToken("not-a-uuid");
      expect(result).toEqual({ state: "NOT_FOUND" });
      expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND when the token doesn't match any session", async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);
      const result = await service.resolveByToken("11111111-1111-1111-1111-111111111111");
      expect(result).toEqual({ state: "NOT_FOUND" });
    });

    it("derives ACTIVE when not revoked and not yet expired", async () => {
      const session = makeSession({ expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
      prisma.userSession.findUnique.mockResolvedValue(session);
      const result = await service.resolveByToken(session.sessionId);
      expect(result).toEqual({ state: "ACTIVE", session });
    });

    it("derives EXPIRED when not revoked but past expiresAt", async () => {
      const session = makeSession({ expiresAt: new Date(Date.now() - 60_000), revokedAt: null });
      prisma.userSession.findUnique.mockResolvedValue(session);
      const result = await service.resolveByToken(session.sessionId);
      expect(result).toEqual({ state: "EXPIRED", session });
    });

    it("derives REVOKED whenever revokedAt is set, even if not yet expired", async () => {
      const session = makeSession({
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(Date.now() - 1_000),
      });
      prisma.userSession.findUnique.mockResolvedValue(session);
      const result = await service.resolveByToken(session.sessionId);
      expect(result).toEqual({ state: "REVOKED", session });
    });
  });

  describe("create", () => {
    it("defaults the TTL to 8 hours", async () => {
      prisma.userSession.create.mockImplementation(({ data }) => Promise.resolve({ ...makeSession(), ...data }));
      const before = Date.now();
      const session = await service.create("user-1");
      const hours = (session.expiresAt.getTime() - session.createdAt.getTime()) / (60 * 60 * 1000);
      expect(hours).toBeCloseTo(8, 5);
      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("honors a configured SESSION_TTL_HOURS override", async () => {
      process.env.SESSION_TTL_HOURS = "2";
      prisma.userSession.create.mockImplementation(({ data }) => Promise.resolve({ ...makeSession(), ...data }));
      const session = await service.create("user-1");
      const hours = (session.expiresAt.getTime() - session.createdAt.getTime()) / (60 * 60 * 1000);
      expect(hours).toBeCloseTo(2, 5);
    });

    it("creates an independent session on each call (new login creates a new, independent session)", async () => {
      prisma.userSession.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...makeSession(), sessionId: `sess-${prisma.userSession.create.mock.calls.length}`, ...data }),
      );
      const first = await service.create("user-1");
      const second = await service.create("user-1");
      expect(first.sessionId).not.toEqual(second.sessionId);
      expect(prisma.userSession.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("revoke", () => {
    it("sets revokedAt only when currently NULL (idempotent no-op otherwise)", async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      await service.revoke("sess-1");
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { sessionId: "sess-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
