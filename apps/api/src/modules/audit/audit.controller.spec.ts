import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AllExceptionsFilter } from "../../common/filters/all-exceptions.filter";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { AuditController } from "./audit.controller";
import { AuditQueryService } from "./audit-query.service";

describe("AuditController", () => {
  let app: INestApplication;
  let sessionsService: { resolveByToken: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let auditQueryService: { list: jest.Mock; getById: jest.Mock; listAllForExport: jest.Mock };

  beforeEach(async () => {
    sessionsService = { resolveByToken: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    auditQueryService = { list: jest.fn(), getById: jest.fn(), listAllForExport: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditQueryService, useValue: auditQueryService },
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

  function mockAdmin() {
    sessionsService.resolveByToken.mockResolvedValue({ state: "ACTIVE", session: { userId: "admin-1" } });
    prisma.user.findUnique.mockResolvedValue({ systemRole: "ADMIN", accountStatus: "ACTIVE" });
  }

  function mockUser() {
    sessionsService.resolveByToken.mockResolvedValue({ state: "ACTIVE", session: { userId: "user-1" } });
    prisma.user.findUnique.mockResolvedValue({ systemRole: "USER", accountStatus: "ACTIVE" });
  }

  it("GET /audit-logs — allows an ADMIN and returns the paged result", async () => {
    mockAdmin();
    auditQueryService.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });

    const res = await request(app.getHttpServer()).get("/audit-logs").set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(200);
    expect(auditQueryService.list).toHaveBeenCalled();
  });

  it("GET /audit-logs — denies a non-ADMIN caller with 403 ACCESS_DENIED", async () => {
    mockUser();

    const res = await request(app.getHttpServer()).get("/audit-logs").set("Authorization", "Bearer sess-user");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errorCode: "ACCESS_DENIED" });
    expect(auditQueryService.list).not.toHaveBeenCalled();
  });

  it("GET /audit-logs/:auditId — allows an ADMIN and returns the detail", async () => {
    mockAdmin();
    auditQueryService.getById.mockResolvedValue({ auditId: "11111111-1111-1111-1111-111111111111" });

    const res = await request(app.getHttpServer())
      .get("/audit-logs/11111111-1111-1111-1111-111111111111")
      .set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(200);
    expect(auditQueryService.getById).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
  });

  it("GET /audit-logs/export — is not shadowed by the :auditId route and returns CSV with the correct headers", async () => {
    mockAdmin();
    auditQueryService.listAllForExport.mockResolvedValue([
      {
        auditId: "a-1",
        eventType: "PROJECT_CREATED",
        result: "SUCCESS",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        actorUserId: "admin-1",
        actorDisplay: "admin@example.com",
        targetType: "PROJECT",
        targetId: "p-1",
        targetDisplay: "=cmd|' /C calc'!A1",
        projectId: "p-1",
        requestId: "req-1",
        detail: null,
      },
    ]);

    const res = await request(app.getHttpServer()).get("/audit-logs/export").set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("audit-logs.csv");
    expect(res.text).toContain("auditId,eventType,result");
    // A field starting with "=" is neutralized with a leading "'" so
    // spreadsheet software never interprets it as a formula.
    expect(res.text).toContain("'=cmd");
    expect(auditQueryService.listAllForExport).toHaveBeenCalled();
  });

  it("GET /audit-logs — rejects an invalid `result` filter value with 400 VALIDATION_ERROR", async () => {
    mockAdmin();

    const res = await request(app.getHttpServer())
      .get("/audit-logs?result=NOT_A_REAL_RESULT")
      .set("Authorization", "Bearer sess-admin");

    expect(res.status).toBe(400);
    expect(auditQueryService.list).not.toHaveBeenCalled();
  });
});
