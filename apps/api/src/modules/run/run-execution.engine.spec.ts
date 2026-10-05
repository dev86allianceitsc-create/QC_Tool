import { RunExecutionEngine } from "./run-execution.engine";
import { computeTestCaseKey } from "./test-case-identity.util";

process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

type ImportedLoginAuthConfig = {
  importUrl: string | null;
  importMethod: string | null;
  importHeaders: unknown;
  importBodyFormat: string | null;
  importBodyFields: unknown;
  importUsernameLocation: unknown;
  importPasswordLocation: unknown;
};

describe("RunExecutionEngine — performImportedLoginFormAuth (Phase C: Import Login Request)", () => {
  function makeEngine() {
    return new RunExecutionEngine({} as never, {} as never, {} as never, {} as never);
  }

  function callPerformImportedLoginFormAuth(engine: RunExecutionEngine, authConfig: ImportedLoginAuthConfig, username: string, password: string): Promise<string> {
    return (engine as unknown as { performImportedLoginFormAuth: (authConfig: ImportedLoginAuthConfig, username: string, password: string) => Promise<string> }).performImportedLoginFormAuth(
      authConfig,
      username,
      password,
    );
  }

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("builds a JSON body, substitutes the username into a header and the password into a body field, and extracts the access token", async () => {
    const engine = makeEngine();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ access_token: "tok-json" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const token = await callPerformImportedLoginFormAuth(
      engine,
      {
        importUrl: "https://target.example.com/oauth/token",
        importMethod: "POST",
        importHeaders: [{ name: "X-Username", value: "placeholder" }],
        importBodyFormat: "JSON",
        importBodyFields: [{ name: "password", value: "placeholder" }],
        importUsernameLocation: { kind: "HEADER", name: "X-Username" },
        importPasswordLocation: { kind: "BODY", name: "password" },
      },
      "alice",
      "s3cret",
    );

    expect(token).toBe("tok-json");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://target.example.com/oauth/token");
    expect(options.method).toBe("POST");
    expect(options.headers["X-Username"]).toBe("alice");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ password: "s3cret" });
  });

  it("builds a form-urlencoded body, substitutes both username and password into body fields, and keeps unrelated fields (e.g. grant_type) unchanged", async () => {
    const engine = makeEngine();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ access_token: "tok-form" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const token = await callPerformImportedLoginFormAuth(
      engine,
      {
        importUrl: "https://dev.coshare.vn/connect/token",
        importMethod: "POST",
        importHeaders: [],
        importBodyFormat: "FORM_URLENCODED",
        importBodyFields: [
          { name: "grant_type", value: "password" },
          { name: "app_name", value: "CoShareAdmin" },
          { name: "username", value: "placeholder" },
          { name: "password", value: "placeholder" },
        ],
        importUsernameLocation: { kind: "BODY", name: "username" },
        importPasswordLocation: { kind: "BODY", name: "password" },
      },
      "bob",
      "hunter2",
    );

    expect(token).toBe("tok-form");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const parsedBody = new URLSearchParams(options.body);
    expect(parsedBody.get("grant_type")).toBe("password");
    expect(parsedBody.get("app_name")).toBe("CoShareAdmin");
    expect(parsedBody.get("username")).toBe("bob");
    expect(parsedBody.get("password")).toBe("hunter2");
  });

  it("throws when the login endpoint returns a non-OK HTTP status", async () => {
    const engine = makeEngine();
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      callPerformImportedLoginFormAuth(
        engine,
        {
          importUrl: "https://target.example.com/login",
          importMethod: "POST",
          importHeaders: [],
          importBodyFormat: "NONE",
          importBodyFields: [],
          importUsernameLocation: { kind: "HEADER", name: "X-Username" },
          importPasswordLocation: { kind: "HEADER", name: "X-Password" },
        },
        "alice",
        "s3cret",
      ),
    ).rejects.toThrow("Login endpoint returned HTTP 401");
  });

  // Regression: a non-OK login response previously surfaced only the bare
  // status code, indistinguishable from "the imported request is malformed"
  // versus "the credentials are simply wrong" (e.g. an OAuth2 token
  // endpoint's own invalid_grant/invalid_client body). The response body is
  // now appended so an admin can see the real reason.
  it("appends the login response body to the error when the endpoint rejects the request", async () => {
    const engine = makeEngine();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant"}',
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      callPerformImportedLoginFormAuth(
        engine,
        {
          importUrl: "https://target.example.com/oauth2/token",
          importMethod: "POST",
          importHeaders: [],
          importBodyFormat: "FORM_URLENCODED",
          importBodyFields: [
            { name: "username", value: "placeholder" },
            { name: "password", value: "placeholder" },
          ],
          importUsernameLocation: { kind: "BODY", name: "username" },
          importPasswordLocation: { kind: "BODY", name: "password" },
        },
        "alice",
        "s3cret",
      ),
    ).rejects.toThrow('Login endpoint returned HTTP 400: {"error":"invalid_grant"}');
  });

  it("never fails the auth attempt when reading the error body itself fails", async () => {
    const engine = makeEngine();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => {
        throw new Error("body already consumed");
      },
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      callPerformImportedLoginFormAuth(
        engine,
        {
          importUrl: "https://target.example.com/oauth2/token",
          importMethod: "POST",
          importHeaders: [],
          importBodyFormat: "NONE",
          importBodyFields: [],
          importUsernameLocation: { kind: "HEADER", name: "X-Username" },
          importPasswordLocation: { kind: "HEADER", name: "X-Password" },
        },
        "alice",
        "s3cret",
      ),
    ).rejects.toThrow("Login endpoint returned HTTP 502");
  });

  it("throws a recognizable error when the login response contains no recognizable access token", async () => {
    const engine = makeEngine();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ unrelated: "value" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      callPerformImportedLoginFormAuth(
        engine,
        {
          importUrl: "https://target.example.com/login",
          importMethod: "POST",
          importHeaders: [],
          importBodyFormat: "JSON",
          importBodyFields: [{ name: "username", value: "placeholder" }, { name: "password", value: "placeholder" }],
          importUsernameLocation: { kind: "BODY", name: "username" },
          importPasswordLocation: { kind: "BODY", name: "password" },
        },
        "alice",
        "s3cret",
      ),
    ).rejects.toThrow("Login response did not contain a recognizable access token");
  });

  it("sends no body when importBodyFormat is NONE, still applying credentials to headers", async () => {
    const engine = makeEngine();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: "tok-none" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const token = await callPerformImportedLoginFormAuth(
      engine,
      {
        importUrl: "https://target.example.com/login",
        importMethod: "GET",
        importHeaders: [],
        importBodyFormat: "NONE",
        importBodyFields: [],
        importUsernameLocation: { kind: "HEADER", name: "X-Username" },
        importPasswordLocation: { kind: "HEADER", name: "X-Password" },
      },
      "alice",
      "s3cret",
    );

    expect(token).toBe("tok-none");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBeUndefined();
    expect(options.headers["X-Username"]).toBe("alice");
    expect(options.headers["X-Password"]).toBe("s3cret");
    expect(options.headers["Content-Type"]).toBeUndefined();
  });
});

