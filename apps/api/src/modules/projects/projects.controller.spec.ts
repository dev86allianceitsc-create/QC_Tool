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
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

describe("ProjectsController", () => {
  let app: INestApplication;
  let sessionsService: { resolveByToken: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock }; projectMembership: { findUnique: jest.Mock } };
  let projectsService: { list: jest.Mock; create: jest.Mock; getById: jest.Mock; update: jest.Mock; softDelete: jest.Mock };
  let auditWriter: { record: jest.Mock };

  const projectId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    sessionsService = { resolveByToken: jest.fn() };
    prisma = { user: { findUnique: jest.fn() }, projectMembership: { findUnique: jest.fn() } };
    projectsService = { list: jest.fn(), create: jest.fn(), getById: jest.fn(), update: jest.fn(), softDelete: jest.fn() };
    auditWriter = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projectsService },
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

  function mockSession(userId: string, systemRole: string) {
    sessionsService.resolveByToken.mockResolvedValue({ state: "ACTIVE", session: { userId } });
    prisma.user.findUnique.mockResolvedValue({ systemRole, accountStatus: "ACTIVE" });
  }

  it("GET /projects — resolves the caller's admin status itself and passes isAdmin=true through to the service", async () => {
    mockSession("admin-1", "ADMIN");
    projectsService.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });

    const res = await request(app.getHttpServer()).get("/projects").set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(200);
    expect(projectsService.list).toHaveBeenCalledWith(expect.anything(), "admin-1", true);
  });

  it("GET /projects — passes isAdmin=false for a USER caller", async () => {
    mockSession("user-1", "USER");
    projectsService.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });

    await request(app.getHttpServer()).get("/projects").set("Authorization", "Bearer sess-user");

    expect(projectsService.list).toHaveBeenCalledWith(expect.anything(), "user-1", false);
  });

  it("POST /projects — allows ADMIN, denies USER with 403", async () => {
    mockSession("admin-1", "ADMIN");
    projectsService.create.mockResolvedValue({ projectId, projectName: "X" });

    const okRes = await request(app.getHttpServer())
      .post("/projects")
      .set("Authorization", "Bearer sess-admin")
      .send({ projectName: "X" });
    expect(okRes.status).toBe(201);

    mockSession("user-1", "USER");
    const deniedRes = await request(app.getHttpServer())
      .post("/projects")
      .set("Authorization", "Bearer sess-user")
      .send({ projectName: "X" });
    expect(deniedRes.status).toBe(403);
  });

  it("GET /projects/:projectId — allows a USER with membership via ProjectAccessGuard", async () => {
    mockSession("user-1", "USER");
    prisma.projectMembership.findUnique.mockResolvedValue({ userId: "user-1" });
    projectsService.getById.mockResolvedValue({ projectId, projectName: "X" });

    const res = await request(app.getHttpServer()).get(`/projects/${projectId}`).set("Authorization", "Bearer sess-user");

    expect(res.status).toBe(200);
  });

  it("GET /projects/:projectId — denies a USER without membership with 403 PROJECT_ACCESS_DENIED", async () => {
    mockSession("user-1", "USER");
    prisma.projectMembership.findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer()).get(`/projects/${projectId}`).set("Authorization", "Bearer sess-user");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errorCode: "PROJECT_ACCESS_DENIED" });
    expect(projectsService.getById).not.toHaveBeenCalled();
  });

  it("GET /projects/:projectId — rejects a malformed projectId with 400 VALIDATION_ERROR", async () => {
    mockSession("admin-1", "ADMIN");

    const res = await request(app.getHttpServer()).get("/projects/not-a-uuid").set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(400);
  });

  it("PATCH /projects/:projectId — allows ADMIN, denies USER with 403", async () => {
    mockSession("user-1", "USER");

    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set("Authorization", "Bearer sess-user")
      .send({ projectName: "Y" });

    expect(res.status).toBe(403);
    expect(projectsService.update).not.toHaveBeenCalled();
  });

  it("DELETE /projects/:projectId — allows ADMIN and returns 204", async () => {
    mockSession("admin-1", "ADMIN");
    projectsService.softDelete.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer()).delete(`/projects/${projectId}`).set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(204);
  });
});
