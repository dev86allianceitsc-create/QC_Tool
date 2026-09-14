import { Injectable } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
}

// Thrown for any exchange/verification failure (bad code, bad signature,
// network error, malformed payload) — AuthService maps all of these
// uniformly to 401 AUTHENTICATION_FAILED without distinguishing the cause.
export class GoogleAuthError extends Error {}

// Google Authorization Code Flow + PKCE server-side exchange, kept behind
// this boundary so tests can mock Google externally without a fake verifier
// in the production runtime path. Never logs the authorization code or any
// token value.
@Injectable()
export class GoogleIdentityService {
  private readonly client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    });
  }

  async exchange(authorizationCode: string): Promise<GoogleIdentity> {
    let idToken: string | null | undefined;
    try {
      const { tokens } = await this.client.getToken(authorizationCode);
      idToken = tokens.id_token;
    } catch (err) {
      throw new GoogleAuthError("Google authorization code exchange failed", { cause: err });
    }

    if (!idToken) {
      throw new GoogleAuthError("Google token response did not include an id_token");
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      throw new GoogleAuthError("Google id_token verification failed", { cause: err });
    }

    if (!payload?.sub || !payload.email) {
      throw new GoogleAuthError("Google identity payload missing sub/email");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
    };
  }
}
