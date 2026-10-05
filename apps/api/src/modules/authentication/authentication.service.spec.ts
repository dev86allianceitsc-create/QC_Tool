import { BusinessException } from "../../common/exceptions/business.exception";
import { AuthenticationService } from "./authentication.service";

process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("AuthenticationService", () => {
  function makeService() {
    const auditWriter = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma: {
      environment: { findFirst: jest.Mock };
      authenticationConfiguration: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock };
      testAccount: { count: jest.Mock; deleteMany: jest.Mock };
      project: { findFirst: jest.Mock };
      $transaction: jest.Mock;
    } = {
      environment: { findFirst: jest.fn().mockResolvedValue({ environmentId: "e-1", environmentName: "Env", environmentStatus: "ACTIVE" }) },
      authenticationConfiguration: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      testAccount: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
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

      const result = await service.get("p-1", "e-1");

      expect(result).toMatchObject({ authType: "NONE", credentialStatus: "NOT_REQUIRED" });
    });

    it("reports NOT_CONFIGURED when a LOGIN_FORM row exists with no Test Accounts, and never returns secret fields", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: "https://target.example.com/login",
        usernameField: "user",
        passwordField: "pass",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });
      prisma.testAccount.count.mockResolvedValue(0);

      const result = await service.get("p-1", "e-1");

      expect(result.credentialStatus).toBe("NOT_CONFIGURED");
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("bearerToken");
    });

    it("reports CONFIGURED for LOGIN_FORM when at least one Test Account exists", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: "https://target.example.com/login",
        usernameField: "user",
        passwordField: "pass",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });
      prisma.testAccount.count.mockResolvedValue(2);

      const result = await service.get("p-1", "e-1");

      expect(result.credentialStatus).toBe("CONFIGURED");
    });

    it("reports CONFIGURED when a Bearer Token secret is present", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("ct"),
      });

      const result = await service.get("p-1", "e-1");

      expect(result.credentialStatus).toBe("CONFIGURED");
    });
  });

  describe("putConfiguration", () => {
    it("rejects LOGIN_FORM with a malformed loginUrl with 400 VALIDATION_ERROR", async () => {
      const { service, prisma } = makeService();

      await expect(
        service.putConfiguration(
          "p-1",
          "e-1",
          {
            authType: "LOGIN_FORM",
            loginMode: "MANUAL",
            loginUrl: "not a url",
            usernameField: "user",
            passwordField: "pass",
          } as never,
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
          "e-1",
          {
            authType: "LOGIN_FORM",
            loginMode: "MANUAL",
            loginUrl: "ftp://host/path",
            usernameField: "user",
            passwordField: "pass",
          } as never,
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
          "e-1",
          {
            authType: "LOGIN_FORM",
            loginMode: "MANUAL",
            loginUrl: "https://target.example.com/login",
            usernameField: "same",
            passwordField: "same",
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

      await expect(service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1")).rejects.toBeInstanceOf(
        BusinessException,
      );
    });

    it("never touches bearer token columns when authType changes, and audits AUTH_TYPE_CHANGED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "NONE",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1");

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create).not.toHaveProperty("bearerTokenCiphertext");
      expect(upsertArgs.create).not.toHaveProperty("bearerTokenIv");
      expect(upsertArgs.create).not.toHaveProperty("bearerTokenAuthTag");
      expect(auditWriter.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "AUTH_TYPE_CHANGED" }),
        prisma,
      );
      const auditCall = auditWriter.record.mock.calls[0][0];
      expect(JSON.stringify(auditCall)).not.toMatch(/[Cc]iphertext/);
    });

    it("preserves Test Accounts when authType changes away from LOGIN_FORM", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        contextVersion: 2,
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "NONE",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1");

      expect(prisma.testAccount.deleteMany).not.toHaveBeenCalled();
    });

    it("does not clear Test Accounts when authType is changed but was not previously LOGIN_FORM", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 2,
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "NONE",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1");

      expect(prisma.testAccount.deleteMany).not.toHaveBeenCalled();
    });

    it("does not touch existing secret bytes when authType is unchanged, and audits AUTHENTICATION_CONFIGURATION_UPDATED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "NONE", bearerTokenCiphertext: null });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "NONE",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1");

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
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1");

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create.contextVersion).toBe(1);
    });

    it("increments contextVersion when authType changes on an existing row", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 3,
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "NONE",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1");

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create.contextVersion).toBe(4);
    });

    it("does not increment contextVersion for a LOGIN_FORM structural-field-only edit (authType unchanged)", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        contextVersion: 5,
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginUrl: "https://target.example.com/login-v2",
        usernameField: "user",
        passwordField: "pass",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration(
        "p-1",
        "e-1",
        {
          authType: "LOGIN_FORM",
          loginMode: "MANUAL",
          loginUrl: "https://target.example.com/login-v2",
          usernameField: "user",
          passwordField: "pass",
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
        contextVersion: 2,
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("ct"),
      });

      await service.putConfiguration("p-1", "e-1", { authType: "BEARER_TOKEN" } as never, "user-1");

      const upsertArgs = prisma.authenticationConfiguration.upsert.mock.calls[0][0];
      expect(upsertArgs.create.contextVersion).toBe(2);
    });
  });

  describe("putCredential", () => {
    it("rejects with 409 INVALID_STATE when current authType is NONE", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);

      const error = await service.putCredential("p-1", "e-1", { token: "secret" } as never, "user-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(409);
    });

    it("rejects with 409 INVALID_STATE when current authType is LOGIN_FORM (managed via Test Accounts instead)", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "LOGIN_FORM", bearerTokenCiphertext: null });

      const error = await service.putCredential("p-1", "e-1", { token: "secret" } as never, "user-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("audits CREDENTIAL_REPLACED when a secret already exists", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "BEARER_TOKEN", bearerTokenCiphertext: Buffer.from("old") });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("new"),
      });

      await service.putCredential("p-1", "e-1", { token: "Bearer new-token-value" } as never, "user-1");

      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "CREDENTIAL_REPLACED" }), prisma);
    });

    it("strips a leading 'Bearer ' prefix from a submitted token", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "BEARER_TOKEN", bearerTokenCiphertext: null });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("ct"),
      });

      await service.putCredential("p-1", "e-1", { token: "Bearer   raw-token  " } as never, "user-1");

      expect(prisma.authenticationConfiguration.update).toHaveBeenCalled();
    });

    // context_version (Group 5 Q5 answer): rotate-vs-identity-change rules.
    it("increments contextVersion by default when a BEARER_TOKEN is replaced", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 2,
        bearerTokenCiphertext: Buffer.from("old"),
      });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("new"),
      });

      await service.putCredential("p-1", "e-1", { token: "new-token" } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data.contextVersion).toEqual({ increment: 1 });
    });

    it("does not increment contextVersion when sameIdentity is true for a BEARER_TOKEN replacement", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 2,
        bearerTokenCiphertext: Buffer.from("old"),
      });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("new"),
      });

      await service.putCredential("p-1", "e-1", { token: "new-token", sameIdentity: true } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("contextVersion");
    });

    it("does not increment contextVersion on the very first credential ever set on a row (BEARER_TOKEN)", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 1,
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("first"),
      });

      await service.putCredential("p-1", "e-1", { token: "first-token" } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("contextVersion");
    });
  });

  describe("removeCredential", () => {
    it("is idempotent (no audit event) when already Not configured", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "LOGIN_FORM", bearerTokenCiphertext: null });

      const result = await service.removeCredential("p-1", "e-1", "user-1");

      expect(result.credentialStatus).toBe("NOT_CONFIGURED");
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
      expect(auditWriter.record).not.toHaveBeenCalled();
    });

    it("removes the secret, keeps authType, and audits CREDENTIAL_REMOVED", async () => {
      const { service, prisma, auditWriter } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({ authType: "BEARER_TOKEN", bearerTokenCiphertext: Buffer.from("ct") });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      const result = await service.removeCredential("p-1", "e-1", "user-1");

      expect(result).toMatchObject({ authType: "BEARER_TOKEN", credentialStatus: "NOT_CONFIGURED" });
      expect(auditWriter.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "CREDENTIAL_REMOVED" }), prisma);
    });

    // context_version (Group 5 Q5 answer): removal is an access change.
    it("increments contextVersion when actually removing a configured credential", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 3,
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.removeCredential("p-1", "e-1", "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data.contextVersion).toEqual({ increment: 1 });
    });
  });

  // REQ-AUTH-001 VER of the Login Form contract: every required field is
  // enforced server-side, independently of the client's own validation.
  describe("putConfiguration — LOGIN_FORM field requirements", () => {
    const BASE = {
      authType: "LOGIN_FORM",
      loginMode: "MANUAL",
      loginUrl: "https://target.example.com/login",
      usernameField: "user",
      passwordField: "pass",
    };

    async function expectRejected(overrides: Record<string, unknown>, status: number) {
      const { service, prisma } = makeService();
      const error = await service
        .putConfiguration("p-1", "e-1", { ...BASE, ...overrides } as never, "user-1")
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(status);
      expect(prisma.authenticationConfiguration.upsert).not.toHaveBeenCalled();
    }

    it("rejects a missing loginUrl, usernameField or passwordField with 400", async () => {
      await expectRejected({ loginUrl: "" }, 400);
      await expectRejected({ usernameField: "" }, 400);
      await expectRejected({ passwordField: "" }, 400);
    });

    it("stores no Login Form metadata for NONE or BEARER_TOKEN", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { ...BASE, authType: "BEARER_TOKEN" } as never, "user-1");

      expect(prisma.authenticationConfiguration.upsert.mock.calls[0][0].create).toMatchObject({
        loginUrl: null,
        usernameField: null,
        passwordField: null,
      });
    });
  });

  // Phase C: "Import Login Request from cURL/fetch" — loginMode: "IMPORTED".
  describe("putConfiguration — LOGIN_FORM/IMPORTED field requirements", () => {
    const BASE_IMPORTED = {
      authType: "LOGIN_FORM",
      loginMode: "IMPORTED",
      importMethod: "POST",
      importUrl: "https://target.example.com/oauth/token",
      importHeaders: [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }],
      importBodyFormat: "FORM_URLENCODED",
      importBodyFields: [
        { name: "grant_type", value: "password" },
        { name: "app_name", value: "CoShareAdmin" },
        { name: "username", value: "placeholder" },
        { name: "password", value: "placeholder" },
      ],
      importUsernameLocation: { kind: "BODY", name: "username" },
      importPasswordLocation: { kind: "BODY", name: "password" },
    };

    async function expectRejected(overrides: Record<string, unknown>, status: number) {
      const { service, prisma } = makeService();
      const error = await service
        .putConfiguration("p-1", "e-1", { ...BASE_IMPORTED, ...overrides } as never, "user-1")
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).getStatus()).toBe(status);
      expect(prisma.authenticationConfiguration.upsert).not.toHaveBeenCalled();
      return error as BusinessException;
    }

    it("rejects a missing importUrl with 400", async () => {
      await expectRejected({ importUrl: "" }, 400);
    });

    it("rejects a non-HTTP(S) importUrl with 422", async () => {
      await expectRejected({ importUrl: "ftp://host/path" }, 422);
    });

    it("rejects a missing importMethod with 422", async () => {
      await expectRejected({ importMethod: "" }, 422);
    });

    it("rejects an unsupported importMethod with 422", async () => {
      await expectRejected({ importMethod: "TRACE" }, 422);
    });

    it("rejects a missing importBodyFormat with 400", async () => {
      await expectRejected({ importBodyFormat: "" }, 400);
    });

    it("rejects empty importBodyFields when importBodyFormat is not NONE, with 422", async () => {
      await expectRejected({ importBodyFields: [] }, 422);
    });

    it("allows empty importBodyFields when importBodyFormat is NONE", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration(
        "p-1",
        "e-1",
        {
          ...BASE_IMPORTED,
          importHeaders: [
            { name: "X-Username", value: "placeholder" },
            { name: "X-Password", value: "placeholder" },
          ],
          importBodyFormat: "NONE",
          importBodyFields: [],
          importUsernameLocation: { kind: "HEADER", name: "X-Username" },
          importPasswordLocation: { kind: "HEADER", name: "X-Password" },
        } as never,
        "user-1",
      );

      expect(prisma.authenticationConfiguration.upsert).toHaveBeenCalled();
    });

    it("rejects a missing importUsernameLocation with 400", async () => {
      await expectRejected({ importUsernameLocation: undefined }, 400);
    });

    it("rejects a missing importPasswordLocation with 400", async () => {
      await expectRejected({ importPasswordLocation: undefined }, 400);
    });

    it("rejects identical importUsernameLocation and importPasswordLocation with 422", async () => {
      await expectRejected(
        {
          importUsernameLocation: { kind: "BODY", name: "username" },
          importPasswordLocation: { kind: "BODY", name: "username" },
        },
        422,
      );
    });

    it("rejects importUsernameLocation naming a field absent from headers/body with 422", async () => {
      await expectRejected({ importUsernameLocation: { kind: "BODY", name: "does_not_exist" } }, 422);
    });

    it("rejects importPasswordLocation naming a field absent from headers/body with 422", async () => {
      await expectRejected({ importPasswordLocation: { kind: "HEADER", name: "does_not_exist" } }, 422);
    });

    it("persists the IMPORTED shape and nulls the MANUAL columns", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(null);
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", BASE_IMPORTED as never, "user-1");

      const created = prisma.authenticationConfiguration.upsert.mock.calls[0][0].create;
      expect(created).toMatchObject({
        loginMode: "IMPORTED",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        importMethod: "POST",
        importUrl: "https://target.example.com/oauth/token",
        importBodyFormat: "FORM_URLENCODED",
      });
    });

    it("switching an existing MANUAL row to IMPORTED preserves the MANUAL columns and does not bump contextVersion", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "MANUAL",
        contextVersion: 5,
        loginUrl: "https://target.example.com/login",
        usernameField: "user",
        passwordField: "pass",
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", BASE_IMPORTED as never, "user-1");

      const created = prisma.authenticationConfiguration.upsert.mock.calls[0][0].create;
      expect(created.contextVersion).toBe(5);
      expect(created).toMatchObject({
        loginUrl: "https://target.example.com/login",
        usernameField: "user",
        passwordField: "pass",
        loginMode: "IMPORTED",
      });
    });

    it("switching an existing IMPORTED row back to MANUAL preserves the import* columns", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        contextVersion: 5,
        importMethod: "POST",
        importUrl: "https://target.example.com/oauth/token",
        importHeaders: [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }],
        importBodyFormat: "FORM_URLENCODED",
        importBodyFields: [{ name: "username", value: "" }],
        importUsernameLocation: { kind: "BODY", name: "username" },
        importPasswordLocation: { kind: "BODY", name: "password" },
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "MANUAL",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration(
        "p-1",
        "e-1",
        {
          authType: "LOGIN_FORM",
          loginMode: "MANUAL",
          loginUrl: "https://target.example.com/login",
          usernameField: "user",
          passwordField: "pass",
        } as never,
        "user-1",
      );

      const created = prisma.authenticationConfiguration.upsert.mock.calls[0][0].create;
      expect(created.contextVersion).toBe(5);
      expect(created).toMatchObject({
        loginMode: "MANUAL",
        importMethod: "POST",
        importUrl: "https://target.example.com/oauth/token",
        importBodyFormat: "FORM_URLENCODED",
      });
      expect(created.importHeaders).toEqual([{ name: "Content-Type", value: "application/x-www-form-urlencoded" }]);
      expect(created.importBodyFields).toEqual([{ name: "username", value: "" }]);
      expect(created.importUsernameLocation).toEqual({ kind: "BODY", name: "username" });
      expect(created.importPasswordLocation).toEqual({ kind: "BODY", name: "password" });
    });

    it("does not increment contextVersion for an IMPORTED-field-only edit (authType and loginMode unchanged)", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        contextVersion: 7,
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration(
        "p-1",
        "e-1",
        { ...BASE_IMPORTED, importUrl: "https://target.example.com/oauth/token-v2" } as never,
        "user-1",
      );

      const created = prisma.authenticationConfiguration.upsert.mock.calls[0][0].create;
      expect(created.contextVersion).toBe(7);
    });

    it("never includes bearer token columns across a BEARER_TOKEN -> LOGIN_FORM -> BEARER_TOKEN switch", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        contextVersion: 1,
        bearerTokenCiphertext: Buffer.from("ct"),
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", BASE_IMPORTED as never, "user-1");

      const secondExisting = { authType: "LOGIN_FORM", loginMode: "IMPORTED", contextVersion: 2, bearerTokenCiphertext: null };
      prisma.authenticationConfiguration.findUnique.mockResolvedValue(secondExisting);
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "BEARER_TOKEN",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "BEARER_TOKEN" } as never, "user-1");

      for (const call of prisma.authenticationConfiguration.upsert.mock.calls) {
        expect(call[0].create).not.toHaveProperty("bearerTokenCiphertext");
        expect(call[0].create).not.toHaveProperty("bearerTokenIv");
        expect(call[0].create).not.toHaveProperty("bearerTokenAuthTag");
      }
    });

    it("restores a previously-saved IMPORTED shape when switching back to LOGIN_FORM without resending import fields", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "NONE",
        contextVersion: 3,
        loginMode: "IMPORTED",
        importMethod: "POST",
        importUrl: "https://target.example.com/oauth/token",
        importHeaders: [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }],
        importBodyFormat: "FORM_URLENCODED",
        importBodyFields: [{ name: "username", value: "" }],
        importUsernameLocation: { kind: "BODY", name: "username" },
        importPasswordLocation: { kind: "BODY", name: "password" },
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });

      await service.putConfiguration("p-1", "e-1", { authType: "LOGIN_FORM", loginMode: "IMPORTED" } as never, "user-1");

      const created = prisma.authenticationConfiguration.upsert.mock.calls[0][0].create;
      expect(created).toMatchObject({
        loginMode: "IMPORTED",
        importMethod: "POST",
        importUrl: "https://target.example.com/oauth/token",
        importBodyFormat: "FORM_URLENCODED",
      });
      expect(created.importHeaders).toEqual([{ name: "Content-Type", value: "application/x-www-form-urlencoded" }]);
      expect(created.importBodyFields).toEqual([{ name: "username", value: "" }]);
      expect(created.importUsernameLocation).toEqual({ kind: "BODY", name: "username" });
      expect(created.importPasswordLocation).toEqual({ kind: "BODY", name: "password" });
    });

    it("reflects the real preserved Test Account count (not forced to 0) after switching authType away from and back to LOGIN_FORM", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "NONE",
        contextVersion: 4,
        loginMode: "MANUAL",
        loginUrl: "https://target.example.com/login",
        usernameField: "user",
        passwordField: "pass",
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.upsert.mockResolvedValue({
        authType: "LOGIN_FORM",
        loginMode: "MANUAL",
        loginUrl: "https://target.example.com/login",
        usernameField: "user",
        passwordField: "pass",
        updatedAt: new Date(),
        bearerTokenCiphertext: null,
      });
      prisma.testAccount.count.mockResolvedValue(2);

      const result = await service.putConfiguration(
        "p-1",
        "e-1",
        { authType: "LOGIN_FORM", loginMode: "MANUAL" } as never,
        "user-1",
      );

      expect(result.credentialStatus).toBe("CONFIGURED");
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

      const error = await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.authenticationConfiguration.upsert).not.toHaveBeenCalled();
      expect(auditWriter.record).not.toHaveBeenCalled();
    });

    it("rejects putCredential with 409 INVALID_STATE", async () => {
      const { service, prisma } = inactiveProjectService();

      const error = await service.putCredential("p-1", "e-1", { token: "t" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("rejects removeCredential with 409 INVALID_STATE", async () => {
      const { service, prisma } = inactiveProjectService();

      const error = await service.removeCredential("p-1", "e-1", "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(409);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("rejects a soft-deleted Project with 404", async () => {
      const { service, prisma } = makeService();
      prisma.project.findFirst.mockResolvedValue(null);

      const error = await service.putConfiguration("p-1", "e-1", { authType: "NONE" } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(404);
    });
  });

  describe("putCredential — the secret must match the configured type", () => {
    it("rejects a missing token for BEARER_TOKEN with 400", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        bearerTokenCiphertext: null,
      });

      const error = await service.putCredential("p-1", "e-1", {} as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(400);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("rejects a token that is empty once the 'Bearer ' prefix is stripped, with 400", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        bearerTokenCiphertext: null,
      });

      const error = await service.putCredential("p-1", "e-1", { token: "Bearer    " } as never, "user-1").catch((e: unknown) => e);

      expect((error as BusinessException).getStatus()).toBe(400);
      expect(prisma.authenticationConfiguration.update).not.toHaveBeenCalled();
    });

    it("writes only the Bearer Token secret column", async () => {
      const { service, prisma } = makeService();
      prisma.authenticationConfiguration.findUnique.mockResolvedValue({
        authType: "BEARER_TOKEN",
        bearerTokenCiphertext: null,
      });
      prisma.authenticationConfiguration.update.mockResolvedValue({
        authType: "BEARER_TOKEN",
        loginUrl: null,
        usernameField: null,
        passwordField: null,
        updatedAt: new Date(),
        bearerTokenCiphertext: Buffer.from("ct"),
      });

      await service.putCredential("p-1", "e-1", { token: "raw-token" } as never, "user-1");

      const data = prisma.authenticationConfiguration.update.mock.calls[0][0].data;
      expect(data).toHaveProperty("bearerTokenCiphertext");
      expect(Buffer.from(data.bearerTokenCiphertext as Uint8Array).toString("utf8")).not.toContain("raw-token");
    });
  });
});
