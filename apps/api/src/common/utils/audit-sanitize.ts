// Defense-in-depth backstop for REQ-SEC-001 / Database_Standard_v2.0 §22:
// audit_logs.before_data/after_data must never contain a password, token, or
// other secret, even if a caller passes one in by mistake. Callers are still
// responsible for only passing intentionally-audited fields — this only
// strips anything that looks like a credential.
const FORBIDDEN_KEY_PATTERN = /password|token|secret|credential|authorization/i;

export function sanitizeForAudit<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForAudit(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_PATTERN.test(key)) {
        continue;
      }
      result[key] = sanitizeForAudit(val);
    }
    return result as T;
  }
  return value;
}
