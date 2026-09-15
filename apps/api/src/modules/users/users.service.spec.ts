import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
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

describe("UsersService.updateInvitedUserEmail", () => {
  const targetUserId = "33333333-3333-3333-3333-333333333333";
  let prisma: { user: Record<string, jest.Mock> };
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  function mockLookups(target: User | null, existingByEmail: User | null) {
    prisma.user.findUnique.mockImplementation(({ where }: { where: { userId?: string; email?: string } }) => {
      if (where.userId !== undefined) return Promise.resolve(target);
      if (where.email !== undefined) return Promise.resolve(existingByEmail);
      return Promise.resolve(null);
    });
  }

  it("updates the target's email when the target is INVITED and the new email is valid", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED", email: "old@example.com" });
    mockLookups(target, null);
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ ...target, ...data }));

    const result = await service.updateInvitedUserEmail(targetUserId, "New@Example.com");

    expect(result).toEqual({ userId: targetUserId, email: "new@example.com", accountStatus: "INVITED" });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { userId: targetUserId }, data: { email: "new@example.com" } });
  });

  it("trims and lowercases the email before validating and storing it — consistently with Google login normalization", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED" });
    mockLookups(target, null);
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ ...target, ...data }));

    await service.updateInvitedUserEmail(targetUserId, "  MixedCase@Example.COM  ");

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { userId: targetUserId }, data: { email: "mixedcase@example.com" } });
  });

  it("rejects when the target user does not exist, with USER_NOT_FOUND", async () => {
    mockLookups(null, null);

    const err = await service.updateInvitedUserEmail(targetUserId, "new@example.com").catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "USER_NOT_FOUND" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  // Malformed/non-UUID userId is syntactic validation, enforced by
  // ParseUUIDPipe at the controller boundary (see users.controller.spec.ts)
  // — this service can assume a syntactically valid UUID and is only
  // responsible for the "does it exist" business check below.

  it.each(["ACTIVE", "INACTIVE", "BLOCKED"])("rejects when the target account is %s, with ACCOUNT_NOT_INVITED", async (accountStatus) => {
    const target = makeUser({ userId: targetUserId, accountStatus });
    mockLookups(target, null);

    const err = await service.updateInvitedUserEmail(targetUserId, "new@example.com").catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "ACCOUNT_NOT_INVITED" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format, with INVALID_EMAIL_FORMAT", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED" });
    mockLookups(target, null);

    const err = await service.updateInvitedUserEmail(targetUserId, "not-an-email").catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "INVALID_EMAIL_FORMAT" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a normalized email already used by another user, with EMAIL_ALREADY_EXISTS", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED" });
    const otherUser = makeUser({ userId: "44444444-4444-4444-4444-444444444444", email: "taken@example.com" });
    mockLookups(target, otherUser);

    const err = await service.updateInvitedUserEmail(targetUserId, "Taken@Example.com").catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "EMAIL_ALREADY_EXISTS" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not treat the target's own current (unchanged) email as a duplicate", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED", email: "same@example.com" });
    mockLookups(target, target);
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ ...target, ...data }));

    await expect(service.updateInvitedUserEmail(targetUserId, "same@example.com")).resolves.toMatchObject({ email: "same@example.com" });
  });

  it("maps a concurrent DB unique-constraint violation (P2002) to EMAIL_ALREADY_EXISTS", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED" });
    mockLookups(target, null);
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
        code: "P2002",
        clientVersion: "7.10.0",
      }),
    );

    const err = await service.updateInvitedUserEmail(targetUserId, "new@example.com").catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ errorCode: "EMAIL_ALREADY_EXISTS" });
  });

  it("propagates an unrelated database error unchanged", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED" });
    mockLookups(target, null);
    const dbError = new Error("connection lost");
    prisma.user.update.mockRejectedValue(dbError);

    await expect(service.updateInvitedUserEmail(targetUserId, "new@example.com")).rejects.toBe(dbError);
  });

  it("only ever writes the email field — systemRole, accountStatus, and googleSubjectId are left untouched", async () => {
    const target = makeUser({ userId: targetUserId, accountStatus: "INVITED", systemRole: "USER", googleSubjectId: null });
    mockLookups(target, null);
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ ...target, ...data }));

    const result = await service.updateInvitedUserEmail(targetUserId, "new@example.com");

    const writtenData = prisma.user.update.mock.calls[0][0].data;
    expect(writtenData).toEqual({ email: "new@example.com" });
    expect(result).toEqual({ userId: targetUserId, email: "new@example.com", accountStatus: "INVITED" });
  });
});
