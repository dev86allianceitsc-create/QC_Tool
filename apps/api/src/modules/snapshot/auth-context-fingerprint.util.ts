import { createHash } from "node:crypto";

// Group 5 Q5 answer: a Snapshot's Authentication Context is fingerprinted
// from the Authentication Configuration's stable identity/access-scope
// version (authentication_configurations.context_version), never from the
// token/password value itself or a hash of it. The identity discriminator is
// the LOGIN_FORM username (the only non-secret identity signal available for
// that scheme) or "" for BEARER_TOKEN/NONE, where identity is opaque or
// absent. Frozen onto each Snapshot at creation time — never recomputed for
// historical Snapshots as context_version later increments.
export function computeAuthContextKey(
  apiId: string,
  environmentId: string,
  authType: string,
  contextVersion: number,
  identityDiscriminator: string,
): string {
  const input = `${apiId}|${environmentId}|${authType}|${contextVersion}|${identityDiscriminator}`;
  return createHash("sha256").update(input).digest("hex");
}
