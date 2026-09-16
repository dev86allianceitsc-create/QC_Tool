import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "./useApiErrorHandler";

function err(errorCode: string) {
  return new ApiError(0, { errorCode, message: "x", details: [], requestId: "r1" });
}

describe("useApiErrorHandler", () => {
  it.each(["SESSION_INVALID", "SESSION_EXPIRED", "SESSION_REVOKED"])(
    "routes %s to onSessionExpired and reports handled",
    (code) => {
      const onSessionExpired = vi.fn();
      const onAccessDenied = vi.fn();
      const { result } = renderHook(() => useApiErrorHandler(onSessionExpired, onAccessDenied));

      const handled = result.current(err(code));

      expect(handled).toBe(true);
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
      expect(onAccessDenied).not.toHaveBeenCalled();
    },
  );

  it.each(["ACCESS_DENIED", "PROJECT_ACCESS_DENIED", "ROLE_NOT_ASSIGNED"])(
    "routes %s to onAccessDenied and reports handled",
    (code) => {
      const onSessionExpired = vi.fn();
      const onAccessDenied = vi.fn();
      const { result } = renderHook(() => useApiErrorHandler(onSessionExpired, onAccessDenied));

      const handled = result.current(err(code));

      expect(handled).toBe(true);
      expect(onAccessDenied).toHaveBeenCalledTimes(1);
      expect(onSessionExpired).not.toHaveBeenCalled();
    },
  );

  it("returns false and calls neither callback for an unrelated error code", () => {
    const onSessionExpired = vi.fn();
    const onAccessDenied = vi.fn();
    const { result } = renderHook(() => useApiErrorHandler(onSessionExpired, onAccessDenied));

    const handled = result.current(err("CONFLICT"));

    expect(handled).toBe(false);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(onAccessDenied).not.toHaveBeenCalled();
  });

  it("returns false for a non-ApiError value", () => {
    const { result } = renderHook(() => useApiErrorHandler(vi.fn(), vi.fn()));
    expect(result.current(new Error("boom"))).toBe(false);
  });
});
