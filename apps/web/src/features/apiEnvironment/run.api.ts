import { apiClient } from "../../services/api-client"

import type { PagedResult } from "../../services/paged-result"

import { buildQueryString } from "../../services/query-string"

import type {
  ApiRunExecutionListItem,
  CreateRunPayload,
  RunDetail,
  RunExecutionDetail,
  RunListItem,
  TestCaseListItem,
} from "./run.types"

// API-RUN-001

export function createRun(
  projectId: string,
  payload: CreateRunPayload,
  accessToken: string,
): Promise<RunDetail> {
  return apiClient.post<RunDetail>(
    `/projects/${projectId}/runs`,
    payload,
    accessToken,
  )
}

export interface ListRunsParams {
  page?: number

  pageSize?: number

  apiId?: string

  environmentId?: string

  runType?: string

  runStatus?: string

  createdFrom?: string

  createdTo?: string

  sortBy?: string

  sortOrder?: string
}

// API-RUN-004

export function listRuns(
  projectId: string,

  params: ListRunsParams,

  accessToken: string,
): Promise<PagedResult<RunListItem>> {
  return apiClient.get<PagedResult<RunListItem>>(
    `/projects/${projectId}/runs${buildQueryString(params)}`,
    accessToken,
  )
}

// API-RUN-002

export function getRun(
  projectId: string,
  runId: string,
  accessToken: string,
): Promise<RunDetail> {
  return apiClient.get<RunDetail>(
    `/projects/${projectId}/runs/${runId}`,
    accessToken,
  )
}

// API-RUN-003

export function getRunExecution(
  projectId: string,

  runId: string,

  executionId: string,

  accessToken: string,
): Promise<RunExecutionDetail> {
  return apiClient.get<RunExecutionDetail>(
    `/projects/${projectId}/runs/${runId}/executions/${executionId}`,
    accessToken,
  )
}

export interface ListApiRunExecutionsParams {
  page?: number

  pageSize?: number

  environmentId?: string

  // Phase 3 Test Case History & Run Again (§8 drill-down) — scopes this
  // API's execution history down to one Test Case's chain.
  testCaseKey?: string

  sortBy?: string

  sortOrder?: string
}

// API-RUN-005

export function listApiRunExecutions(
  projectId: string,

  apiId: string,

  params: ListApiRunExecutionsParams,

  accessToken: string,
): Promise<PagedResult<ApiRunExecutionListItem>> {
  return apiClient.get<PagedResult<ApiRunExecutionListItem>>(
    `/projects/${projectId}/apis/${apiId}/run-executions${buildQueryString(params)}`,

    accessToken,
  )
}

// Phase 3 Test Case History & Run Again (§7/§8) — one card per distinct Test
// Case (testCaseKey) for this API, most recently run first.

export function listTestCases(
  projectId: string,

  apiId: string,

  accessToken: string,
): Promise<TestCaseListItem[]> {
  return apiClient.get<TestCaseListItem[]>(
    `/projects/${projectId}/apis/${apiId}/test-cases`,

    accessToken,
  )
}

// Phase 3 Test Case History & Run Again (§4) — normal workflow: re-submits
// the given execution's saved Request Input as a fresh Run, auto-chaining
// against the most recent previous execution of the same Test Case.

export function runAgain(
  projectId: string,

  apiId: string,

  executionId: string,

  accessToken: string,
): Promise<RunDetail> {
  return apiClient.post<RunDetail>(
    `/projects/${projectId}/apis/${apiId}/run-executions/${executionId}/run-again`,

    undefined,

    accessToken,
  )
}

// Phase 3 Test Case History & Run Again (§5) — advanced workflow: re-runs
// this specific historical execution, forcing the comparison baseline back
// to it rather than auto-chaining to the latest.

export function rerunExecution(
  projectId: string,

  apiId: string,

  executionId: string,

  accessToken: string,
): Promise<RunDetail> {
  return apiClient.post<RunDetail>(
    `/projects/${projectId}/apis/${apiId}/run-executions/${executionId}/rerun`,

    undefined,

    accessToken,
  )
}
