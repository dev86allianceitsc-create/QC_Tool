// Group Run types — mirror apps/api/src/modules/run/runs.service.ts response
// shapes and dto/create-run.dto.ts request shape exactly. Date fields are
// strings here (JSON over the wire), not the backend's Date objects.

export type RunType = "SINGLE" | "BATCH";

export interface RunRequestValuesPayload {
  pathValues?: Record<string, string>;
  queryValues?: Record<string, string>;
  headerValues?: Record<string, string>;
  bodyValue?: string;
}

export interface RunExecutionInput {
  apiId: string;
  requestValues: RunRequestValuesPayload;
  apiVersion?: string;
  databaseVersion?: string;
}

export interface CreateRunPayload {
  runType: RunType;
  environmentId: string;
  executions: RunExecutionInput[];
}

export interface RunExecutionSummary {
  totalApis: number;
  responseReceivedCount: number;
  runErrorCount: number;
  skippedCount: number;
  unfinishedCount: number;
}

export interface RunExecutionListItem {
  executionId: string;
  apiId: string;
  executionOrder: number;
  executionStatus: string;
  executionOutcome: string | null;
  skipReasonCode: string | null;
  httpStatus: number | null;
  apiVersion: string;
  databaseVersion: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
}

export interface RunDetail {
  runId: string;
  projectId: string;
  environmentId: string;
  createdBy: string;
  runType: string;
  runStatus: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  note: string | null;
  summary: RunExecutionSummary;
  executions: RunExecutionListItem[];
}

export interface RunListItem {
  runId: string;
  runType: string;
  runStatus: string;
  apiId: string | null;
  environmentId: string;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  summary: RunExecutionSummary;
}

export interface RunActualRequest {
  method: string;
  url: string;
  query: unknown;
  headers: unknown;
  body: string | null;
}

export interface RunHttpResponse {
  httpStatus: number | null;
  headers: unknown;
  body: string | null;
  contentType: string | null;
  bodyKind: string | null;
  isTruncated: boolean;
  originalSizeBytes: number | null;
}

export interface RunExecutionDetail {
  runId: string;
  executionId: string;
  apiId: string;
  environmentId: string;
  executionOrder: number;
  executionStatus: string;
  executionOutcome: string | null;
  actualRequest: RunActualRequest | null;
  httpResponse: RunHttpResponse | null;
  executionError: { reasonCode: string; message: string | null } | null;
  skipReason: { reasonCode: string } | null;
  apiVersion: string;
  databaseVersion: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
}

export interface ApiRunExecutionListItem {
  runId: string;
  executionId: string;
  runType: string;
  environmentId: string;
  executionStatus: string;
  executionOutcome: string | null;
  httpStatus: number | null;
  apiVersion: string;
  databaseVersion: string;
  createdAt: string;
}
