import { HttpStatus } from "@nestjs/common";
import * as yaml from "js-yaml";
import { BusinessException } from "../../common/exceptions/business.exception";
import { isReservedHeaderName } from "./request-input-validation.util";

// API-API-006/007. Deliberately hand-rolled instead of adopting a dedicated
// OpenAPI parser/validator package: JSON.parse + js-yaml handle both
// supported input formats, and walking the common `paths` object (present in
// both Swagger 2.0 and OpenAPI 3.x) avoids tying endpoint-candidate
// extraction to any one spec-version library's compatibility surface — per
// the frozen AnD's explicit instruction not to let a parser library silently
// narrow the confirmed JSON/YAML, version-agnostic business contract.

export interface ParsedSpecification {
  format: "JSON" | "YAML";
  detectedVersion: string;
  raw: Record<string, unknown>;
}

// Standard OpenAPI/Swagger path-item operation keys — used only to
// distinguish an operation entry from sibling path-item keys like
// "parameters" or "$ref" while walking the document; this is a structural
// parsing detail, not a REQ-INP-002 (3B) supported-method business allowlist.
const PATH_ITEM_OPERATION_KEYS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

function parseError(): never {
  throw new BusinessException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    "OPENAPI_PARSE_ERROR",
    "File cannot be interpreted as a supported Swagger/OpenAPI JSON or YAML specification",
  );
}

export function parseOpenApiFile(buffer: Buffer): ParsedSpecification {
  const text = buffer.toString("utf-8");
  let raw: unknown;
  let format: "JSON" | "YAML";
  try {
    raw = JSON.parse(text);
    format = "JSON";
  } catch {
    try {
      raw = yaml.load(text);
      format = "YAML";
    } catch {
      return parseError();
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return parseError();
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.paths || typeof obj.paths !== "object" || Array.isArray(obj.paths)) {
    return parseError();
  }

  let detectedVersion = "UNKNOWN";
  if (typeof obj.openapi === "string") detectedVersion = obj.openapi;
  else if (typeof obj.swagger === "string") detectedVersion = obj.swagger;

  return { format, detectedVersion, raw: obj };
}

export interface ExtractedImportWarning {
  code: string;
  detail: string;
}

export interface ExtractedParameter {
  name: string;
  required: boolean;
}

export interface ExtractedRequestBody {
  bodyType: "JSON";
}

export interface ExtractedCandidate {
  httpMethod: string;
  path: string;
  suggestedApiName?: string;
  queryParameters: ExtractedParameter[];
  headerParameters: ExtractedParameter[];
  requestBody: ExtractedRequestBody | null;
  warnings: ExtractedImportWarning[];
}

// 3B FINAL FROZEN API Contract §12 — maps supported OpenAPI/Swagger
// operation.parameters entries to Request Input Definition rows. `in: path`
// is skipped (Path Parameters are always derived from the API Path itself,
// never imported as rows — REQ-INP-003 BR-INP-003-01/03); a reserved Header
// name (Authorization/Content-Type) is not imported as a normal Header,
// since persisting it would let OpenAPI security/auth metadata bypass the
// Group 3C boundary (§12 table, "do NOT persist") — an additive warning is
// returned instead of dropping it silently, same for a duplicate Query/
// Header entry, so Preview/Confirm Import can surface what was ignored.
function extractParameters(operation: Record<string, unknown>): {
  queryParameters: ExtractedParameter[];
  headerParameters: ExtractedParameter[];
  warnings: ExtractedImportWarning[];
} {
  const queryParameters: ExtractedParameter[] = [];
  const headerParameters: ExtractedParameter[] = [];
  const warnings: ExtractedImportWarning[] = [];
  const seenQueryNames = new Set<string>();
  const seenHeaderNames = new Set<string>();

  const rawParameters = operation.parameters;
  if (!Array.isArray(rawParameters)) {
    return { queryParameters, headerParameters, warnings };
  }

  for (const rawParam of rawParameters) {
    if (!rawParam || typeof rawParam !== "object" || Array.isArray(rawParam)) continue;
    const param = rawParam as Record<string, unknown>;
    if (typeof param.name !== "string" || !param.name.trim()) continue;
    const name = param.name.trim();
    const required = param.required === true;

    if (param.in === "query") {
      if (seenQueryNames.has(name)) {
        warnings.push({
          code: "DUPLICATE_QUERY_PARAMETER_IGNORED",
          detail: `Duplicate QUERY parameter '${name}' was ignored; only the first occurrence was imported.`,
        });
        continue;
      }
      seenQueryNames.add(name);
      queryParameters.push({ name, required });
    } else if (param.in === "header") {
      if (isReservedHeaderName(name)) {
        warnings.push({
          code: "RESERVED_HEADER_PARAMETER_IGNORED",
          detail: `Header '${name}' is reserved and was not imported as a normal Header parameter.`,
        });
        continue;
      }
      const key = name.toLowerCase();
      if (seenHeaderNames.has(key)) {
        warnings.push({
          code: "DUPLICATE_HEADER_PARAMETER_IGNORED",
          detail: `Duplicate HEADER parameter '${name}' was ignored; only the first occurrence was imported.`,
        });
        continue;
      }
      seenHeaderNames.add(key);
      headerParameters.push({ name, required });
    }
    // in === "path" is intentionally skipped — Path Parameters are derived,
    // never imported as rows. in === "cookie"/other is out of MVP scope.
  }

  return { queryParameters, headerParameters, warnings };
}

// 3B FINAL FROZEN API Contract §12 — requestBody.content.application/json
// maps to a Body Definition (bodyType=JSON). An only-unsupported media type
// (e.g. multipart/form-data) must not be silently converted to JSON; report
// via an additive warning instead (§13, DP-3B-API-04, FROZEN) and leave the
// operation's Body Definition unset.
function extractRequestBody(operation: Record<string, unknown>): { requestBody: ExtractedRequestBody | null; warnings: ExtractedImportWarning[] } {
  const warnings: ExtractedImportWarning[] = [];
  const rawRequestBody = operation.requestBody;
  if (!rawRequestBody || typeof rawRequestBody !== "object" || Array.isArray(rawRequestBody)) {
    return { requestBody: null, warnings };
  }
  const requestBody = rawRequestBody as Record<string, unknown>;
  const content = requestBody.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return { requestBody: null, warnings };
  }
  const mediaTypes = Object.keys(content as Record<string, unknown>);
  if (mediaTypes.includes("application/json")) {
    return { requestBody: { bodyType: "JSON" }, warnings };
  }
  if (mediaTypes.length > 0) {
    warnings.push({
      code: "UNSUPPORTED_REQUEST_BODY_MEDIA_TYPE",
      detail: `${mediaTypes.join(", ")} is not supported in the current MVP.`,
    });
  }
  return { requestBody: null, warnings };
}

