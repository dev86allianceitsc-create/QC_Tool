// App-local (not packages/shared-types) — mirrors REQ-SEC-001's minimum
// audit event/field list, but no backend audit_logs table or API exists yet
// (see prisma/schema.prisma: "audit_logs is DEFERRED"). This prototype
// operates entirely against mock data (./audit.mock.ts).

export type AuditEvent =
  // Authentication / session
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "SESSION_INVALID"
  // Project
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_ACTIVATED"
  | "PROJECT_DEACTIVATED"
  | "PROJECT_SOFT_DELETED"
  // Membership
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  // Authorization
  | "SYSTEM_ROLE_CHANGED"
  | "ACCESS_DENIED"
  // Future business events (already defined per REQ-SEC-001 §9)
  | "API_CONFIG_CREATED"
  | "API_CONFIG_UPDATED"
  | "API_RUN_EXECUTED"
  | "RESULT_CLASSIFICATION_CHANGED";

export type AuditResult = "SUCCESS" | "FAILURE" | "DENIED";

export interface AuditActor {
  id: string;
  email: string;
}

export interface AuditProjectRef {
  id: string;
  name: string;
}

// Change information is intentionally a flat string map. Never populate
// this (here or in ./audit.mock.ts) with password/OAuth/session tokens or
// other secrets — REQ-SEC-001 forbids exposing them anywhere in the viewer.
export interface AuditLogEntry {
  id: string;
  event: AuditEvent;
  result: AuditResult;
  timestamp: string; // ISO 8601
  // null = actor could not be resolved (e.g. a failed login for an unknown
  // email) — never invent a user for these.
  actor: AuditActor | null;
  target: string;
  targetType: string | null;
  targetId: string | null;
  // null = event has no project context.
  project: AuditProjectRef | null;
  before: Record<string, string> | null;
  after: Record<string, string> | null;
  requestId: string | null;
}
