import type { Request } from "express";

const BEARER_PREFIX = "Bearer ";

// Returns null (rather than throwing) for a missing/malformed header — the
// caller decides how to map "no credential" to a specific error code.
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}
