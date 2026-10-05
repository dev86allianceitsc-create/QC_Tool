import { apiClient } from "../../services/api-client"
import { buildQueryString } from "../../services/query-string"
import type {
  ClassificationEventItemDto,
  ClassificationEventResultDto,
  ComparisonAttemptListItemDto,
  ComparisonChainDetailDto,
  ComparisonDetailDto,
  ComparisonFindingPhase,
  ComparisonFindingsResult,
  ComparisonPagedResult,
  ComparisonProcessingStatus,
  ComparisonResult,
  ComparisonSourceKind,
  ComparisonSummaryDto,
  CreateChainResultDto,
  CreateComparisonChainRequest,
  CreateComparisonRequest,
  CreateComparisonResponse,
  CreateClassificationEventRequest,
  ReevaluateComparisonResultDto,
  RetryComparisonResultDto,
} from "./comparison.types"

export interface ListComparisonsParams {
  page?: number
  pageSize?: number
  apiId?: string
  snapshotId?: string
  executionId?: string
  sourceKind?: ComparisonSourceKind
  processingStatus?: ComparisonProcessingStatus
  result?: ComparisonResult
}

// API-CMP-003
export function listComparisons(
  projectId: string,
  params: ListComparisonsParams,
  accessToken: string,
): Promise<ComparisonPagedResult<ComparisonSummaryDto>> {
  return apiClient.get<ComparisonPagedResult<ComparisonSummaryDto>>(
    `/projects/${projectId}/comparisons${buildQueryString(params)}`,
    accessToken,
  )
}

// API-CMP-001
export function createComparison(
  projectId: string,
  body: CreateComparisonRequest,
  accessToken: string,
): Promise<CreateComparisonResponse> {
  return apiClient.post<CreateComparisonResponse>(
    `/projects/${projectId}/comparisons`,
    body,
    accessToken,
  )
}

// API-CMP-004
export function getComparison(
  comparisonId: string,
  accessToken: string,
): Promise<ComparisonDetailDto> {
  return apiClient.get<ComparisonDetailDto>(
    `/comparisons/${comparisonId}`,
    accessToken,
  )
}

export interface ListComparisonFindingsParams {
  page?: number
  pageSize?: number
  phase?: ComparisonFindingPhase
}

// API-CMP-005
export function listComparisonFindings(
  comparisonId: string,
  params: ListComparisonFindingsParams,
  accessToken: string,
): Promise<ComparisonFindingsResult> {
  return apiClient.get<ComparisonFindingsResult>(
    `/comparisons/${comparisonId}/findings${buildQueryString(params)}`,
    accessToken,
  )
}

// API-CMP-006
export function listComparisonAttempts(
  comparisonId: string,
  params: { page?: number; pageSize?: number },
  accessToken: string,
): Promise<ComparisonPagedResult<ComparisonAttemptListItemDto>> {
  return apiClient.get<ComparisonPagedResult<ComparisonAttemptListItemDto>>(
    `/comparisons/${comparisonId}/attempts${buildQueryString(params)}`,
    accessToken,
  )
}

// API-CMP-007
export function retryComparison(
  comparisonId: string,
  accessToken: string,
): Promise<RetryComparisonResultDto> {
  return apiClient.post<RetryComparisonResultDto>(
    `/comparisons/${comparisonId}/retry`,
    undefined,
    accessToken,
  )
}

// Re-evaluate — recomputes the Comparison's existing Snapshots against the
// currently active Ignore Rules without calling the API-under-test again.
export function reevaluateComparison(
  comparisonId: string,
  accessToken: string,
): Promise<ReevaluateComparisonResultDto> {
  return apiClient.post<ReevaluateComparisonResultDto>(
    `/comparisons/${comparisonId}/reevaluate`,
    undefined,
    accessToken,
  )
}

// API-CMP-009
export function createClassificationEvent(
  comparisonId: string,
  body: CreateClassificationEventRequest,
  accessToken: string,
): Promise<ClassificationEventResultDto> {
  return apiClient.post<ClassificationEventResultDto>(
    `/comparisons/${comparisonId}/classification-events`,
    body,
    accessToken,
  )
}

// API-CMP-010
export function listClassificationEvents(
  comparisonId: string,
  params: { page?: number; pageSize?: number },
  accessToken: string,
): Promise<ComparisonPagedResult<ClassificationEventItemDto>> {
  return apiClient.get<ComparisonPagedResult<ClassificationEventItemDto>>(
    `/comparisons/${comparisonId}/classification-events${buildQueryString(params)}`,
    accessToken,
  )
}

// API-CMP-002
export function createComparisonChain(
  projectId: string,
  body: CreateComparisonChainRequest,
  accessToken: string,
): Promise<CreateChainResultDto> {
  return apiClient.post<CreateChainResultDto>(
    `/projects/${projectId}/comparison-chains`,
    body,
    accessToken,
  )
}

// API-CMP-008
export function getComparisonChain(
  comparisonChainId: string,
  params: { page?: number; pageSize?: number },
  accessToken: string,
): Promise<ComparisonChainDetailDto> {
  return apiClient.get<ComparisonChainDetailDto>(
    `/comparison-chains/${comparisonChainId}${buildQueryString(params)}`,
    accessToken,
  )
}
