import type { ParameterLocation, PathParameterDefinition, PutRequestInputPayload, RequestInputDefinition } from "./requestInput.types";

// REQ-INP-003 BR-INP-003-01/03: Path Parameters are derived from
// {placeholder} tokens in the API Path — never persisted, always Required,
// always AUTO_DETECTED. Mirrors derivePathParameters() in
// apps/api/src/modules/api-environment/request-input-validation.util.ts so
// the client can render the same result the backend would return.
export function derivePathParameters(path: string): PathParameterDefinition[] {
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
  return names.map((name) => ({ name, required: true, source: "AUTO_DETECTED" as const }));
}

// DP-3B-API-03 (FROZEN): Authorization and Content-Type are rejected
// case-insensitively as normal Header definitions.
const RESERVED_HEADER_NAMES = new Set(["authorization", "content-type"]);

export function isReservedHeaderName(name: string): boolean {
  return RESERVED_HEADER_NAMES.has(name.trim().toLowerCase());
}

// Mirrors QUERY_NAME_PATTERN / HEADER_NAME_PATTERN in
// request-input-validation.util.ts. UX-only — the backend remains the
// authoritative validator.
const QUERY_NAME_PATTERN = /^[^\s&=#?]+$/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function validateParameterNameFormat(name: string, location: ParameterLocation): string | null {
  if (!name.trim()) {
    return "Name is required.";
  }
  const pattern = location === "QUERY" ? QUERY_NAME_PATTERN : HEADER_NAME_PATTERN;
  if (!pattern.test(name)) {
    return `Name contains characters that are not allowed in a ${location === "QUERY" ? "Query" : "Header"} parameter name.`;
  }
  return null;
}

// Query duplicate semantics are case-sensitive; Header duplicate semantics
// are case-insensitive (matches assertNoDuplicateNames() on the backend).
export function isDuplicateName(name: string, existingNames: string[], location: ParameterLocation): boolean {
  const key = location === "QUERY" ? name : name.toLowerCase();
  return existingNames.some((existing) => (location === "QUERY" ? existing : existing.toLowerCase()) === key);
}

// 3B-12 §3 CONTRACT BOUNDARY: PUT may only carry queryParameters,
// headerParameters, requestBody. Path Parameters, Run Values, and identity
// fields (apiId/httpMethod/path) must never be sent to the PUT endpoint.
export function toPutPayload(definition: RequestInputDefinition): PutRequestInputPayload {
  return {
    queryParameters: definition.queryParameters,
    headerParameters: definition.headerParameters,
    requestBody: definition.requestBody,
  };
}
