import type { User } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { UsersService } from "./users.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: "22222222-2222-2222-2222-222222222222",
    email: "user@example.com",
    googleSubjectId: "google-sub-1",
    systemRole: "USER",
    accountStatus: "ACTIVE",
    activatedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    note: null,
    ...overrides,
  };
}

describe("UsersService", () => {
  let prisma: { user: Record<string, jest.Mock> };
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it("returns only userId/email/systemRole/accountStatus for an ACTIVE user", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const result = await service.getCurrentUser("22222222-2222-2222-2222-222222222222");
    expect(result).toEqual({
      userId: "22222222-2222-2222-2222-222222222222",
      email: "user@example.com",
      systemRole: "USER",
      accountStatus: "ACTIVE",
    });
  });

  it("re-checks accountStatus fresh from the DB and rejects a non-ACTIVE account with ACCOUNT_NOT_ALLOWED, even though the session itself was valid", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ accountStatus: "BLOCKED" }));
    await expect(service.getCurrentUser("22222222-2222-2222-2222-222222222222")).rejects.toMatchObject({
      getStatus: expect.any(Function),
    });
    const err = await service.getCurrentUser("22222222-2222-2222-2222-222222222222").catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_NOT_ALLOWED" });
  });

  it("never trusts a client-supplied role/status — it always reloads the user by id and reads DB-authoritative fields", async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ systemRole: "ADMIN", accountStatus: "ACTIVE" }));
    const result = await service.getCurrentUser("22222222-2222-2222-2222-222222222222");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: "22222222-2222-2222-2222-222222222222" } });
    expect(result.systemRole).toBe("ADMIN");
  });
});
