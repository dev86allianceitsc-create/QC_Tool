// Group 3A (API & Environment Core) types — mirror the frozen backend
// response/request shapes in apps/api/src/modules/api-environment exactly.

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; // fixed set for the manual Create/Edit dropdown only

export interface ApiListItem {
  apiId: string;
  apiName: string;
  httpMethod: string;
  path: string;
  description: string | null;
  creationSource: string;
  configuredEnvironmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiDetail {
  apiId: string;
  projectId: string;
  apiName: string;
  httpMethod: string;
  path: string;
  description: string | null;
  creationSource: string;
  createdAt: string;
  updatedAt: string;
}

export type EnvironmentClassification = "PRODUCTION" | "NON_PRODUCTION";
export type EnvironmentStatus = "ACTIVE" | "INACTIVE";

export interface EnvironmentListItem {
  environmentId: string;
  environmentName: string;
  classification: EnvironmentClassification;
  allowRun: boolean;
  environmentStatus: EnvironmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentDetail extends EnvironmentListItem {
  projectId: string;
}

export interface ApiEnvironmentConfigListItem {
  environmentId: string;
  environmentName: string;
  classification: EnvironmentClassification;
  environmentStatus: EnvironmentStatus;
  allowRun: boolean;
  urlStatus: "CONFIGURED" | "NOT_CONFIGURED";
  fullUrl: string | null;
  credentialStatus: "NOT_REQUIRED" | "CONFIGURED" | "NOT_CONFIGURED";
}

export type PreviewCandidateStatus = "VALID" | "DUPLICATE" | "INVALID";

export interface PreviewCandidate {
  httpMethod: string;
  path: string;
  suggestedApiName?: string;
  status: PreviewCandidateStatus;
  reason?: string;
}

export interface PreviewImportResult {
  specification: { format: "JSON" | "YAML"; detectedVersion: string };
  items: PreviewCandidate[];
  totalCandidates: number;
}

export type ImportCandidateResult = "IMPORTED" | "SKIPPED" | "FAILED";

export interface ImportedCandidate {
  httpMethod: string;
  path: string;
  result: ImportCandidateResult;
  reason?: string;
  apiId?: string;
}

export interface ImportOutcome {
  results: ImportedCandidate[];
  summary: { imported: number; skipped: number; failed: number };
}
