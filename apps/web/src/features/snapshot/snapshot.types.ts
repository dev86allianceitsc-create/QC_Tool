// Group 5 Snapshot types — mirror apps/api/src/modules/snapshot/snapshot-query.service.ts
// response shapes exactly (API-SNP-001..004). Date fields are strings here
// (JSON over the wire), not the backend's Date objects — same convention as
// run.types.ts.

export interface HeaderPair {
  key: string;
  value: string;
}

export type SnapshotStatus = "NORMAL" | "INVALIDATED";

export interface SnapshotListItem {
  snapshotId: string;
  apiId: string;
  apiName: string;
  environmentId: string;
  environmentName: string;
  runId: string;
  executionId: string;
  httpStatus: number | null;
  executionOutcome: string;
  snapshotStatus: SnapshotStatus;
  apiVersion: string;
  databaseVersion: string;
  createdAt: string;
}

export interface SnapshotApiGroup {
  apiId: string;
  apiName: string;
  snapshotCount: number;
}

export interface ListSnapshotsResult {
  items: SnapshotListItem[];
  apiGroups: SnapshotApiGroup[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface SnapshotBodyDescriptor {
  present: boolean;
  sizeBytes: number | null;
  contentType: string | null;
  previewText: string | null;
  previewTruncated: boolean;
}

export interface SnapshotDetail {
  snapshotId: string;
  projectId: string;
  apiId: string;
  environmentId: string;
  projectName: string;
  apiName: string;
  environmentName: string;
  runId: string;
  executionId: string;
  initiatedBy: { userId: string; label: string };
  authContext: { key: string; label?: string };
  apiVersion: string;
  databaseVersion: string;
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string;
  durationMs: number | null;
  createdAt: string;
  executionOutcome: string;
  request: {
    method: string;
    url: string;
    // Null only for a Snapshot saved before the header columns existed —
    // never a fabricated value (see backend comment on SnapshotDetail).
    headers: HeaderPair[] | null;
    body: SnapshotBodyDescriptor;
  };
  response: {
    httpStatus: number | null;
    headers: HeaderPair[] | null;
    body: SnapshotBodyDescriptor;
  };
  snapshotStatus: SnapshotStatus;
  invalidation: { reason: string; invalidatedBy: { userId: string; label: string }; invalidatedAt: string } | null;
}

export interface InvalidateSnapshotResult {
  snapshotId: string;
  snapshotStatus: "INVALIDATED";
  reason: string;
  invalidatedBy: { userId: string; label: string };
  invalidatedAt: string;
}

export interface ListSnapshotsFilters {
  apiId?: string;
  environmentId?: string;
  status?: SnapshotStatus;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
}
