import { apiClient } from "../../services/api-client";
import type { PagedResult } from "../../services/paged-result";
import { buildQueryString } from "../../services/query-string";
import type {
  ApiDetail,
  ApiListItem,
  EnvironmentClassification,
  EnvironmentDetail,
  EnvironmentListItem,
  ApiEnvironmentConfigListItem,
  ImportOutcome,
  PreviewImportResult,
} from "./apiEnvironment.types";
import type { AuthenticationConfiguration, PutAuthenticationConfigurationPayload, PutCredentialPayload } from "./authentication.types";
import type { PutRequestInputPayload, RequestInputDefinition } from "./requestInput.types";

export interface ListApisParams {
  page?: number;
  pageSize?: number;
  search?: string;
  httpMethod?: string;
}

// API-API-001
export function listApis(projectId: string, params: ListApisParams, accessToken: string): Promise<PagedResult<ApiListItem>> {
  return apiClient.get<PagedResult<ApiListItem>>(`/projects/${projectId}/apis${buildQueryString(params)}`, accessToken);
}

// API-API-002
export function createApi(
  projectId: string,
  body: { apiName: string; httpMethod: string; path: string; description?: string | null },
  accessToken: string,
): Promise<ApiDetail> {
  return apiClient.post<ApiDetail>(`/projects/${projectId}/apis`, body, accessToken);
}

// API-API-003
export function getApi(projectId: string, apiId: string, accessToken: string): Promise<ApiDetail> {
  return apiClient.get<ApiDetail>(`/projects/${projectId}/apis/${apiId}`, accessToken);
}

// API-API-004
export function updateApi(
  projectId: string,
  apiId: string,
  body: { apiName?: string; httpMethod?: string; path?: string; description?: string | null },
  accessToken: string,
): Promise<ApiDetail> {
  return apiClient.patch<ApiDetail>(`/projects/${projectId}/apis/${apiId}`, body, accessToken);
}

// API-API-005 (soft delete)
export function deleteApi(projectId: string, apiId: string, accessToken: string): Promise<void> {
  return apiClient.delete<void>(`/projects/${projectId}/apis/${apiId}`, accessToken);
}

// API-API-006
export function previewOpenApiImport(projectId: string, file: File, accessToken: string): Promise<PreviewImportResult> {
  const form = new FormData();
  form.append("file", file);
  return apiClient.postForm<PreviewImportResult>(`/projects/${projectId}/api-imports/preview`, form, accessToken);
}

// API-API-007
export function confirmOpenApiImport(
  projectId: string,
  file: File,
  selectedCandidates: { httpMethod: string; path: string }[],
  accessToken: string,
): Promise<ImportOutcome> {
  const form = new FormData();
  form.append("file", file);
  form.append("selectedCandidates", JSON.stringify(selectedCandidates));
  return apiClient.postForm<ImportOutcome>(`/projects/${projectId}/api-imports`, form, accessToken);
}

export interface ListEnvironmentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  classification?: EnvironmentClassification;
}

// API-ENV-001
export function listEnvironments(
  projectId: string,
  params: ListEnvironmentsParams,
  accessToken: string,
): Promise<PagedResult<EnvironmentListItem>> {
  return apiClient.get<PagedResult<EnvironmentListItem>>(`/projects/${projectId}/environments${buildQueryString(params)}`, accessToken);
}

// API-ENV-002
export function createEnvironment(
  projectId: string,
  body: { environmentName: string; classification: EnvironmentClassification },
  accessToken: string,
): Promise<EnvironmentDetail> {
  return apiClient.post<EnvironmentDetail>(`/projects/${projectId}/environments`, body, accessToken);
}

// API-ENV-003
export function getEnvironment(projectId: string, environmentId: string, accessToken: string): Promise<EnvironmentDetail> {
  return apiClient.get<EnvironmentDetail>(`/projects/${projectId}/environments/${environmentId}`, accessToken);
}

// API-ENV-004
export function updateEnvironment(
  projectId: string,
  environmentId: string,
  body: {
    environmentName?: string;
    classification?: EnvironmentClassification;
    allowRun?: boolean;
    environmentStatus?: "ACTIVE" | "INACTIVE";
  },
  accessToken: string,
): Promise<EnvironmentDetail> {
  return apiClient.patch<EnvironmentDetail>(`/projects/${projectId}/environments/${environmentId}`, body, accessToken);
}

// API-APIENV-001
export function listApiEnvironmentConfigs(
  projectId: string,
  apiId: string,
  accessToken: string,
): Promise<{ apiId: string; items: ApiEnvironmentConfigListItem[] }> {
  return apiClient.get<{ apiId: string; items: ApiEnvironmentConfigListItem[] }>(
    `/projects/${projectId}/apis/${apiId}/environment-configs`,
    accessToken,
  );
}

// API-APIENV-002 — the backend returns 200 or 201 depending on create-vs-update;
// apiClient.put's underlying request() treats both as success uniformly.
export function putApiEnvironmentConfig(
  projectId: string,
  apiId: string,
  environmentId: string,
  fullUrl: string,
  accessToken: string,
): Promise<{ apiId: string; environmentId: string; urlStatus: "CONFIGURED"; fullUrl: string; createdAt: string; updatedAt: string }> {
  return apiClient.put(`/projects/${projectId}/apis/${apiId}/environment-configs/${environmentId}`, { fullUrl }, accessToken);
}

// API-INP-001
export function getRequestInput(projectId: string, apiId: string, accessToken: string): Promise<RequestInputDefinition> {
  return apiClient.get<RequestInputDefinition>(`/projects/${projectId}/apis/${apiId}/request-input`, accessToken);
}

// API-INP-002
export function putRequestInput(
  projectId: string,
  apiId: string,
  payload: PutRequestInputPayload,
  accessToken: string,
): Promise<RequestInputDefinition> {
  return apiClient.put<RequestInputDefinition>(`/projects/${projectId}/apis/${apiId}/request-input`, payload, accessToken);
}

// API-AUTH-001
export function getAuthenticationConfiguration(
  projectId: string,
  apiId: string,
  environmentId: string,
  accessToken: string,
): Promise<AuthenticationConfiguration> {
  return apiClient.get<AuthenticationConfiguration>(
    `/projects/${projectId}/apis/${apiId}/environment-configs/${environmentId}/authentication`,
    accessToken,
  );
}

// API-AUTH-002
export function putAuthenticationConfiguration(
  projectId: string,
  apiId: string,
  environmentId: string,
  payload: PutAuthenticationConfigurationPayload,
  accessToken: string,
): Promise<AuthenticationConfiguration> {
  return apiClient.put<AuthenticationConfiguration>(
    `/projects/${projectId}/apis/${apiId}/environment-configs/${environmentId}/authentication`,
    payload,
    accessToken,
  );
}

// API-AUTH-003
export function putCredential(
  projectId: string,
  apiId: string,
  environmentId: string,
  payload: PutCredentialPayload,
  accessToken: string,
): Promise<AuthenticationConfiguration> {
  return apiClient.put<AuthenticationConfiguration>(
    `/projects/${projectId}/apis/${apiId}/environment-configs/${environmentId}/authentication/credential`,
    payload,
    accessToken,
  );
}

// API-AUTH-004
export function deleteCredential(projectId: string, apiId: string, environmentId: string, accessToken: string): Promise<AuthenticationConfiguration> {
  return apiClient.delete<AuthenticationConfiguration>(
    `/projects/${projectId}/apis/${apiId}/environment-configs/${environmentId}/authentication/credential`,
    accessToken,
  );
}
