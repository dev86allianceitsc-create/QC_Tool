import { createHash } from "node:crypto";

// Group 5 Q5 answer, revised for REVISION 3C-R02: a Snapshot's Authentication
// Context is fingerprinted from the Environment's Authentication
// Configuration alone — its stable identity/access-scope version
// (authentication_configurations.context_version), never from the
// token/password value itself, a hash of it, or which Login Form Test
// Account was used. Test Accounts are deliberately excluded so that Runs
// against the same Environment/authType/contextVersion using different Test
// Accounts still share a fingerprint and remain comparable. apiId is also
// excluded — Authentication is Environment-scoped, not per-API. Frozen onto
// each Snapshot at creation time — never recomputed for historical
// Snapshots as context_version later increments.
export function computeAuthContextKey(
  environmentId: string,
  authType: string,
  contextVersion: number,
): string {
  const input = `${environmentId}|${authType}|${contextVersion}`;
  return createHash("sha256").update(input).digest("hex");
}
