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
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
  // "text" is only for endpoints that don't return the JSON error envelope
  // on success (e.g. the audit CSV export) — error responses are still
  // parsed as JSON regardless of this setting.
  responseType?: "json" | "text";
}

async function handleResponse<T>(response: Response, responseType?: "json" | "text"): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const payload = isJson ? await response.json() : undefined;
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

  if (responseType === "text") {
    return (await response.text()) as T;
  }

  const payload = isJson ? await response.json() : undefined;
  return payload as T;
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

  return handleResponse<T>(response, options.responseType);
}

// Multipart uploads (OpenAPI import) skip the JSON Content-Type entirely —
// the browser sets the multipart boundary itself — but reuse the same
// error-envelope handling as every other request.
async function requestForm<T>(path: string, form: FormData, accessToken?: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers,
    body: form,
  });

  return handleResponse<T>(response);
}

export interface BlobResult {
  present: boolean;
  blob: Blob | null;
  contentType: string | null;
}

// Snapshot Content endpoint (SNP-004) returns raw bytes with a real
// Content-Type — never the JSON error envelope on success, and never
// wrapped/base64-encoded — so it can't go through handleResponse<T>, which
// assumes JSON or text. 204 means the body part is genuinely absent (not an
// error); error statuses (400/401/403/404) still return the usual envelope.
async function requestBlob(path: string, accessToken?: string | null): Promise<BlobResult> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl()}${path}`, { method: "GET", headers });

  if (response.status === 204) {
    return { present: false, blob: null, contentType: null };
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : undefined;
    if (payload && typeof payload === "object" && typeof (payload as ApiErrorBody).errorCode === "string") {
      throw new ApiError(response.status, payload as ApiErrorBody);
    }
    throw new ApiError(response.status, {
      errorCode: "NETWORK_ERROR",
      message: response.statusText || "Request failed",
      details: [],
      requestId: "",
    });
  }

  const blob = await response.blob();
  return { present: true, blob, contentType: contentType || null };
}

export const apiClient = {
  get: <T>(path: string, accessToken?: string | null) => request<T>(path, { method: "GET", accessToken }),
  post: <T>(path: string, body?: unknown, accessToken?: string | null) =>
    request<T>(path, { method: "POST", body, accessToken }),
  put: <T>(path: string, body?: unknown, accessToken?: string | null) =>
    request<T>(path, { method: "PUT", body, accessToken }),
  patch: <T>(path: string, body?: unknown, accessToken?: string | null) =>
    request<T>(path, { method: "PATCH", body, accessToken }),
  delete: <T>(path: string, accessToken?: string | null) => request<T>(path, { method: "DELETE", accessToken }),
  getText: (path: string, accessToken?: string | null): Promise<string> =>
    request<string>(path, { method: "GET", accessToken, responseType: "text" }),
  postForm: <T>(path: string, form: FormData, accessToken?: string | null) => requestForm<T>(path, form, accessToken),
  getBlob: (path: string, accessToken?: string | null): Promise<BlobResult> => requestBlob(path, accessToken),
};
