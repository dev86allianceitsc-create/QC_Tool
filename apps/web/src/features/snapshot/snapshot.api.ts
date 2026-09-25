import { apiClient, type BlobResult } from "../../services/api-client";
import { buildQueryString } from "../../services/query-string";
import type { InvalidateSnapshotResult, ListSnapshotsResult, SnapshotDetail } from "./snapshot.types";

export interface ListSnapshotsParams {
  apiId?: string;
  environmentId?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

// API-SNP-001
export function listSnapshots(projectId: string, params: ListSnapshotsParams, accessToken: string): Promise<ListSnapshotsResult> {
  return apiClient.get<ListSnapshotsResult>(`/projects/${projectId}/snapshots${buildQueryString(params)}`, accessToken);
}

// API-SNP-002
export function getSnapshot(projectId: string, snapshotId: string, accessToken: string): Promise<SnapshotDetail> {
  return apiClient.get<SnapshotDetail>(`/projects/${projectId}/snapshots/${snapshotId}`, accessToken);
}

// API-SNP-003. Raw bytes with a real Content-Type — never JSON — so this
// goes through apiClient.getBlob, not apiClient.get.
export function getSnapshotContent(
  projectId: string,
  snapshotId: string,
  bodyPart: "request" | "response",
  accessToken: string,
): Promise<BlobResult> {
  return apiClient.getBlob(`/projects/${projectId}/snapshots/${snapshotId}/contents/${bodyPart}`, accessToken);
}

// API-SNP-004
export function invalidateSnapshot(
  projectId: string,
  snapshotId: string,
  reason: string,
  accessToken: string,
): Promise<InvalidateSnapshotResult> {
  return apiClient.post<InvalidateSnapshotResult>(`/projects/${projectId}/snapshots/${snapshotId}/invalidations`, { reason }, accessToken);
}
