const getToken = jest.fn();
const verifyIdToken = jest.fn();

jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    getToken,
    verifyIdToken,
  })),
}));

import { GoogleAuthError, GoogleIdentityService } from "./google-identity.service";

describe("GoogleIdentityService", () => {
  let service: GoogleIdentityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GoogleIdentityService();
  });

  it("exchanges a code and verifies the id_token to return sub/email/emailVerified", async () => {
    getToken.mockResolvedValue({ tokens: { id_token: "fake-id-token" } });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-sub-1", email: "user@example.com", email_verified: true }),
    });

    const identity = await service.exchange("auth-code");
    expect(identity).toEqual({ sub: "google-sub-1", email: "user@example.com", emailVerified: true });
    expect(getToken).toHaveBeenCalledWith("auth-code");
  });

  it("throws GoogleAuthError when the code exchange itself fails", async () => {
    getToken.mockRejectedValue(new Error("invalid_grant"));
    await expect(service.exchange("bad-code")).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("throws GoogleAuthError when no id_token is returned", async () => {
    getToken.mockResolvedValue({ tokens: {} });
    await expect(service.exchange("auth-code")).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("throws GoogleAuthError when id_token verification fails", async () => {
    getToken.mockResolvedValue({ tokens: { id_token: "fake-id-token" } });
    verifyIdToken.mockRejectedValue(new Error("bad signature"));
    await expect(service.exchange("auth-code")).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("throws GoogleAuthError when the verified payload is missing sub/email", async () => {
    getToken.mockResolvedValue({ tokens: { id_token: "fake-id-token" } });
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email_verified: true }) });
    await expect(service.exchange("auth-code")).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("reports emailVerified: false when Google reports the email as unverified", async () => {
    getToken.mockResolvedValue({ tokens: { id_token: "fake-id-token" } });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-sub-1", email: "user@example.com", email_verified: false }),
    });
    const identity = await service.exchange("auth-code");
    expect(identity.emailVerified).toBe(false);
  });
});
