import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse, mockTextResponse } from "../test/mock-fetch";
import { apiClient, ApiError } from "./api-client";

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches Authorization: Bearer <token> for authenticated requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(200, { userId: "u1" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.get("/users/me", "token-123");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("omits the Authorization header when no token is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(200, { accessToken: "x" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.post("/auth/google/login", { authorizationCode: "abc" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("resolves undefined for a 204 No Content response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse(204)));
    const result = await apiClient.post("/auth/logout", undefined, "token-123");
    expect(result).toBeUndefined();
  });

  it("throws an ApiError carrying the backend's error envelope verbatim", async () => {
    const envelope = { errorCode: "SESSION_EXPIRED", message: "Session expired", details: [], requestId: "req-1" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse(401, envelope)));

    await expect(apiClient.get("/users/me", "stale-token")).rejects.toMatchObject({
      errorCode: "SESSION_EXPIRED",
      status: 401,
      requestId: "req-1",
    });
  });

  it("wraps a non-JSON failure response as an ApiError instead of throwing raw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 502,
        ok: false,
        statusText: "Bad Gateway",
        headers: { get: () => null },
        json: async () => {
          throw new Error("no body");
        },
      }),
    );

    await expect(apiClient.get("/health")).rejects.toBeInstanceOf(ApiError);
  });

  it("sends a PATCH request with a JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(200, { userId: "u1", email: "new@example.com" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.patch("/users/u1", { email: "new@example.com" }, "token-123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/users/u1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ email: "new@example.com" }));
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("sends a DELETE request and resolves undefined for a 204 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(204));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.delete("/projects/p1/members/u1", "token-123");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(result).toBeUndefined();
  });

  it("getText returns the raw text body for a successful text/csv response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockTextResponse(200, "a,b\r\n1,2")));

    const result = await apiClient.getText("/audit-logs/export", "token-123");

    expect(result).toBe("a,b\r\n1,2");
  });

  it("getText still parses a JSON error envelope on failure", async () => {
    const envelope = { errorCode: "ACCESS_DENIED", message: "nope", details: [], requestId: "req-2" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse(403, envelope)));

    await expect(apiClient.getText("/audit-logs/export", "token-123")).rejects.toMatchObject({
      errorCode: "ACCESS_DENIED",
      status: 403,
    });
  });
});
