import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { updateInvitedUserEmail } from "./users.api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("updateInvitedUserEmail (API-USR-005)", () => {
  it("PATCHes /users/:userId with only the email field", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockJsonResponse(200, { userId: "u1", email: "new@example.com", accountStatus: "INVITED" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateInvitedUserEmail("u1", "new@example.com", "token-123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/users/u1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ email: "new@example.com" }));
    expect(init.headers.Authorization).toBe("Bearer token-123");
    expect(result).toEqual({ userId: "u1", email: "new@example.com", accountStatus: "INVITED" });
  });
});
