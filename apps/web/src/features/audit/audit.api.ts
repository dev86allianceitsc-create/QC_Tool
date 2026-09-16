import { apiClient } from "../../services/api-client";
import type { PagedResult } from "../../services/paged-result";
import { buildQueryString } from "../../services/query-string";
import type { AuditLogDetail, AuditLogListItem, AuditResult } from "./audit.types";

export interface AuditLogFilters {
  search?: string;
  eventType?: string;
  result?: AuditResult;
  projectId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
}

export interface ListAuditLogsParams extends AuditLogFilters {
  page?: number;
  pageSize?: number;
  sortBy?: "occurredAt";
  sortOrder?: "asc" | "desc";
}

// API-SEC-001
export function listAuditLogs(params: ListAuditLogsParams, accessToken: string): Promise<PagedResult<AuditLogListItem>> {
  return apiClient.get<PagedResult<AuditLogListItem>>(`/audit-logs${buildQueryString(params)}`, accessToken);
}

// API-SEC-002
export function getAuditLog(auditId: string, accessToken: string): Promise<AuditLogDetail> {
  return apiClient.get<AuditLogDetail>(`/audit-logs/${auditId}`, accessToken);
}

// API-SEC-003
export function exportAuditLogs(filters: AuditLogFilters, accessToken: string): Promise<string> {
  return apiClient.getText(`/audit-logs/export${buildQueryString(filters)}`, accessToken);
}
