// Group 6/7 (Comparison) types — mirror the frozen backend response/request
// shapes in apps/api/src/modules/comparison exactly. Date fields are strings
// here (JSON over the wire), not the backend's Date objects — same
// convention as snapshot.types.ts / run.types.ts.
//
// Comparison's paged endpoints use {items,page,pageSize,totalItems,hasMore}
// (hasMore = page*pageSize < totalItems), NOT the shared services/paged-result
// PagedResult<T> ({...,totalPages}) used by Snapshot/Audit/API/Environment —
// see comparison-query.service.ts's own doc comment on ComparisonPagedResult.

export type ComparisonSourceKind = "AUTO_EXECUTION" | "MANUAL_PAIR" | "BASELINE_LATEST" | "CHAIN_PAIR"
export type ComparisonSelectionMode = "PAIR" | "BASELINE_LATEST"
export type ComparisonProcessingStatus = "QUEUED" | "RUNNING" | "BLOCKED" | "FAILED" | "COMPLETED"
export type ComparisonResult = "SAME" | "DIFFERENT"
export type ComparisonFindingPhase = "INPUT" | "OUTPUT"
export type ComparisonClassificationValue = "EXPECTED" | "UNEXPECTED"
export type ComparisonAvailabilityReasonCode = "NO_LATEST_SNAPSHOT" | "NO_BASELINE" | "BASELINE_INVALIDATED"
export type ComparisonInputCheckOutcome = "COMPATIBLE" | "MISMATCH"
export type ComparisonAttemptTriggerKind = "INITIAL" | "RETRY" | "REEVALUATION"

export const COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH = 2000

export interface ComparisonPagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  hasMore: boolean
}

export interface SnapshotSummaryDto {
  projectId: string
  apiId: string
  environmentId: string
  executionCompletedAt: string
  latencyMs: number | null
  apiVersion: string
  databaseVersion: string
  isInvalidatedNow: boolean
}

export interface ComparisonSummaryDto {
  comparisonId: string
  projectId: string
  apiId: string
  environmentId: string
  baselineSnapshotId: string
  targetSnapshotId: string
  sourceKind: ComparisonSourceKind
  sourceExecutionId: string | null
  comparisonChainId: string | null
  pairOrdinal: number | null
  processingStatus: ComparisonProcessingStatus
  stoppedAtGate: string | null
  reasonCode: string | null
  reasonDetailSafe: string | null
  inputCheckOutcome: ComparisonInputCheckOutcome | null
  result: ComparisonResult | null
  outputDifferenceCount: number | null
  classification: ComparisonClassificationValue | null
  classificationRevision: number | null
  classifiedBy: string | null
  classifiedAt: string | null
  baselineSnapshot: SnapshotSummaryDto
  targetSnapshot: SnapshotSummaryDto
  latencyDeltaMs: number | null
  apiVersionChanged: boolean | null
  databaseVersionChanged: boolean | null
  createdAt: string
  endedAt: string | null
}

export interface AppliedRuleSummaryDto {
  ruleManifestVersion: string
  representationBoundary: string
  exclusionCount: number
  ignoreRuleCount: number
}

export interface ComparisonDetailDto extends ComparisonSummaryDto {
  appliedRuleSummary: AppliedRuleSummaryDto | null
  latestAttemptNumber: number
  findingsLink: string
  attemptsLink: string
}

export type FindingPresenceKind = "ABSENT" | "NULL" | "EMPTY" | "VALUE"
export type FindingDisplayKind = "object" | "array" | "string" | "number" | "boolean" | "null" | "raw" | "text"

export interface FindingSideDto {
  presenceKind: FindingPresenceKind
  displayKind: FindingDisplayKind
  safeText: string | null
  hexPreview: string | null
  isRedacted: boolean
  hasMore: boolean
}

export type FindingLocationDto = { path: string } | {
  aByteOffset: string | null
  aByteLength: string | null
  bByteOffset: string | null
  bByteLength: string | null
} | null

export interface ComparisonFindingItemDto {
  findingId: string
  phase: ComparisonFindingPhase
  component: string
  differenceKind: string
  findingOrdinal: number
  location: FindingLocationDto
  a: FindingSideDto
  b: FindingSideDto
  ruleCode: string
  ruleVersion: string
  safeSummary: string | null
}

export interface ComparisonFindingsResult {
  comparisonId: string
  phase: ComparisonFindingPhase | null
  result: ComparisonResult | null
  processingStatus: ComparisonProcessingStatus
  items: ComparisonFindingItemDto[]
  page: number
  pageSize: number
  totalItems: number
  hasMore: boolean
}

export interface ComparisonAttemptListItemDto {
  comparisonAttemptId: string
  attemptNumber: number
  triggerKind: ComparisonAttemptTriggerKind
  processingStatus: ComparisonProcessingStatus
  stoppedAtGate: string | null
  reasonCode: string | null
  reasonDetailSafe: string | null
  inputCheckOutcome: ComparisonInputCheckOutcome | null
  result: ComparisonResult | null
  startedAt: string | null
  endedAt: string | null
}

export interface ComparisonChainPairDto {
  pairOrdinal: number
  comparison: ComparisonSummaryDto
}

export interface ComparisonChainDetailDto {
  comparisonChainId: string
  projectId: string
  apiId: string
  environmentId: string
  requestedAt: string
  selectedSnapshotCount: number
  pairs: ComparisonChainPairDto[]
  page: number
  pageSize: number
  totalItems: number
  hasMore: boolean
}

export interface ClassificationEventItemDto {
  classificationEventId: string
  revision: number
  classification: ComparisonClassificationValue
  note: string | null
  classifiedBy: string
  classifiedAt: string
}

export interface CreateComparisonResult {
  comparisonId: string
  comparisonAttemptId: string
  processingStatus: "QUEUED" | "BLOCKED"
}

export interface ComparisonAvailabilityResult {
  comparisonId: null
  availabilityReasonCode: ComparisonAvailabilityReasonCode
  latestSnapshotId: string | null
}

export type CreateComparisonResponse = CreateComparisonResult | ComparisonAvailabilityResult

export interface CreateChainResultDto {
  comparisonChainId: string
  selectedSnapshotCount: number
  pairCount: number
}

export interface RetryComparisonResultDto {
  comparisonAttemptId: string
  attemptNumber: number
  processingStatus: "QUEUED"
}

export interface ReevaluateComparisonResultDto {
  comparisonAttemptId: string
  attemptNumber: number
  processingStatus: ComparisonProcessingStatus
  result: ComparisonResult | null
}

export interface ClassificationEventResultDto {
  classificationEventId: string
  revision: number
  classification: ComparisonClassificationValue
  note: string | null
  classifiedBy: string
  classifiedAt: string
}

// Request-side — mirrors dto/create-comparison.dto.ts exactly.
export type CreateComparisonRequest = {
  selectionMode: "PAIR"
  baselineSnapshotId: string
  targetSnapshotId: string
} | {
  selectionMode: "BASELINE_LATEST"
  apiId: string
  environmentId: string
  authContextRef?: string
}

export interface CreateComparisonChainRequest {
  startSnapshotId: string
  endSnapshotId: string
}

export interface CreateClassificationEventRequest {
  classification: ComparisonClassificationValue
  note?: string | null
  expectedRevision: number | null
}
