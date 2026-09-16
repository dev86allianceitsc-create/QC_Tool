import type { AuditLogEntry } from "./audit.types";

// Mock data standing in for a real GET /audit-logs endpoint (none exists
// yet — see audit.types.ts). Never put real credentials/secrets here.

const ADMIN = { id: "u1", email: "admin@example.com" };
const ALICE = { id: "u2", email: "alice@example.com" };
const BOB = { id: "u3", email: "bob@example.com" };
const CAROL = { id: "u4", email: "carol@example.com" };
const DAVE = { id: "u5", email: "dave@example.com" };

const PROJECT_A = { id: "p1", name: "Project A" };
const PROJECT_B = { id: "p2", name: "Project B" };
const PROJECT_C = { id: "p3", name: "Project C" };
const PROJECT_D = { id: "p4", name: "Project D" };

let seq = 0;
function nextId(): string {
  seq += 1;
  return `a${String(seq).padStart(4, "0")}`;
}

// Curated entries covering every event type from REQ-SEC-001 §9, with a mix
// of SUCCESS/FAILURE/DENIED, multiple actors/projects, and one entry with
// an unresolved (null) actor.
const CURATED: Omit<AuditLogEntry, "id">[] = [
  { event: "LOGIN_SUCCESS", result: "SUCCESS", timestamp: "2026-09-16T08:12:03.000Z", actor: ADMIN, target: "admin@example.com", targetType: "USER", targetId: ADMIN.id, project: null, before: null, after: null, requestId: "req-1001" },
  { event: "LOGIN_FAILED", result: "FAILURE", timestamp: "2026-09-16T08:10:45.000Z", actor: null, target: "unknown@example.com", targetType: "USER", targetId: null, project: null, before: null, after: null, requestId: "req-1000" },
  { event: "LOGIN_SUCCESS", result: "SUCCESS", timestamp: "2026-09-15T14:30:11.000Z", actor: ALICE, target: "alice@example.com", targetType: "USER", targetId: ALICE.id, project: null, before: null, after: null, requestId: "req-0998" },
  { event: "LOGOUT", result: "SUCCESS", timestamp: "2026-09-15T15:02:47.000Z", actor: ALICE, target: "alice@example.com", targetType: "USER", targetId: ALICE.id, project: null, before: null, after: null, requestId: "req-0999" },
  { event: "SESSION_EXPIRED", result: "SUCCESS", timestamp: "2026-09-15T18:45:00.000Z", actor: BOB, target: "bob@example.com", targetType: "SESSION", targetId: "sess-2201", project: null, before: null, after: null, requestId: "req-0997" },
  { event: "SESSION_REVOKED", result: "SUCCESS", timestamp: "2026-09-14T09:20:00.000Z", actor: ADMIN, target: "carol@example.com", targetType: "SESSION", targetId: "sess-2150", project: null, before: null, after: null, requestId: "req-0990" },
  { event: "SESSION_INVALID", result: "FAILURE", timestamp: "2026-09-14T09:21:30.000Z", actor: CAROL, target: "carol@example.com", targetType: "SESSION", targetId: "sess-2150", project: null, before: null, after: null, requestId: "req-0991" },

  { event: "PROJECT_CREATED", result: "SUCCESS", timestamp: "2026-09-13T10:00:00.000Z", actor: ADMIN, target: "Project A", targetType: "PROJECT", targetId: PROJECT_A.id, project: PROJECT_A, before: null, after: { name: "Project A", status: "ACTIVE" }, requestId: "req-0950" },
  { event: "PROJECT_UPDATED", result: "SUCCESS", timestamp: "2026-09-13T10:15:22.000Z", actor: ADMIN, target: "Project A", targetType: "PROJECT", targetId: PROJECT_A.id, project: PROJECT_A, before: { description: "First demo project." }, after: { description: "First demo project (updated)." }, requestId: "req-0951" },
  { event: "PROJECT_UPDATED", result: "FAILURE", timestamp: "2026-09-13T10:16:05.000Z", actor: ADMIN, target: "Project A", targetType: "PROJECT", targetId: PROJECT_A.id, project: PROJECT_A, before: null, after: null, requestId: "req-0952" },
  { event: "PROJECT_ACTIVATED", result: "SUCCESS", timestamp: "2026-09-12T11:00:00.000Z", actor: ADMIN, target: "Project B", targetType: "PROJECT", targetId: PROJECT_B.id, project: PROJECT_B, before: { status: "INACTIVE" }, after: { status: "ACTIVE" }, requestId: "req-0940" },
  { event: "PROJECT_DEACTIVATED", result: "SUCCESS", timestamp: "2026-09-11T16:40:00.000Z", actor: ADMIN, target: "Project C", targetType: "PROJECT", targetId: PROJECT_C.id, project: PROJECT_C, before: { status: "ACTIVE" }, after: { status: "INACTIVE" }, requestId: "req-0930" },
  { event: "PROJECT_SOFT_DELETED", result: "SUCCESS", timestamp: "2026-09-10T09:05:00.000Z", actor: ADMIN, target: "Project D", targetType: "PROJECT", targetId: PROJECT_D.id, project: PROJECT_D, before: { deletedAt: "null" }, after: { deletedAt: "2026-09-10T09:05:00.000Z" }, requestId: "req-0920" },

  { event: "PROJECT_MEMBER_ADDED", result: "SUCCESS", timestamp: "2026-09-09T13:12:00.000Z", actor: ADMIN, target: "bob@example.com", targetType: "MEMBER", targetId: BOB.id, project: PROJECT_A, before: null, after: { role: "USER", status: "INVITED" }, requestId: "req-0910" },
  { event: "PROJECT_MEMBER_ADDED", result: "FAILURE", timestamp: "2026-09-09T13:20:00.000Z", actor: ADMIN, target: "dave@example.com", targetType: "MEMBER", targetId: DAVE.id, project: PROJECT_B, before: null, after: null, requestId: "req-0911" },
  { event: "PROJECT_MEMBER_REMOVED", result: "SUCCESS", timestamp: "2026-09-08T17:30:00.000Z", actor: ADMIN, target: "carol@example.com", targetType: "MEMBER", targetId: CAROL.id, project: PROJECT_C, before: { status: "ACTIVE" }, after: null, requestId: "req-0900" },

  { event: "SYSTEM_ROLE_CHANGED", result: "SUCCESS", timestamp: "2026-09-07T08:00:00.000Z", actor: ADMIN, target: "alice@example.com", targetType: "USER", targetId: ALICE.id, project: null, before: { systemRole: "USER" }, after: { systemRole: "ADMIN" }, requestId: "req-0890" },
  { event: "ACCESS_DENIED", result: "DENIED", timestamp: "2026-09-07T08:05:00.000Z", actor: BOB, target: "Audit Logs", targetType: "SCREEN", targetId: "audit-log", project: null, before: null, after: null, requestId: "req-0891" },
  { event: "ACCESS_DENIED", result: "DENIED", timestamp: "2026-09-06T12:40:00.000Z", actor: CAROL, target: "Project D", targetType: "PROJECT", targetId: PROJECT_D.id, project: PROJECT_D, before: null, after: null, requestId: "req-0880" },

  { event: "API_CONFIG_CREATED", result: "SUCCESS", timestamp: "2026-09-05T10:00:00.000Z", actor: ADMIN, target: "Pricing API Config", targetType: "API_CONFIG", targetId: "cfg-01", project: PROJECT_A, before: null, after: { name: "Pricing API Config" }, requestId: "req-0870" },
  { event: "API_CONFIG_UPDATED", result: "SUCCESS", timestamp: "2026-09-05T10:20:00.000Z", actor: ADMIN, target: "Pricing API Config", targetType: "API_CONFIG", targetId: "cfg-01", project: PROJECT_A, before: { timeoutMs: "3000" }, after: { timeoutMs: "5000" }, requestId: "req-0871" },
  { event: "API_RUN_EXECUTED", result: "SUCCESS", timestamp: "2026-09-04T09:15:00.000Z", actor: ALICE, target: "Pricing API Config", targetType: "API_RUN", targetId: "run-9001", project: PROJECT_A, before: null, after: null, requestId: "req-0860" },
  { event: "API_RUN_EXECUTED", result: "FAILURE", timestamp: "2026-09-04T09:22:00.000Z", actor: ALICE, target: "Pricing API Config", targetType: "API_RUN", targetId: "run-9002", project: PROJECT_A, before: null, after: null, requestId: "req-0861" },
  { event: "RESULT_CLASSIFICATION_CHANGED", result: "SUCCESS", timestamp: "2026-09-03T15:00:00.000Z", actor: DAVE, target: "run-9001 result #4", targetType: "RESULT", targetId: "res-4", project: PROJECT_A, before: { classification: "UNREVIEWED" }, after: { classification: "PASS" }, requestId: "req-0850" },
];

