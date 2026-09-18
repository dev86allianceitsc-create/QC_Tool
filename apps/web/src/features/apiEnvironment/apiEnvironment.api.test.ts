import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import {
  confirmOpenApiImport,
  createApi,
  createEnvironment,
  deleteApi,
  getApi,
  getEnvironment,
  getRequestInput,
  listApiEnvironmentConfigs,
  listApis,
  listEnvironments,
  previewOpenApiImport,
  putApiEnvironmentConfig,
  putRequestInput,
  updateApi,
  updateEnvironment,
} from "./apiEnvironment.api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiEnvironment.api", () => {
  it("listApis sends page/pageSize/search/httpMethod as query params", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 });

    await listApis("p1", { pageSize: 100, search: "orders", httpMethod: "GET" }, "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis?");
    expect(String(url)).toContain("pageSize=100");
    expect(String(url)).toContain("search=orders");
    expect(String(url)).toContain("httpMethod=GET");
  });

  it("createApi POSTs /projects/:projectId/apis with apiName/httpMethod/path/description", async () => {
    const fetchMock = stubFetch({ apiId: "a1", projectId: "p1", apiName: "X", httpMethod: "GET", path: "/x", description: null, creationSource: "MANUAL", createdAt: "t", updatedAt: "t" }, 201);

    await createApi("p1", { apiName: "X", httpMethod: "GET", path: "/x", description: null }, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ apiName: "X", httpMethod: "GET", path: "/x", description: null }));
  });

  it("getApi GETs /projects/:projectId/apis/:apiId", async () => {
    const fetchMock = stubFetch({ apiId: "a1", projectId: "p1", apiName: "X", httpMethod: "GET", path: "/x", description: null, creationSource: "MANUAL", createdAt: "t", updatedAt: "t" });

    await getApi("p1", "a1", "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1");
  });

  it("updateApi PATCHes /projects/:projectId/apis/:apiId", async () => {
    const fetchMock = stubFetch({ apiId: "a1", projectId: "p1", apiName: "Y", httpMethod: "GET", path: "/x", description: null, creationSource: "MANUAL", createdAt: "t", updatedAt: "t" });

    await updateApi("p1", "a1", { apiName: "Y" }, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ apiName: "Y" }));
  });

  it("deleteApi DELETEs /projects/:projectId/apis/:apiId", async () => {
    const fetchMock = stubFetch(undefined, 204);

    await deleteApi("p1", "a1", "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1");
    expect(init.method).toBe("DELETE");
  });

  it("previewOpenApiImport POSTs multipart form data with no explicit Content-Type", async () => {
    const fetchMock = stubFetch({ specification: { format: "JSON", detectedVersion: "3.0.0" }, items: [], totalCandidates: 0 });
    const file = new File(["{}"], "spec.json", { type: "application/json" });

    await previewOpenApiImport("p1", file, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/api-imports/preview");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect(init.headers?.["Content-Type"]).toBeUndefined();
  });

  it("confirmOpenApiImport POSTs the file plus selectedCandidates as a JSON string part", async () => {
    const fetchMock = stubFetch({ results: [], summary: { imported: 0, skipped: 0, failed: 0 } });
    const file = new File(["{}"], "spec.json", { type: "application/json" });
    const selected = [{ httpMethod: "GET", path: "/x" }];

    await confirmOpenApiImport("p1", file, selected, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/api-imports");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("selectedCandidates")).toBe(JSON.stringify(selected));
    expect(init.headers?.["Content-Type"]).toBeUndefined();
  });

  it("listEnvironments sends page/pageSize/search/status/classification as query params", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 });

    await listEnvironments("p1", { pageSize: 100, status: "ACTIVE", classification: "PRODUCTION" }, "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/environments?");
    expect(String(url)).toContain("status=ACTIVE");
    expect(String(url)).toContain("classification=PRODUCTION");
  });

  it("createEnvironment POSTs /projects/:projectId/environments with environmentName/classification only", async () => {
    const fetchMock = stubFetch({ environmentId: "e1", projectId: "p1", environmentName: "QA", classification: "NON_PRODUCTION", allowRun: true, environmentStatus: "ACTIVE", createdAt: "t", updatedAt: "t" }, 201);

    await createEnvironment("p1", { environmentName: "QA", classification: "NON_PRODUCTION" }, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/environments");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ environmentName: "QA", classification: "NON_PRODUCTION" }));
  });

  it("getEnvironment GETs /projects/:projectId/environments/:environmentId", async () => {
    const fetchMock = stubFetch({ environmentId: "e1", projectId: "p1", environmentName: "QA", classification: "NON_PRODUCTION", allowRun: true, environmentStatus: "ACTIVE", createdAt: "t", updatedAt: "t" });

    await getEnvironment("p1", "e1", "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/environments/e1");
  });

  it("updateEnvironment PATCHes /projects/:projectId/environments/:environmentId with only given fields", async () => {
    const fetchMock = stubFetch({ environmentId: "e1", projectId: "p1", environmentName: "QA", classification: "PRODUCTION", allowRun: false, environmentStatus: "ACTIVE", createdAt: "t", updatedAt: "t" });

    await updateEnvironment("p1", "e1", { classification: "PRODUCTION" }, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/environments/e1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ classification: "PRODUCTION" }));
  });

  it("listApiEnvironmentConfigs GETs /projects/:projectId/apis/:apiId/environment-configs", async () => {
    const fetchMock = stubFetch({ apiId: "a1", items: [] });

    await listApiEnvironmentConfigs("p1", "a1", "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1/environment-configs");
  });

  it("putApiEnvironmentConfig PUTs /projects/:projectId/apis/:apiId/environment-configs/:environmentId with fullUrl", async () => {
    const fetchMock = stubFetch({ apiId: "a1", environmentId: "e1", urlStatus: "CONFIGURED", fullUrl: "https://example.com", createdAt: "t", updatedAt: "t" });

    await putApiEnvironmentConfig("p1", "a1", "e1", "https://example.com", "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1/environment-configs/e1");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ fullUrl: "https://example.com" }));
  });

  it("getRequestInput GETs /projects/:projectId/apis/:apiId/request-input", async () => {
    const fetchMock = stubFetch({
      apiId: "a1",
      httpMethod: "GET",
      path: "/widgets/{id}",
      pathParameters: [{ name: "id", required: true, source: "AUTO_DETECTED" }],
      queryParameters: [],
      headerParameters: [],
      requestBody: null,
    });

    await getRequestInput("p1", "a1", "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1/request-input");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("putRequestInput PUTs /projects/:projectId/apis/:apiId/request-input with only queryParameters/headerParameters/requestBody", async () => {
    const fetchMock = stubFetch({
      apiId: "a1",
      httpMethod: "GET",
      path: "/widgets/{id}",
      pathParameters: [{ name: "id", required: true, source: "AUTO_DETECTED" }],
      queryParameters: [{ name: "status", required: false }],
      headerParameters: [{ name: "X-Client-ID", required: true }],
      requestBody: { bodyType: "JSON" },
    });

    await putRequestInput(
      "p1",
      "a1",
      {
        queryParameters: [{ name: "status", required: false }],
        headerParameters: [{ name: "X-Client-ID", required: true }],
        requestBody: { bodyType: "JSON" },
      },
      "token-1",
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1/request-input");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(
      JSON.stringify({
        queryParameters: [{ name: "status", required: false }],
        headerParameters: [{ name: "X-Client-ID", required: true }],
        requestBody: { bodyType: "JSON" },
      }),
    );
  });

  it("putRequestInput sends requestBody: null explicitly for the no-body case", async () => {
    const fetchMock = stubFetch({
      apiId: "a1",
      httpMethod: "GET",
      path: "/widgets",
      pathParameters: [],
      queryParameters: [],
      headerParameters: [],
      requestBody: null,
    });

    await putRequestInput("p1", "a1", { queryParameters: [], headerParameters: [], requestBody: null }, "token-1");

    const [, init] = fetchMock.mock.calls[0];
    const parsed = JSON.parse(init.body as string);
    expect(parsed).toEqual({ queryParameters: [], headerParameters: [], requestBody: null });
    expect(Object.keys(parsed)).toEqual(["queryParameters", "headerParameters", "requestBody"]);
  });
});
