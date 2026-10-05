import { apiClient } from "../../services/api-client"

import { buildQueryString } from "../../services/query-string"

import type {
  BulkCreateIgnoreRulesRequest,
  BulkCreateIgnoreRulesResult,
  CreateIgnoreRuleRequest,
  IgnoreRuleResult,
  ListIgnoreRulesQuery,
  UpdateIgnoreRuleRequest,
} from "./ignoreRules.types"

// API-IGR-001

export function listIgnoreRules(
  projectId: string,
  params: ListIgnoreRulesQuery,
  accessToken: string,
): Promise<IgnoreRuleResult[]> {
  return apiClient.get<IgnoreRuleResult[]>(
    `/projects/${projectId}/ignore-rules${buildQueryString(params)}`,
    accessToken,
  )
}

// API-IGR-002

export function createIgnoreRule(
  projectId: string,
  body: CreateIgnoreRuleRequest,
  accessToken: string,
): Promise<IgnoreRuleResult> {
  return apiClient.post<IgnoreRuleResult>(
    `/projects/${projectId}/ignore-rules`,
    body,
    accessToken,
  )
}

// API-IGR-003

export function bulkCreateIgnoreRules(
  projectId: string,
  body: BulkCreateIgnoreRulesRequest,
  accessToken: string,
): Promise<BulkCreateIgnoreRulesResult> {
  return apiClient.post<BulkCreateIgnoreRulesResult>(
    `/projects/${projectId}/ignore-rules/bulk`,
    body,
    accessToken,
  )
}

// API-IGR-004

export function updateIgnoreRule(
  projectId: string,
  ignoreRuleId: string,
  body: UpdateIgnoreRuleRequest,
  accessToken: string,
): Promise<IgnoreRuleResult> {
  return apiClient.patch<IgnoreRuleResult>(
    `/projects/${projectId}/ignore-rules/${ignoreRuleId}`,
    body,
    accessToken,
  )
}

// API-IGR-005

export function removeIgnoreRule(
  projectId: string,
  ignoreRuleId: string,
  accessToken: string,
): Promise<void> {
  return apiClient.delete<void>(
    `/projects/${projectId}/ignore-rules/${ignoreRuleId}`,
    accessToken,
  )
}
