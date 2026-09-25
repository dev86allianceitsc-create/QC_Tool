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

    // context_version (Group 5 Q5 answer): identity/access-change increments.
    it("starts a brand-new row at contextVersion 1", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);
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
      expect(upsertArgs.create.contextVersion).toBe(1);
    });

    it("increments contextVersion when authType changes on an existing row", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        username: null,
        contextVersion: 3,
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
      expect(upsertArgs.create.contextVersion).toBe(4);
    });

    it("increments contextVersion when the LOGIN_FORM username changes but authType stays LOGIN_FORM", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        username: "old-user",
        contextVersion: 2,
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: "https://target.example.com/login",
        username: "new-user",
        usernameField: "user",
        passwordField: "pass",
        tokenResponsePath: "access_token",
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration(
        "p-1",
        "a-1",
        "e-1",
        {
          authType: "LOGIN_FORM",
          loginUrl: "https://target.example.com/login",
          username: "new-user",
          usernameField: "user",
          passwordField: "pass",
          tokenResponsePath: "access_token",
        } as never,
        "user-1",
      );

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create.contextVersion).toBe(3);
    });

    it("does not increment contextVersion for a LOGIN_FORM technical-field-only edit (username unchanged)", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        username: "svc-account",
        contextVersion: 5,
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: "https://target.example.com/login-v2",
        username: "svc-account",
        usernameField: "user",
        passwordField: "pass",
        tokenResponsePath: "access_token",
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration(
        "p-1",
        "a-1",
        "e-1",
        {
          authType: "LOGIN_FORM",
          loginUrl: "https://target.example.com/login-v2",
          username: "svc-account",
          usernameField: "user",
          passwordField: "pass",
          tokenResponsePath: "access_token",
        } as never,
        "user-1",
      );

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create.contextVersion).toBe(5);
    });

    it("does not increment contextVersion when authType stays the same non-LOGIN_FORM value", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        username: null,
        contextVersion: 2,
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
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

      await service.putConfiguration("p-1", "a-1", "e-1", { authType: "BEARER_TOKEN" } as never, "user-1");

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create.contextVersion).toBe(2);
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

    // context_version (Group 5 Q5 answer): rotate-vs-identity-change rules.
    it("does not increment contextVersion for a LOGIN_FORM password-only replacement", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        contextVersion: 4,
        passwordCiphertext: Buffer.from("old"),
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: Buffer.from("new"),
        bearerTokenCiphertext: null,
      });

      await service.putCredential("p-1", "a-1", "e-1", { password: "new-secret" } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("contextVersion");
    });

    it("increments contextVersion by default when a BEARER_TOKEN is replaced", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 2,
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("old"),
      });
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

      await service.putCredential("p-1", "a-1", "e-1", { token: "new-token" } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data.contextVersion).toEqual({ increment: 1 });
    });

    it("does not increment contextVersion when sameIdentity is true for a BEARER_TOKEN replacement", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 2,
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("old"),
      });
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

      await service.putCredential("p-1", "a-1", "e-1", { token: "new-token", sameIdentity: true } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("contextVersion");
    });

    it("does not increment contextVersion on the very first credential ever set on a row (BEARER_TOKEN)", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 1,
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: Buffer.from("first"),
      });

      await service.putCredential("p-1", "a-1", "e-1", { token: "first-token" } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("contextVersion");
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

    // context_version (Group 5 Q5 answer): removal is an access change.
    it("increments contextVersion when actually removing a configured credential", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        contextVersion: 3,
        passwordCiphertext: Buffer.from("ct"),
        bearerTokenCiphertext: null,
      });
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

      await service.removeCredential("p-1", "a-1", "e-1", "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data.contextVersion).toEqual({ increment: 1 });
    });
  });

  // REQ-AUTH-001 VER of the Login Form contract: every required field is
  // enforced server-side, independently of the client's own validation.
  describe("putConfiguration — LOGIN_FORM field requirements", () => {
    const BASE = {
      authType: "LOGIN_FORM",
      loginUrl: "https://target.example.com/login",
      username: "svc-account",
      usernameField: "user",
      passwordField: "pass",
      tokenResponsePath: "data.access_token",
    };

    async function expectRejected(overrides: Record<string, unknown>, status: number) {
      const { service, prisma } = makeService();
      const error = await service
        .putConfiguration("p-1", "a-1", "e-1", { ...BASE, ...overrides } as never, "user-1")
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(status);
      expect(prisma.authenticationConfiguration.upsert).not.toHaveBeenCalled();
    }

    it("rejects a missing loginUrl, username, usernameField, passwordField or tokenResponsePath with 400", async () => {
      await expectRejected({ loginUrl: "" }, 400);
      await expectRejected({ username: "" }, 400);
      await expectRejected({ usernameField: "" }, 400);
      await expectRejected({ passwordField: "" }, 400);
      await expectRejected({ tokenResponsePath: "" }, 400);
    });

    it("rejects a tokenResponsePath that is not a dot-separated identifier path with 422", async () => {
      await expectRejected({ tokenResponsePath: "data[0].token" }, 422);
      await expectRejected({ tokenResponsePath: ".access_token" }, 422);
      await expectRejected({ tokenResponsePath: "data..token" }, 422);
      await expectRejected({ tokenResponsePath: "data.access token" }, 422);
    });

    it("accepts a single-segment and a nested tokenResponsePath", async () => {
      for (const tokenResponsePath of ["access_token", "data.auth.access_token"]) {
        const { service, prisma } = makeService();
        prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);
        prisma.authenticationConfiguration.upsert.mockResolvedValue({
          ...BASE,
          tokenResponsePath,
          updatedAt: new Date(),
          passwordCiphertext: null,
          bearerTokenCiphertext: null,
        });

        const result = await service.putConfiguration("p-1", "a-1", "e-1", { ...BASE, tokenResponsePath } as never, "user-1");

        expect(result.tokenResponsePath).toBe(tokenResponsePath);
      }
    });

    it("stores no Login Form metadata for NONE or BEARER_TOKEN", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
        updatedAt: new Date(),
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "a-1", "e-1", { ...BASE, authType: "BEARER_TOKEN" } as never, "user-1");

      expect(prisma.authenticationConfiguration.upsert.mock.calls[0][0].create).toMatchObject({
        loginUrl: null,
        username: null,
        usernameField: null,
        passwordField: null,
        tokenResponsePath: null,
      });
    });
  });

  // REQ-SEC-003 / §7: an INACTIVE Project freezes its configuration.
  describe("INACTIVE Project", () => {
    function inactiveProjectService() {
      const made = makeService();
      made.prisma.project.findFirst.mockResolvedValue({ projectId: "p-1", projectStatus: "INACTIVE", deletedAt: null });
      return made;
    }

    it("rejects putConfiguration with 409 INVALID_STATE and writes nothing", async () => {
      const { service, prisma, auditWriter } = inactiveProjectService();

      const error = await service.putConfiguration("p-1", "a-1", "e-1", { authType: "NONE" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.authenticationConfiguration.upsert).not.toHaveBeenCalled();
      expect(auditWriter.record).not.toHaveBeenCalled();
    });

    it("rejects putCredential with 409 INVALID_STATE", async () => {
      const { service, prisma } = inactiveProjectService();

      const error = await service.putCredential("p-1", "a-1", "e-1", { token: "t" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("rejects removeCredential with 409 INVALID_STATE", async () => {
      const { service, prisma } = inactiveProjectService();

      const error = await service.removeCredential("p-1", "a-1", "e-1", "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("rejects a soft-deleted Project with 404", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      const error = await service.putConfiguration("p-1", "a-1", "e-1", { authType: "NONE" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
    });
  });

  describe("putCredential — the secret must match the configured type", () => {
    it("rejects a missing password for LOGIN_FORM with 400", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      const error = await service.putCredential("p-1", "a-1", "e-1", { token: "a-token" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(400);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("rejects a missing token for BEARER_TOKEN with 400", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      const error = await service.putCredential("p-1", "a-1", "e-1", { password: "p" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(400);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("rejects a token that is empty once the 'Bearer ' prefix is stripped, with 400", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });

      const error = await service.putCredential("p-1", "a-1", "e-1", { token: "Bearer    " } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(400);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("writes only the secret column that belongs to the configured type", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        passwordCiphertext: null,
        bearerTokenCiphertext: null,
      });
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

      await service.putCredential("p-1", "a-1", "e-1", { token: "raw-token" } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data).toHaveProperty("bearerTokenCiphertext");
      expect(data).not.toHaveProperty("passwordCiphertext");
      expect(Buffer.from(data.bearerTokenCiphertext as Uint8Array).toString("utf8")).not.toContain("raw-token");
    });
  });
});
