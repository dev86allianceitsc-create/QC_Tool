// Group 6/7 Comparison — ComparisonFinding taxonomy (AnD Database v0.3
// Section 4.5). Single source of truth for the component/differenceKind
// literal unions and the rule_code vocabulary, so every gate/diff utility
// (header, body, method/URL/status) agrees on exact spelling.
//
// component/differenceKind mirror the DB CHECK constraint domains exactly
// (ck_comparison_findings_component / ck_comparison_findings_difference_kind
// in prisma/migrations/20260925090000_add_comparison_group_6_7/migration.sql)
// — a value outside these unions would fail to persist. rule_code itself has
// no CHECK constraint (AnD Section 4.5: domain is open-ended/non-exhaustive,
// same "taxonomy not yet frozen" precedent as audit_logs.event_type), so
// COMPARISON_RULE_CODES below is this repo's own convention, not a
// DB-enforced domain — safe to extend without a migration.
export type ComparisonComponent = "METHOD" | "URL" | "REQUEST_HEADER" | "REQUEST_BODY" | "HTTP_STATUS" | "RESPONSE_HEADER" | "RESPONSE_BODY";

export type ComparisonDifferenceKind = "PRESENCE" | "TYPE" | "VALUE" | "ORDER" | "LENGTH" | "RAW_BYTES";

export const COMPARISON_RULE_CODES = {
  METHOD_MISMATCH: "METHOD_MISMATCH",
  URL_MISMATCH: "URL_MISMATCH",
  HTTP_STATUS_MISMATCH: "HTTP_STATUS_MISMATCH",
  HEADER_PRESENCE: "HEADER_PRESENCE",
  HEADER_LENGTH: "HEADER_LENGTH",
  HEADER_ORDER: "HEADER_ORDER",
  HEADER_VALUE: "HEADER_VALUE",
  BODY_RAW_BYTES: "BODY_RAW_BYTES",
  BODY_PRESENCE: "BODY_PRESENCE",
  JSON_PRESENCE: "JSON_PRESENCE",
  JSON_TYPE: "JSON_TYPE",
  JSON_VALUE: "JSON_VALUE",
  JSON_LENGTH: "JSON_LENGTH",
} as const;
