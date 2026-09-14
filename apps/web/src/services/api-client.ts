// Small reusable HTTP client for the QC Tool API. Talks to VITE_API_BASE_URL
// directly (no dev-server proxy is configured) and understands exactly the
// backend's existing error envelope: { errorCode, message, details, requestId }.
// It never invents new error codes — callers branch on `ApiError.errorCode`
// using the codes the backend actually documents/emits.

const DEFAULT_BASE_URL = "http://localhost:3000/api/v1";

function baseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;
}

export interface ApiErrorBody {
  errorCode: string;
  message: string;
  details: unknown[];
  requestId: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details: unknown[];
  readonly requestId: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = body.errorCode;
    this.details = body.details;
    this.requestId = body.requestId;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  accessToken?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.accessToken) {
    headers["Authorization"] = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    if (payload && typeof payload === "object" && typeof (payload as ApiErrorBody).errorCode === "string") {
      throw new ApiError(response.status, payload as ApiErrorBody);
    }
    // The backend's AllExceptionsFilter always returns the envelope above; a
    // non-JSON error response means the request never reached the API layer
    // (e.g. network failure, proxy, or the server being down).
    throw new ApiError(response.status, {
      errorCode: "NETWORK_ERROR",
      message: response.statusText || "Request failed",
      details: [],
      requestId: "",
    });
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, accessToken?: string | null) => request<T>(path, { method: "GET", accessToken }),
  post: <T>(path: string, body?: unknown, accessToken?: string | null) =>
    request<T>(path, { method: "POST", body, accessToken }),
};
