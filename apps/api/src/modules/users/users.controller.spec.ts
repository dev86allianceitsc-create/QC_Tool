import type { INestApplication } from "@nestjs/common";
import { HttpStatus, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AllExceptionsFilter } from "../../common/filters/all-exceptions.filter";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

// Integration-level tests for the actual route wiring on
// PATCH /users/:userId (API-USR-005) — that SessionGuard + RolesGuard +
// @Roles("ADMIN") + the DTO's whitelist are all correctly attached to this
// specific route. Business-rule behavior (INVITED check, duplicate email,
// normalization, P2002 mapping, etc.) is covered separately and more
// thoroughly in users.service.spec.ts against a mocked PrismaService.
describe("UsersController — PATCH /users/:userId (API-USR-005) authorization & validation wiring", () => {
  let app: INestApplication;
  let sessionsService: { resolveByToken: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let usersService: { updateInvitedUserEmail: jest.Mock };

  const targetUserId = "33333333-3333-3333-3333-333333333333";

  beforeEach(async () => {
    sessionsService = { resolveByToken: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    usersService = { updateInvitedUserEmail: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: SessionsService, useValue: sessionsService },
        { provide: PrismaService, useValue: prisma },
        Reflector,
        SessionGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function mockActiveSession(userId: string) {
    sessionsService.resolveByToken.mockResolvedValue({ state: "ACTIVE", session: { userId } });
  }

  it("allows an ADMIN caller and returns 200 with the service result", async () => {
    mockActiveSession("admin-1");
    prisma.user.findUnique.mockResolvedValue({ systemRole: "ADMIN", accountStatus: "ACTIVE" });
    usersService.updateInvitedUserEmail.mockResolvedValue({ userId: targetUserId, email: "new@example.com", accountStatus: "INVITED" });

    const res = await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set("Authorization", "Bearer sess-admin")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: targetUserId, email: "new@example.com", accountStatus: "INVITED" });
    expect(usersService.updateInvitedUserEmail).toHaveBeenCalledWith(targetUserId, "new@example.com");
    // The caller's role was resolved from the DB by their own session userId,
    // never taken from the request body/headers.
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: "admin-1" }, select: { systemRole: true } });
  });

  it("denies a USER caller with 403 ACCESS_DENIED and never calls the service", async () => {
    mockActiveSession("user-1");
    prisma.user.findUnique.mockResolvedValue({ systemRole: "USER", accountStatus: "ACTIVE" });

    const res = await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set("Authorization", "Bearer sess-user")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errorCode: "ACCESS_DENIED" });
    expect(usersService.updateInvitedUserEmail).not.toHaveBeenCalled();
  });

  it("rejects a missing/invalid session with 401 and never calls the service", async () => {
    sessionsService.resolveByToken.mockResolvedValue({ state: "NOT_FOUND" });

    const res = await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set("Authorization", "Bearer garbage")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ errorCode: "SESSION_INVALID" });
    expect(usersService.updateInvitedUserEmail).not.toHaveBeenCalled();
  });

  it("rejects a request with no Authorization header at all, with 401", async () => {
    const res = await request(app.getHttpServer()).patch(`/users/${targetUserId}`).send({ email: "new@example.com" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ errorCode: "SESSION_INVALID" });
    expect(sessionsService.resolveByToken).not.toHaveBeenCalled();
    expect(usersService.updateInvitedUserEmail).not.toHaveBeenCalled();
  });

  it("rejects an attempt to also submit systemRole/accountStatus with 400, before reaching the service", async () => {
    mockActiveSession("admin-1");
    prisma.user.findUnique.mockResolvedValue({ systemRole: "ADMIN", accountStatus: "ACTIVE" });

    const res = await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set("Authorization", "Bearer sess-admin")
      .send({ email: "new@example.com", systemRole: "ADMIN", accountStatus: "ACTIVE" });

    expect(res.status).toBe(400);
    expect(usersService.updateInvitedUserEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed (non-UUID) userId with 400 VALIDATION_ERROR, before reaching the service (API Design Standard §12: syntactic validation)", async () => {
    mockActiveSession("admin-1");
    prisma.user.findUnique.mockResolvedValue({ systemRole: "ADMIN", accountStatus: "ACTIVE" });

    const res = await request(app.getHttpServer())
      .patch("/users/not-a-uuid")
      .set("Authorization", "Bearer sess-admin")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: "VALIDATION_ERROR" });
    expect(usersService.updateInvitedUserEmail).not.toHaveBeenCalled();
  });

  it("returns 404 USER_NOT_FOUND for a syntactically valid UUID that has no matching user — distinct from the 400 malformed-id case", async () => {
    mockActiveSession("admin-1");
    prisma.user.findUnique.mockResolvedValue({ systemRole: "ADMIN", accountStatus: "ACTIVE" });
    usersService.updateInvitedUserEmail.mockRejectedValue(
      new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Target user does not exist"),
    );

    const res = await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set("Authorization", "Bearer sess-admin")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ errorCode: "USER_NOT_FOUND" });
    expect(usersService.updateInvitedUserEmail).toHaveBeenCalledWith(targetUserId, "new@example.com");
  });

  it("ignores a client-supplied role hint and still resolves the caller's role from the database (rejects because DB says USER)", async () => {
    mockActiveSession("user-1");
    prisma.user.findUnique.mockResolvedValue({ systemRole: "USER", accountStatus: "ACTIVE" });

    const res = await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set("Authorization", "Bearer sess-user")
      .set("X-System-Role", "ADMIN")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(403);
    expect(usersService.updateInvitedUserEmail).not.toHaveBeenCalled();
  });
});
