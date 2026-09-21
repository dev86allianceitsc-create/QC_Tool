import { BusinessException } from "../../common/exceptions/business.exception";
import { AuthenticationService } from "./authentication.service";

process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("AuthenticationService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      apiConfiguration: { findFirst: jest.Mock };
      environment: { findFirst: jest.Mock };
      authenticationConfiguration: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock };
      project: { findFirst: jest.Mock };
      $transaction: jest.Mock;
    } = {
      apiConfiguration: { findFirst: jest.fn().mockResolvedValue({ apiId: "a-1", apiName: "X" }) },
      environment: { findFirst: jest.fn().mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "ACTIVE" }) },
      authenticationConfiguration: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      project: { findFirst: jest.fn().mockResolvedValue({ projectId: "p-1", projectStatus: "ACTIVE", deletedAt: null }) },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const service = new AuthenticationService(prisma as never, auditWriter as never);
    return { service, prisma, auditWriter };
  }

  describe("get", () => {
    it("returns NONE / NOT_REQUIRED when no row exists", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);

      const result = await service.get("p-1", "a-1", "e-1");

      expect(result).toMatchObject({ authType: "NONE", credentialStatus: "NOT_REQUIRED" });
    });

    it("reports NOT_CONFIGURED when a LOGIN_FORM row exists with no secret, and never returns secret fields", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: "https://target.example.com/login",
        username: "svc-account",
        usernameField: "user",
        passwordField: "pass",
        tokenResponsePath: "access_token",
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      const result = await service.get("p-1", "a-1", "e-1");

      expect(result.credentialStatus).toBe("NOT_CONFIGURED");
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("bearerToken");
    });

    it("reports CONFIGURED when a secret is present", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("ct"),
      });

      const result = await service.get("p-1", "a-1", "e-1");

      expect(result.credentialStatus).toBe("CONFIGURED");
    });
  });

  describe("putConfiguration", () => {
    it("rejects LOGIN_FORM with a malformed loginUrl with 400 VALIDATION_ERROR", async () => {
      const { service, prisma } = makeService();

      await expect(
        service.putConfiguration(
          "p-1",
          "a-1",
          "e-1",
          { authType: "LOGIN_FORM", loginUrl: "not a url", username: "u", usernameField: "user", passwordField: "pass", tokenResponsePath: "access_token" } as never,
          "user-1",
        ),
      ).rejects.toBeInstanceOf(BusinessException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects LOGIN_FORM with a non-HTTP(S) loginUrl with 422 SEMANTIC_VALIDATION_ERROR", async () => {
      const { service } = makeService();

      const error = await service
        .putConfiguration(
          "p-1",
          "a-1",
          "e-1",
          { authType: "LOGIN_FORM", loginUrl: "ftp://host/path", username: "u", usernameField: "user", passwordField: "pass", tokenResponsePath: "access_token" } as never,
          "user-1",
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(422);
    });

    it("rejects LOGIN_FORM when usernameField equals passwordField with 422 SEMANTIC_VALIDATION_ERROR", async () => {
      const { service } = makeService();

      const error = await service
        .putConfiguration(
          "p-1",
          "a-1",
          "e-1",
          {
            authType: "LOGIN_FORM",
            loginUrl: "https://target.example.com/login",
            username: "u",
            usernameField: "same",
            passwordField: "same",
            tokenResponsePath: "access_token",
          } as never,
          "user-1",
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getResponse()).toMatchObject({ errorCode: "SEMANTIC_VALIDATION_ERROR" });
    });

    it("rejects an INACTIVE Environment with 409 INVALID_STATE", async () => {
      const { service, prisma } = makeService();
      prisma.environment.findFirst.mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "INACTIVE" });

      await expect(service.putConfiguration("p-1", "a-1", "e-1", { authType: "NONE" } as never, "user-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
    });

    it("clears any existing secret when authType changes (CL-3C-02), and audits AUTH_TYPE_CHANGED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "NONE",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "a-1", "e-1", { authType: "NONE" } as never, "user-1");

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create).toMatchObject({ bearerTokenCiphertext: null, passwordCiphertext: null });
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "AUTH_TYPE_CHANGED" }),
        prisma,
      );
      const auditCall = auditWriter.record.mock.calls[0][0];
      expect(JSON.stringify(auditCall)).not.toMatch(/[Cc]iphertext/);
    });

    it("does not touch existing secret bytes when authType is unchanged, and audits AUTHENTICATION_CONFIGURATION_UPDATED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "NONE", passwordCiphertext: null, bearerTokenCiphertext: null });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "NONE",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "a-1", "e-1", { authType: "NONE" } as never, "user-1");

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create).not.toHaveProperty("bearerTokenCiphertext");
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "AUTHENTICATION_CONFIGURATION_UPDATED" }),
        prisma,
      );
    });
  });

  describe("putCredential", () => {
    it("rejects with 409 INVALID_STATE when current authType is NONE", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);

      const error = await service.putCredential("p-1", "a-1", "e-1", { password: "secret" } as never, "user-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(409);
    });

    it("encrypts the password for LOGIN_FORM and never puts plaintext in the audit record", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "LOGIN_FORM", passwordCiphertext: null, bearerTokenCiphertext: null });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: Buffer.from("ct"),
        bearerTokenCiphertext: null,
      });

      const result = await service.putCredential("p-1", "a-1", "e-1", { password: "super-secret-plaintext" } as never, "user-1");

      const updateArgs = prisma.authenticationConfiguration.update.mock.calls[0][0];
      expect(updateArgs.data.passwordCiphertext).not.toEqual(Buffer.from("super-secret-plaintext"));
      expect(result.credentialStatus).toBe("CONFIGURED");
      expect(JSON.stringify(auditWriter.record.mock.calls[0][0])).not.toMatch(/super-secret-plaintext/);
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "CREDENTIAL_CONFIGURED" }), prisma);
    });

    it("audits CREDENTIAL_REPLACED when a secret already exists", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "BEARER_TOKEN", passwordCiphertext: null, bearerTokenCiphertext: Buffer.from("old") });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("new"),
      });

      await service.putCredential("p-1", "a-1", "e-1", { token: "Bearer new-token-value" } as never, "user-1");

      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "CREDENTIAL_REPLACED" }), prisma);
    });

    it("strips a leading 'Bearer ' prefix from a submitted token", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "BEARER_TOKEN", passwordCiphertext: null, bearerTokenCiphertext: null });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("ct"),
      });

      await service.putCredential("p-1", "a-1", "e-1", { token: "Bearer   raw-token  " } as never, "user-1");

      expect(prisma.authenticationConfiguration.update).toHaveBeenCalled();
    });
  });

  describe("removeCredential", () => {
    it("is idempotent (no audit event) when already Not configured", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "LOGIN_FORM", passwordCiphertext: null, bearerTokenCiphertext: null });

      const result = await service.removeCredential("p-1", "a-1", "e-1", "user-1");

      expect(result.credentialStatus).toBe("NOT_CONFIGURED");
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
      expect(auditWriter.record).not.toHaveBeenCalled();
    });

    it("removes the secret, keeps authType, and audits CREDENTIAL_REMOVED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "LOGIN_FORM", passwordCiphertext: Buffer.from("ct"), bearerTokenCiphertext: null });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      const result = await service.removeCredential("p-1", "a-1", "e-1", "user-1");

      expect(result).toMatchObject({ authType: "LOGIN_FORM", credentialStatus: "NOT_CONFIGURED" });
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "CREDENTIAL_REMOVED" }), prisma);
    });
  });
});
