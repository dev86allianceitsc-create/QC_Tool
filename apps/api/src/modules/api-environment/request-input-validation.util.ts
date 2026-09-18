import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../common/exceptions/business.exception";

// REQ-INP-003 §BR-INP-003-09 defers exact character-set/length rules for
// Query/Header parameter names to DB/API design; the 3B FINAL FROZEN API
// Contract §7 leaves character-level HTTP token/query restrictions to be
// "validated by API implementation consistently with request construction".
// These patterns are that implementation decision: QUERY names must not
// contain characters that would corrupt query-string construction at Run
// time (whitespace, &, =, #, ?); HEADER names must be a valid HTTP header
// field-name token per RFC 7230 §3.2.

const QUERY_NAME_PATTERN = /^[^\s&=#?]+$/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export const MAX_PARAMETER_NAME_LENGTH = 255;

// DP-3B-API-03 (FROZEN): Authorization and Content-Type are rejected
// case-insensitively as normal Header definitions — Authorization is
// reserved for Group 3C Authentication, Content-Type is owned by QC Tool
// when Body Type = JSON (REQ-INP-005 BR-INP-005-11).
const RESERVED_HEADER_NAMES = new Set(["authorization", "content-type"]);

export function isReservedHeaderName(name: string): boolean {
  return RESERVED_HEADER_NAMES.has(name.trim().toLowerCase());
}

function semanticError(message: string): never {
  throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", message);
}

export function validateParameterNameFormat(name: string, location: "QUERY" | "HEADER"): void {
  const pattern = location === "QUERY" ? QUERY_NAME_PATTERN : HEADER_NAME_PATTERN;
  if (!pattern.test(name)) {
    semanticError(`${location === "QUERY" ? "queryParameters" : "headerParameters"} name '${name}' contains characters that are not allowed in a ${location} parameter name`);
  }
}

export function assertNoDuplicateNames(names: string[], location: "QUERY" | "HEADER"): void {
  const seen = new Set<string>();
  for (const raw of names) {
    const key = location === "QUERY" ? raw : raw.toLowerCase();
    if (seen.has(key)) {
      semanticError(`Duplicate ${location} parameter name '${raw}' is not allowed within one Request Input replacement`);
    }
    seen.add(key);
  }
}

export const SUPPORTED_REQUEST_BODY_TYPES = ["JSON"] as const;

export interface DerivedPathParameter {
  name: string;
  required: true;
  source: "AUTO_DETECTED";
}

// REQ-INP-003 BR-INP-003-01/03: Path Parameters are derived from
// {placeholder} tokens in api_configurations.path — never persisted, always
// Required, always AUTO_DETECTED. This is the sole source of truth (no
// Path Parameter table exists in the 3B DB design).
export function derivePathParameters(path: string): DerivedPathParameter[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const pattern = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(path)) !== null) {
    const name = match[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names.map((name) => ({ name, required: true, source: "AUTO_DETECTED" }));
}
