import { MAX_STORED_RESPONSE_BODY_BYTES } from "./run.constants";

const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN"]);
const CONNECTION_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "EPIPE", "EHOSTUNREACH", "ENETUNREACH", "ECONNABORTED"]);
const TLS_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_SIGNATURE_FAILURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export interface ClassifiedError {
  reasonCode: "TIMEOUT" | "DNS_ERROR" | "TLS_ERROR" | "CONNECTION_ERROR" | "UNKNOWN_EXECUTION_ERROR";
  message: string;
}

// Maps Node/undici transport failures onto the REQ-RUN-003 error-reason
// domain. Falls through to UNKNOWN_EXECUTION_ERROR for anything not
// recognized (including the plain Error()s thrown by performLoginFormAuth
// for a non-2xx login response or a missing token) rather than guessing.
export function classifyTransportError(err: unknown): ClassifiedError {
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError" || name === "TimeoutError") {
    return { reasonCode: "TIMEOUT", message: "Request timed out" };
  }

  const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
  const code = cause && typeof cause === "object" && "code" in cause ? String((cause as { code?: unknown }).code) : undefined;

  if (code === "ETIMEDOUT") {
    return { reasonCode: "TIMEOUT", message: "Request timed out" };
  }
  if (code && DNS_CODES.has(code)) {
    return { reasonCode: "DNS_ERROR", message: "DNS resolution failed" };
  }
  if (code && CONNECTION_CODES.has(code)) {
    return { reasonCode: "CONNECTION_ERROR", message: "Connection failed" };
  }
  if (code && (TLS_CODES.has(code) || code.startsWith("ERR_TLS"))) {
    return { reasonCode: "TLS_ERROR", message: "TLS/SSL handshake failed" };
  }

  return { reasonCode: "UNKNOWN_EXECUTION_ERROR", message: err instanceof Error ? err.message : "Unknown execution error" };
}

// Masks the credential value in an outgoing Authorization header while
// preserving the auth scheme for a still-useful debug trace. This is the
// only header we redact — custom headers are the user's own typed input,
// not a system-managed secret (REQ-RUN-008 RS-008-15 is scoped to the
// Authentication Configuration credential specifically).
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = key.toLowerCase() === "authorization" ? maskAuthorizationValue(value) : value;
  }
  return result;
}

function maskAuthorizationValue(value: string): string {
  const match = /^(\S+)\s+(.+)$/.exec(value);
  return match ? `${match[1]} [REDACTED]` : "[REDACTED]";
}

export interface ReadResponseBodyResult {
  bodyKind: "TEXT" | "BINARY";
  bodyText: string | null;
  isTruncated: boolean;
  sizeBytes: number | null;
  storedBytes: number | null;
  contentType: string | null;
}

const TEXT_LIKE_CONTENT_TYPE = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|.*\+json|.*\+xml)/i;

// Binary/file responses persist metadata only, never the body (REQ-RUN-008
// RS-008-18) — the body stream is cancelled unread so the connection is
// released promptly instead of being buffered for nothing.
export async function readResponseBody(response: Response): Promise<ReadResponseBodyResult> {
  const contentType = response.headers.get("content-type");
  const isTextLike = !contentType || TEXT_LIKE_CONTENT_TYPE.test(contentType);

  if (!isTextLike) {
    await response.body?.cancel().catch(() => undefined);
    const lengthHeader = response.headers.get("content-length");
    return {
      bodyKind: "BINARY",
      bodyText: null,
      isTruncated: false,
      sizeBytes: lengthHeader ? Number(lengthHeader) : null,
      storedBytes: null,
      contentType,
    };
  }

  const buffer = await response.arrayBuffer();
  const bytes = Buffer.from(buffer);
  const totalBytes = bytes.byteLength;
  const isTruncated = totalBytes > MAX_STORED_RESPONSE_BODY_BYTES;
  const storedBuffer = isTruncated ? bytes.subarray(0, MAX_STORED_RESPONSE_BODY_BYTES) : bytes;
  const storedText = storedBuffer.toString("utf-8");

  return {
    bodyKind: "TEXT",
    bodyText: storedText,
    isTruncated,
    sizeBytes: totalBytes,
    storedBytes: Buffer.byteLength(storedText, "utf-8"),
    contentType,
  };
}

export function getByDotPath(obj: unknown, path: string): unknown {
  if (!path) {
    return undefined;
  }
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
