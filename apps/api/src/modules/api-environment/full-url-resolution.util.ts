import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../common/exceptions/business.exception";

export type EffectiveUrlSource = "OVERRIDE" | "ENVIRONMENT_DOMAIN" | "NOT_CONFIGURED";

export interface EffectiveUrlResolution {
  url: string | null;
  source: EffectiveUrlSource;
}

// Phase 1 domain binding (customer feedback #2): Environment.baseUrl must be
// a domain only — protocol + host, no path/query/fragment — so composeUrlFromBase
// can safely concatenate it with an API's own path without producing an
// ambiguous double-path URL.
export function validateOriginOnlyUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "baseUrl is not a well-formed URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "baseUrl must be an absolute HTTP or HTTPS URL");
  }
  if (parsed.pathname !== "" && parsed.pathname !== "/") {
    throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "baseUrl must be a domain only, with no path; each API's own path is appended automatically");
  }
  if (parsed.search !== "") {
    throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "baseUrl must not contain a query component");
  }
  if (parsed.hash !== "") {
    throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "baseUrl must not contain a fragment component");
  }
}

export function composeUrlFromBase(baseUrl: string, apiPath: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmedBase}${apiPath}`;
}

// Single source of truth for "what URL should actually be used" — an
// explicit api_environment_configs override always wins (unchanged frozen
// behavior); otherwise fall back to the Environment's bound domain + the
// API's own path; otherwise the API is Not configured for this Environment,
// exactly as before baseUrl existed. Called independently at every site that
// makes a Run/display decision (list/display, Run eligibility, actual
// dispatch) so they can never drift from one another.
export function resolveEffectiveUrl(
  overrideFullUrl: string | null | undefined,
  environmentBaseUrl: string | null | undefined,
  apiPath: string,
): EffectiveUrlResolution {
  if (overrideFullUrl) {
    return { url: overrideFullUrl, source: "OVERRIDE" };
  }
  if (environmentBaseUrl) {
    return { url: composeUrlFromBase(environmentBaseUrl, apiPath), source: "ENVIRONMENT_DOMAIN" };
  }
  return { url: null, source: "NOT_CONFIGURED" };
}
