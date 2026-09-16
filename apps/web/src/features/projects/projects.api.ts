import { apiClient } from "../../services/api-client";
import type { PagedResult } from "../../services/paged-result";
import { buildQueryString } from "../../services/query-string";
import type { ProjectDetail, ProjectListItem, ProjectMemberView, ProjectStatus } from "./projects.types";

export interface ListProjectsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ProjectStatus;
  sortBy?: "projectName" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

// API-PRJ-001
export function listProjects(params: ListProjectsParams, accessToken: string): Promise<PagedResult<ProjectListItem>> {
  return apiClient.get<PagedResult<ProjectListItem>>(`/projects${buildQueryString(params)}`, accessToken);
}

// API-PRJ-002
export function createProject(
  body: { projectName: string; description?: string },
  accessToken: string,
): Promise<ProjectDetail> {
  return apiClient.post<ProjectDetail>("/projects", body, accessToken);
}

// API-PRJ-003
export function getProject(projectId: string, accessToken: string): Promise<ProjectDetail> {
  return apiClient.get<ProjectDetail>(`/projects/${projectId}`, accessToken);
}

// API-PRJ-004/005
export function updateProject(
  projectId: string,
  body: { projectName?: string; description?: string | null; projectStatus?: ProjectStatus },
  accessToken: string,
): Promise<ProjectDetail> {
  return apiClient.patch<ProjectDetail>(`/projects/${projectId}`, body, accessToken);
}

// API-PRJ-006 (soft delete)
export function deleteProject(projectId: string, accessToken: string): Promise<void> {
  return apiClient.delete<void>(`/projects/${projectId}`, accessToken);
}

export interface ListProjectMembersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  accountStatus?: string;
}

// API-PRJ-006 (list members)
export function listProjectMembers(
  projectId: string,
  params: ListProjectMembersParams,
  accessToken: string,
): Promise<PagedResult<ProjectMemberView>> {
  return apiClient.get<PagedResult<ProjectMemberView>>(
    `/projects/${projectId}/members${buildQueryString(params)}`,
    accessToken,
  );
}

// API-PRJ-007
export function addProjectMember(projectId: string, email: string, accessToken: string): Promise<ProjectMemberView> {
  return apiClient.post<ProjectMemberView>(`/projects/${projectId}/members`, { email }, accessToken);
}

// API-PRJ-008
export function removeProjectMember(projectId: string, userId: string, accessToken: string): Promise<void> {
  return apiClient.delete<void>(`/projects/${projectId}/members/${userId}`, accessToken);
}
