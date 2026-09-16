import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AllExceptionsFilter } from "../../common/filters/all-exceptions.filter";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { SessionsService } from "../sessions/sessions.service";
import { ProjectMembersController } from "./project-members.controller";
import { ProjectMembersService } from "./project-members.service";

describe("ProjectMembersController", () => {
  let app: INestApplication;
  let sessionsService: { resolveByToken: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock }; projectMembership: { findUnique: jest.Mock } };
  let projectMembersService: { list: jest.Mock; addMember: jest.Mock; removeMember: jest.Mock };
  let auditWriter: { record: jest.Mock };

  const projectId = "11111111-1111-1111-1111-111111111111";
  const userId = "22222222-2222-2222-2222-222222222222";

  beforeEach(async () => {
    sessionsService = { resolveByToken: jest.fn() };
    prisma = { user: { findUnique: jest.fn() }, projectMembership: { findUnique: jest.fn() } };
    projectMembersService = { list: jest.fn(), addMember: jest.fn(), removeMember: jest.fn() };
    auditWriter = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectMembersController],
      providers: [
        { provide: ProjectMembersService, useValue: projectMembersService },
        { provide: SessionsService, useValue: sessionsService },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditWriterService, useValue: auditWriter },
        Reflector,
        SessionGuard,
        RolesGuard,
        ProjectAccessGuard,
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

  function mockSession(callerId: string, systemRole: string) {
    sessionsService.resolveByToken.mockResolvedValue({ state: "ACTIVE", session: { userId: callerId } });
    prisma.user.findUnique.mockResolvedValue({ systemRole, accountStatus: "ACTIVE" });
  }

  it("GET /projects/:projectId/members — allows a USER with membership via ProjectAccessGuard", async () => {
    mockSession("user-1", "USER");
    prisma.projectMembership.findUnique.mockResolvedValue({ userId: "user-1" });
    projectMembersService.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });

    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}/members`)
      .set("Authorization", "Bearer sess-user");

    expect(res.status).toBe(200);
  });

  it("GET /projects/:projectId/members — denies a USER without membership with 403 PROJECT_ACCESS_DENIED", async () => {
    mockSession("user-1", "USER");
    prisma.projectMembership.findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}/members`)
      .set("Authorization", "Bearer sess-user");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errorCode: "PROJECT_ACCESS_DENIED" });
  });

  it("POST /projects/:projectId/members — allows ADMIN and returns 201", async () => {
    mockSession("admin-1", "ADMIN");
    projectMembersService.addMember.mockResolvedValue({ userId, email: "x@example.com", systemRole: "USER", accountStatus: "INVITED" });

    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set("Authorization", "Bearer sess-admin")
      .send({ email: "x@example.com" });

    expect(res.status).toBe(201);
    expect(projectMembersService.addMember).toHaveBeenCalledWith(projectId, { email: "x@example.com" }, "admin-1");
  });

  it("POST /projects/:projectId/members — denies a USER caller with 403, never reaching the service", async () => {
    mockSession("user-1", "USER");

    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set("Authorization", "Bearer sess-user")
      .send({ email: "x@example.com" });

    expect(res.status).toBe(403);
    expect(projectMembersService.addMember).not.toHaveBeenCalled();
  });

  it("DELETE /projects/:projectId/members/:userId — allows ADMIN and returns 204", async () => {
    mockSession("admin-1", "ADMIN");
    projectMembersService.removeMember.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer())
      .delete(`/projects/${projectId}/members/${userId}`)
      .set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(204);
    expect(projectMembersService.removeMember).toHaveBeenCalledWith(projectId, userId, "admin-1");
  });

  it("DELETE /projects/:projectId/members/:userId — denies a USER caller with 403", async () => {
    mockSession("user-1", "USER");

    const res = await request(app.getHttpServer())
      .delete(`/projects/${projectId}/members/${userId}`)
      .set("Authorization", "Bearer sess-user");

    expect(res.status).toBe(403);
    expect(projectMembersService.removeMember).not.toHaveBeenCalled();
  });
});