// Phase 3 Test Case History & Run Again — dispatchOne freezes authType/
// testCaseKey identically across every terminal branch (success/HTTP-error,
// transport-error, authError), see run-execution.engine.ts's dispatchOne doc
// comment. Exercises the public dispatchRun entry point end-to-end (with
// prisma/snapshotService/comparisonService/comparisonEngineService fully
// mocked) rather than reaching into private methods, since the invariant
// under test is about the final RunExecution row, not any one internal step.
describe("RunExecutionEngine — dispatchOne freezes authType/testCaseKey identically across every terminal branch (Phase 3)", () => {
  const apiId = "a-1";
  const environmentId = "e-1";
  const requestValues = { pathValues: {}, queryValues: {}, headerValues: {}, bodyValue: "" };

  function makePrisma() {
    return {
      run: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          runId: "run-1",
          projectId: "p-1",
          project: { projectName: "Project" },
          environmentId,
          environment: { environmentName: "Env", baseUrl: "https://example.test", environmentStatus: "ACTIVE", allowRun: true },
          createdBy: "u-1",
          creator: { email: "user@example.com" },
          testAccountId: null,
          testAccount: null,
        }),
      },
      runExecution: {
        update: jest.fn().mockResolvedValue({ apiVersion: "UNKNOWN", databaseVersion: "UNKNOWN" }),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      apiConfiguration: { findUnique: jest.fn().mockResolvedValue({ apiId, httpMethod: "GET", path: "/x", apiName: "API" }) },
      apiEnvironmentConfig: { findUnique: jest.fn().mockResolvedValue({ fullUrl: "https://example.test/x" }) },
      authenticationConfiguration: { findUnique: jest.fn().mockResolvedValue(null) },
      requestBodyDefinition: { findUnique: jest.fn().mockResolvedValue(null) },
      snapshot: { findUnique: jest.fn().mockResolvedValue(null) },
      comparisonAttempt: { findFirst: jest.fn().mockResolvedValue(null) },
    };
  }

  function makeEngine(prisma: ReturnType<typeof makePrisma>) {
    const snapshotService = { tryCreateSnapshot: jest.fn().mockResolvedValue(undefined) };
    const comparisonService = { selectBaselineSnapshot: jest.fn().mockResolvedValue(null), tryCreateAutomaticComparison: jest.fn().mockResolvedValue(undefined) };
    const comparisonEngineService = { processAttempt: jest.fn().mockResolvedValue(undefined) };
    const engine = new RunExecutionEngine(prisma as never, snapshotService as never, comparisonService as never, comparisonEngineService as never);
    return { engine, snapshotService, comparisonService, comparisonEngineService };
  }

  // The terminal update is whichever runExecution.update call actually set
  // authType/testCaseKey — the earlier RUNNING-status and baseline-selection
  // updates on the same row never include either field.
  function terminalUpdateData(prisma: ReturnType<typeof makePrisma>): Record<string, unknown> {
    const call = prisma.runExecution.update.mock.calls.find((c) => "testCaseKey" in (c[0] as { data: Record<string, unknown> }).data);
    if (!call) {
      throw new Error("no terminal runExecution.update call with testCaseKey was made");
    }
    return (call[0] as { data: Record<string, unknown> }).data;
  }

  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("freezes authType=NONE and the matching testCaseKey on the response branch for a 2xx outcome", async () => {
    const prisma = makePrisma();
    const { engine } = makeEngine(prisma);
    global.fetch = jest.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

    await engine.dispatchRun("run-1", environmentId, [{ runExecutionId: "re-1", apiId, requestValues }]);

    const data = terminalUpdateData(prisma);
    expect(data.executionOutcome).toBe("RESPONSE_RECEIVED");
    expect(data.authType).toBe("NONE");
    expect(data.testCaseKey).toBe(computeTestCaseKey({ apiId, environmentId, authType: "NONE", testAccountId: null, ...requestValues }));
  });

  it("freezes the identical authType/testCaseKey on the response branch for a non-2xx (4xx/5xx) outcome", async () => {
    const prisma = makePrisma();
    const { engine } = makeEngine(prisma);
    global.fetch = jest.fn().mockResolvedValue(new Response("not found", { status: 404 })) as unknown as typeof fetch;

    await engine.dispatchRun("run-1", environmentId, [{ runExecutionId: "re-1", apiId, requestValues }]);

    const data = terminalUpdateData(prisma);
    expect(data.executionOutcome).toBe("RUN_ERROR");
    expect(data.errorReasonCode).toBe("HTTP_ERROR");
    expect(data.authType).toBe("NONE");
    expect(data.testCaseKey).toBe(computeTestCaseKey({ apiId, environmentId, authType: "NONE", testAccountId: null, ...requestValues }));
  });

  it("freezes the identical authType/testCaseKey on the transport-error catch branch", async () => {
    const prisma = makePrisma();
    const { engine } = makeEngine(prisma);
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await engine.dispatchRun("run-1", environmentId, [{ runExecutionId: "re-1", apiId, requestValues }]);

    const data = terminalUpdateData(prisma);
    expect(data.executionOutcome).toBe("RUN_ERROR");
    expect(data.authType).toBe("NONE");
    expect(data.testCaseKey).toBe(computeTestCaseKey({ apiId, environmentId, authType: "NONE", testAccountId: null, ...requestValues }));
  });

  it("freezes authType=BEARER_TOKEN and the matching testCaseKey on the authError branch — a decrypt failure never leaves either field unset", async () => {
    const prisma = makePrisma();
    prisma.authenticationConfiguration.findUnique.mockResolvedValue({
      authType: "BEARER_TOKEN",
      contextVersion: 1,
      bearerTokenCiphertext: Buffer.from("not-a-real-ciphertext"),
      bearerTokenIv: Buffer.alloc(12, 1),
      bearerTokenAuthTag: Buffer.alloc(16, 2),
    });
    const { engine } = makeEngine(prisma);

    await engine.dispatchRun("run-1", environmentId, [{ runExecutionId: "re-1", apiId, requestValues }]);

    const data = terminalUpdateData(prisma);
    expect(data.executionOutcome).toBe("RUN_ERROR");
    expect(data.authType).toBe("BEARER_TOKEN");
    expect(data.testCaseKey).toBe(computeTestCaseKey({ apiId, environmentId, authType: "BEARER_TOKEN", testAccountId: null, ...requestValues }));
  });

  it("never sets an authContextKey field on RunExecution — identity (testCaseKey) and auth-context safety stay fully independent", async () => {
    const prisma = makePrisma();
    const { engine } = makeEngine(prisma);
    global.fetch = jest.fn().mockResolvedValue(new Response("{}", { status: 200 })) as unknown as typeof fetch;

    await engine.dispatchRun("run-1", environmentId, [{ runExecutionId: "re-1", apiId, requestValues }]);

    for (const call of prisma.runExecution.update.mock.calls) {
      expect((call[0] as { data: Record<string, unknown> }).data).not.toHaveProperty("authContextKey");
    }
  });
});
