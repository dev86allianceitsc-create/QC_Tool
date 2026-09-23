import { derivePathParameters } from "../api-environment/request-input-validation.util";

export interface EligibilityRequestValues {
  pathValues: Record<string, string>;
  queryValues: Record<string, string>;
  headerValues: Record<string, string>;
}

export interface EligibilityParameterDefinition {
  location: string;
  parameterName: string;
  isRequired: boolean;
}

export type SkipReasonCode = "MISSING_FULL_URL" | "MISSING_REQUIRED_INPUT";

// Single source of truth for "can this execution actually be dispatched",
// used both at Run creation (Single → 422 reject; Batch → per-child SKIPPED,
// REQ-RUN-001 RS-001-08) and never re-checked afterward — eligibility is a
// point-in-time acceptance gate, not a dispatch-time gate.
export function evaluateEligibility(
  apiPath: string,
  config: { fullUrl: string } | null,
  parameterDefinitions: EligibilityParameterDefinition[],
  requestValues: EligibilityRequestValues,
): SkipReasonCode | null {
  if (!config) {
    return "MISSING_FULL_URL";
  }

  const pathParameters = derivePathParameters(apiPath);
  for (const param of pathParameters) {
    const value = requestValues.pathValues[param.name];
    if (!value || value.trim() === "") {
      return "MISSING_REQUIRED_INPUT";
    }
  }

  for (const def of parameterDefinitions) {
    if (!def.isRequired) {
      continue;
    }
    const bucket = def.location === "QUERY" ? requestValues.queryValues : requestValues.headerValues;
    const value = bucket[def.parameterName];
    if (!value || value.trim() === "") {
      return "MISSING_REQUIRED_INPUT";
    }
  }

  return null;
}
