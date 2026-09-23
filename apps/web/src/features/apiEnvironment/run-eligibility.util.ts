import type { ApiEnvironmentConfigListItem } from "./apiEnvironment.types";
import type { RequestInputDefinition, RunRequestValues } from "./requestInput.types";

export type SkipReasonCode = "MISSING_FULL_URL" | "MISSING_REQUIRED_INPUT";

// Client-side mirror of apps/api/src/modules/run/run-eligibility.util.ts —
// kept in sync deliberately so Batch Run Preparation's Review step can show
// an accurate Execute/Skip prediction before submit; the backend remains the
// source of truth and re-evaluates independently at createRun. Deliberately
// does NOT consider credentialStatus (neither does the backend): a missing
// credential is not a SKIP condition, it is attempted and fails naturally as
// RUN_ERROR (auth/credential failures are recorded without ever calling
// fetch — see run-execution.engine.ts).
export function evaluateEligibility(
  config: ApiEnvironmentConfigListItem | null,
  definition: RequestInputDefinition | null,
  values: RunRequestValues,
): SkipReasonCode | null {
  if (!config || config.urlStatus !== "CONFIGURED") {
    return "MISSING_FULL_URL";
  }
  if (!definition) {
    return null;
  }

  for (const param of definition.pathParameters) {
    const value = values.pathValues[param.name];
    if (!value || value.trim() === "") {
      return "MISSING_REQUIRED_INPUT";
    }
  }
  for (const param of definition.queryParameters) {
    if (!param.required) continue;
    const value = values.queryValues[param.name];
    if (!value || value.trim() === "") {
      return "MISSING_REQUIRED_INPUT";
    }
  }
  for (const param of definition.headerParameters) {
    if (!param.required) continue;
    const value = values.headerValues[param.name];
    if (!value || value.trim() === "") {
      return "MISSING_REQUIRED_INPUT";
    }
  }

  return null;
}

export function skipReasonLabel(code: SkipReasonCode): string {
  switch (code) {
    case "MISSING_FULL_URL":
      return "No Full URL configured";
    case "MISSING_REQUIRED_INPUT":
      return "Required input missing";
  }
}
