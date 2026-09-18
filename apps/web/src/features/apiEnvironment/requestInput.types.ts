// REQ-INP-003/004/005 — frontend shapes mirroring the confirmed 3B-10 backend
// contract (apps/api/src/modules/api-environment/request-input.service.ts and
// dto/put-request-input.dto.ts). Request Definition (WHAT input an API
// accepts) and Run Values (the value entered for one Run) are intentionally
// two separate structures — UI FROZEN §20 Data Ownership Boundary — and must
// never be merged into each other.

export type ParameterLocation = "QUERY" | "HEADER";

export interface PathParameterDefinition {
  name: string;
  required: true;
  source: "AUTO_DETECTED";
}

export interface ParameterDefinition {
  name: string;
  required: boolean;
}

export interface RequestBodyDefinition {
  bodyType: "JSON";
}

// Mirrors the GET /projects/:projectId/apis/:apiId/request-input response.
export interface RequestInputDefinition {
  apiId: string;
  httpMethod: string;
  path: string;
  pathParameters: PathParameterDefinition[];
  queryParameters: ParameterDefinition[];
  headerParameters: ParameterDefinition[];
  requestBody: RequestBodyDefinition | null;
}

// Mirrors the PUT /projects/:projectId/apis/:apiId/request-input body.
export interface PutRequestInputPayload {
  queryParameters: ParameterDefinition[];
  headerParameters: ParameterDefinition[];
  requestBody: RequestBodyDefinition | null;
}

// Manual per-Run values (REQ-INP-004). Local-only, ephemeral, never
// persisted or merged into RequestInputDefinition.
export interface RunRequestValues {
  pathValues: Record<string, string>;
  queryValues: Record<string, string>;
  headerValues: Record<string, string>;
  bodyValue: string;
}
