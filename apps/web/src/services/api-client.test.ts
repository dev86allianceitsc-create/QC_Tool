import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../test/mock-fetch";
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
});
