import { AuditWriterService } from "./audit-writer.service";

describe("AuditWriterService", () => {
  function makeService() {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const service = new AuditWriterService(prisma as never);
    return { service, prisma };
  }

  it("writes an audit row via the injected PrismaService by default", async () => {
    const { service, prisma } = makeService();

    await service.record({ eventType: "PROJECT_CREATED", result: "SUCCESS", actorUserId: "admin-1" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "PROJECT_CREATED", result: "SUCCESS", actorUserId: "admin-1" }),
    });
  });

  it("writes through a supplied transaction client instead of the top-level PrismaService, so the write is atomic with the caller's mutation", async () => {
    const { service, prisma } = makeService();
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({}) } };

    await service.record({ eventType: "PROJECT_SOFT_DELETED", result: "SUCCESS" }, tx as never);

    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("strips password/token/secret-like keys from beforeData/afterData before persisting", async () => {
    const { service, prisma } = makeService();

    await service.record({
      eventType: "PROJECT_MEMBER_ADDED",
      result: "SUCCESS",
      beforeData: { email: "user@example.com", password: "hunter2" },
      afterData: { email: "user@example.com", sessionToken: "abc", accountStatus: "INVITED" },
    });

    const call = prisma.auditLog.create.mock.calls[0][0];
    expect(call.data.beforeData).toEqual({ email: "user@example.com" });
    expect(call.data.afterData).toEqual({ email: "user@example.com", accountStatus: "INVITED" });
  });

  it("leaves beforeData/afterData undefined when not provided", async () => {
    const { service, prisma } = makeService();

    await service.record({ eventType: "PROJECT_CREATED", result: "SUCCESS" });

    const call = prisma.auditLog.create.mock.calls[0][0];
    expect(call.data.beforeData).toBeUndefined();
    expect(call.data.afterData).toBeUndefined();
  });
});
