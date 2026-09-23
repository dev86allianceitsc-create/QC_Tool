import { apiClient } from "../../services/api-client";
import type { PagedResult } from "../../services/paged-result";
import { buildQueryString } from "../../services/query-string";
import type {
  ApiRunExecutionListItem,
  CreateRunPayload,
  RunDetail,
  RunExecutionDetail,
  RunListItem,
} from "./run.types";

// API-RUN-001
export function createRun(projectId: string, payload: CreateRunPayload, accessToken: string): Promise<RunDetail> {
  return apiClient.post<RunDetail>(`/projects/${projectId}/runs`, payload, accessToken);
}

export interface ListRunsParams {
  page?: number;
  pageSize?: number;
  apiId?: string;
  environmentId?: string;
  runType?: string;
  runStatus?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: string;
  sortOrder?: string;
}

// API-RUN-004
export function listRuns(
  projectId: string,
  params: ListRunsParams,
  accessToken: string,
): Promise<PagedResult<RunListItem>> {
  return apiClient.get<PagedResult<RunListItem>>(`/projects/${projectId}/runs${buildQueryString(params)}`, accessToken);
}

// API-RUN-002
export function getRun(projectId: string, runId: string, accessToken: string): Promise<RunDetail> {
  return apiClient.get<RunDetail>(`/projects/${projectId}/runs/${runId}`, accessToken);
}

// API-RUN-003
export function getRunExecution(
  projectId: string,
  runId: string,
  executionId: string,
  accessToken: string,
): Promise<RunExecutionDetail> {
  return apiClient.get<RunExecutionDetail>(`/projects/${projectId}/runs/${runId}/executions/${executionId}`, accessToken);
}

export interface ListApiRunExecutionsParams {
  page?: number;
  pageSize?: number;
  environmentId?: string;
  sortBy?: string;
  sortOrder?: string;
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
  );
}
