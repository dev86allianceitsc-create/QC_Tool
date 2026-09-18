import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { useRequestInput } from "./useRequestInput";

const DEFINITION = {
  apiId: "a1",
  httpMethod: "GET",
  path: "/widgets/{id}",
  pathParameters: [{ name: "id", required: true, source: "AUTO_DETECTED" }],
  queryParameters: [],
  headerParameters: [],
  requestBody: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useRequestInput — load", () => {
  it("GETs /projects/:projectId/apis/:apiId/request-input on mount", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", vi.fn(), vi.fn()));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/apis/a1/request-input");
    expect(result.current.definition).toEqual(DEFINITION);
    expect(result.current.error).toBeNull();
  });

  it("populates Path/Query/Header/Body from the GET response", async () => {
    const withAll = {
      ...DEFINITION,
      queryParameters: [{ name: "status", required: false }],
      headerParameters: [{ name: "X-Client-ID", required: true }],
      requestBody: { bodyType: "JSON" },
    };
    stubFetch(withAll);
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", vi.fn(), vi.fn()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.definition).toEqual(withAll);
  });

  it("handles an empty Definition (no query/header/body configured)", async () => {
    stubFetch(DEFINITION);
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", vi.fn(), vi.fn()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.definition?.queryParameters).toEqual([]);
    expect(result.current.definition?.headerParameters).toEqual([]);
    expect(result.current.definition?.requestBody).toBeNull();
  });

  it("shows loading then an inline error for a non-auth GET failure", async () => {
    stubFetch({ errorCode: "NOT_FOUND", message: "API not found" }, 404);
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", vi.fn(), vi.fn()));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("API not found");
    expect(result.current.definition).toBeNull();
  });

  it("routes 401 SESSION_EXPIRED through onSessionExpired without setting an inline error", async () => {
    stubFetch({ errorCode: "SESSION_EXPIRED", message: "expired" }, 401);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onSessionExpired).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("routes 403 PROJECT_ACCESS_DENIED through onAccessDenied", async () => {
    stubFetch({ errorCode: "PROJECT_ACCESS_DENIED", message: "denied" }, 403);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onAccessDenied).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("switching apiId does not leak the previous API's Definition", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result, rerender } = renderHook(
      ({ apiId }: { apiId: string }) => useRequestInput("p1", apiId, "token-1", onSessionExpired, onAccessDenied),
      { initialProps: { apiId: "a1" } },
    );
    await waitFor(() => expect(result.current.definition).toEqual(DEFINITION));

    const OTHER_DEFINITION = { ...DEFINITION, apiId: "a2", path: "/other", queryParameters: [{ name: "q", required: false }] };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, OTHER_DEFINITION));
    rerender({ apiId: "a2" });

    expect(result.current.definition).toBeNull();
    await waitFor(() => expect(result.current.definition).toEqual(OTHER_DEFINITION));
    const [url] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/apis/a2/request-input");
  });
});

describe("useRequestInput — save", () => {
  it("save() PUTs only queryParameters/headerParameters/requestBody, never pathParameters", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const saved = { ...DEFINITION, queryParameters: [{ name: "status", required: false }] };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, saved));

    await act(async () => {
      await result.current.save({ queryParameters: [{ name: "status", required: false }], headerParameters: [], requestBody: null });
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/projects/p1/apis/a1/request-input");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ queryParameters: [{ name: "status", required: false }], headerParameters: [], requestBody: null });
    expect(body.pathParameters).toBeUndefined();
  });

  it("a successful save() updates definition to the PUT response", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const saved = { ...DEFINITION, requestBody: { bodyType: "JSON" as const } };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, saved));

    await act(async () => {
      await result.current.save({ queryParameters: [], headerParameters: [], requestBody: { bodyType: "JSON" } });
    });

    expect(result.current.definition).toEqual(saved);
  });

  it("a failed save() leaves definition unchanged and rejects", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(409, { errorCode: "CONFLICT", message: "Conflict" }));

    await expect(
      act(async () => {
        await result.current.save({ queryParameters: [], headerParameters: [], requestBody: null });
      }),
    ).rejects.toThrow();

    expect(result.current.definition).toEqual(DEFINITION);
  });

  it("surfaces a 422 semantic validation failure by rejecting with the backend message", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(422, { errorCode: "SEMANTIC_VALIDATION_ERROR", message: "Authorization is reserved" }));

    await expect(
      act(async () => {
        await result.current.save({ queryParameters: [], headerParameters: [{ name: "Authorization", required: false }], requestBody: null });
      }),
    ).rejects.toThrow("Authorization is reserved");
  });

  it("routes 401 on save() through onSessionExpired", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValueOnce(mockJsonResponse(401, { errorCode: "SESSION_EXPIRED", message: "expired" }));

    await expect(
      act(async () => {
        await result.current.save({ queryParameters: [], headerParameters: [], requestBody: null });
      }),
    ).rejects.toThrow();
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it("sets saving true only while the PUT is in flight", async () => {
    const fetchMock = stubFetch(DEFINITION);
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useRequestInput("p1", "a1", "token-1", onSessionExpired, onAccessDenied));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolvePut: (value: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolvePut = resolve; }));

    let savePromise!: Promise<unknown>;
    act(() => {
      savePromise = result.current.save({ queryParameters: [], headerParameters: [], requestBody: null });
    });
    await waitFor(() => expect(result.current.saving).toBe(true));

    resolvePut(mockJsonResponse(200, DEFINITION));
    await act(async () => {
      await savePromise;
    });
    expect(result.current.saving).toBe(false);
  });
});
