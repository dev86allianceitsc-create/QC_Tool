// Output Ignore Rules — mirrors the backend DTO/service shapes in
// apps/api/src/modules/ignore-rules exactly (ignore-rules.service.ts's
// IgnoreRuleResult/BulkCreateIgnoreRulesResult, and the dto/ directory).
// Date fields are strings here (JSON over the wire), same convention as
// comparison.types.ts.

export type IgnoreRuleScope = "API" | "PROJECT"

export interface IgnoreRuleResult {
  ignoreRuleId: string
  projectId: string
  apiId: string | null
  apiName: string | null
  apiMethod: string | null
  apiPath: string | null
  scope: IgnoreRuleScope
  path: string
  enabled: boolean
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface BulkCreateIgnoreRulesResult {
  created: IgnoreRuleResult[]
  skippedCount: number
}

export interface ListIgnoreRulesQuery {
  apiId?: string
  scope?: IgnoreRuleScope
  enabled?: boolean
}

// Request-side — mirrors dto/create-ignore-rule.dto.ts exactly.
export type CreateIgnoreRuleRequest = {
  scope: "API"
  apiId: string
  path: string
  note?: string | null
} | {
  scope: "PROJECT"
  path: string
  note?: string | null
}

// Request-side — mirrors dto/bulk-create-ignore-rules.dto.ts exactly.
// No `note` field on bulk create.
export type BulkCreateIgnoreRulesRequest = {
  scope: "API"
  apiId: string
  paths: string[]
} | {
  scope: "PROJECT"
  paths: string[]
}

export interface UpdateIgnoreRuleRequest {
  enabled: boolean
}