// Padding entries so the list is large enough to exercise pagination
// (default page size 20 → this yields 3 pages) without hand-writing dozens
// more curated rows. Alternates a small rotation of routine, low-risk
// events across the two weeks preceding the curated entries above.
const PAD_TEMPLATES: Array<{ event: AuditLogEntry["event"]; actor: typeof ADMIN; project: typeof PROJECT_A | null; result: AuditLogEntry["result"] }> = [
  { event: "LOGIN_SUCCESS", actor: ALICE, project: null, result: "SUCCESS" },
  { event: "LOGIN_SUCCESS", actor: BOB, project: null, result: "SUCCESS" },
  { event: "LOGOUT", actor: BOB, project: null, result: "SUCCESS" },
  { event: "LOGIN_FAILED", actor: CAROL, project: null, result: "FAILURE" },
  { event: "API_RUN_EXECUTED", actor: DAVE, project: PROJECT_B, result: "SUCCESS" },
];

const padded: Omit<AuditLogEntry, "id">[] = [];
for (let i = 0; i < 30; i++) {
  const template = PAD_TEMPLATES[i % PAD_TEMPLATES.length];
  const daysAgo = 15 + i; // continues further back than the curated entries
  const timestamp = new Date(Date.UTC(2026, 8, 16 - daysAgo, 7 + (i % 10), (i * 7) % 60, 0)).toISOString();
  padded.push({
    event: template.event,
    result: template.result,
    timestamp,
    actor: template.actor,
    target: template.actor.email,
    targetType: template.event.startsWith("API_RUN") ? "API_RUN" : "USER",
    targetId: template.actor.id,
    project: template.project,
    before: null,
    after: null,
    requestId: `req-${String(700 - i).padStart(4, "0")}`,
  });
}

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [...CURATED, ...padded]
  .map((entry) => ({ id: nextId(), ...entry }))
  .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