export function extractCandidates(spec: ParsedSpecification): ExtractedCandidate[] {
  const paths = spec.raw.paths as Record<string, unknown>;
  const candidates: ExtractedCandidate[] = [];

  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) continue;
    const path = rawPath.trim();
    if (!path) continue;

    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!PATH_ITEM_OPERATION_KEYS.has(method.toLowerCase())) continue;

      let suggestedApiName: string | undefined;
      let queryParameters: ExtractedParameter[] = [];
      let headerParameters: ExtractedParameter[] = [];
      let requestBody: ExtractedRequestBody | null = null;
      let warnings: ExtractedImportWarning[] = [];

      if (operation && typeof operation === "object" && !Array.isArray(operation)) {
        const op = operation as Record<string, unknown>;
        if (typeof op.summary === "string" && op.summary.trim()) {
          suggestedApiName = op.summary.trim();
        } else if (typeof op.operationId === "string" && op.operationId.trim()) {
          suggestedApiName = op.operationId.trim();
        }

        const params = extractParameters(op);
        queryParameters = params.queryParameters;
        headerParameters = params.headerParameters;

        const body = extractRequestBody(op);
        requestBody = body.requestBody;

        // Single warning-collection path (Preview and Confirm Import both
        // consume this same ExtractedCandidate.warnings array, so neither can
        // diverge in which ignored/reserved items it reports).
        warnings = [...params.warnings, ...body.warnings];
      }

      candidates.push({ httpMethod: method.toUpperCase(), path, suggestedApiName, queryParameters, headerParameters, requestBody, warnings });
    }
  }

  return candidates;
}

export function candidateKey(httpMethod: string, path: string): string {
  return `${httpMethod} ${path}`;
}
