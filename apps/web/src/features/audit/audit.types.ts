// Mirrors the current backend contract exactly (API-SEC-001..003).

// Free-form on the backend (no fixed enum in the DTO); kept here only as the
// Event-filter dropdown's option source, not as a validated domain type.
export type AuditEvent =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "SESSION_INVALID"
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_ACTIVATED"
  | "PROJECT_DEACTIVATED"
  | "PROJECT_SOFT_DELETED"
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  | "SYSTEM_ROLE_CHANGED"
  | "ACCESS_DENIED"
  | "API_CONFIG_CREATED"
  | "API_CONFIG_UPDATED"
  | "API_RUN_EXECUTED"
  | "RESULT_CLASSIFICATION_CHANGED";

export type AuditResult = "SUCCESS" | "FAILURE" | "DENIED";

export interface AuditLogListItem {
  auditId: string;
  eventType: string;
  result: AuditResult;
  occurredAt: string; // ISO 8601
  actorDisplay: string | null;
  targetDisplay: string | null;
  projectId: string | null;
}

export interface AuditLogDetail extends AuditLogListItem {
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  beforeData: unknown;
  afterData: unknown;
  requestId: string | null;
  detail: string | null;
}
