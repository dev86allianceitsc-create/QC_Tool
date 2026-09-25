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

export interface HeaderPair {
  key: string;
  value: string;
}

// Snapshot's own request-header capture (REQ-SNP-003 §C: "Giá trị thực tế
// nếu có" — actual value). Reads the real dispatch-time header set directly
// — never Run Result's already-folded/masked requestHeadersSafe — so a
// future change to Run Result's trace can never silently change what
// Snapshot stores. Deliberately UNMASKED, per explicit product decision:
// Snapshot must persist the exact Authorization value sent on the wire,
// diverging from redactHeaders/requestHeadersSafe above (Run Result keeps
// masking Authorization; Snapshot does not). Order matches the Record's own
// key insertion order; this can never carry a duplicate header name because
// create-run.dto.ts's headerValues field is already a Record<string, string>
// long before this point — that ceiling on fidelity is inherent to the
// input shape, not introduced here.
export function toSnapshotRequestHeaderPairs(headers: Record<string, string>): HeaderPair[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

// Snapshot's own response-header capture (REQ-SNP-003 §D). No masking, same
// as the request-header capture above — a response never carries an
// outgoing Authorization value anyway, matching Run Result's own unredacted
// responseHeadersSafe.
// DISCLOSED LIMITATION: undici's Headers implementation already sorts
// header names and combines every repeated name other than Set-Cookie into
// one comma-joined value before entries() is observable at the JS level
// (WHATWG Fetch "sort and combine" step) — this function reports that
// already-collapsed view, not the literal wire order/duplicates. Recovering
// the true wire representation would require dispatching with Node's
// http/https client (response.rawHeaders) instead of fetch(), which is out
// of scope here — this is a reported gap, not a claimed fix.
export function toSnapshotResponseHeaderPairs(headers: Headers): HeaderPair[] {
  return [...headers.entries()].map(([key, value]) => ({ key, value }));
}

export interface ReadResponseBodyResult {
  bodyKind: "TEXT" | "BINARY";
  bodyText: string | null;
  isTruncated: boolean;
  sizeBytes: number | null;
  storedBytes: number | null;
  contentType: string | null;
  // Full-fidelity copy of the same read, for Snapshot (REQ-SNP-004): the
  // complete buffer (text or binary) when the body is within
  // snapshotCapBytes, otherwise null with snapshotBodyOversized set — no
  // silent truncation for a Snapshot payload (EXC-01).
  snapshotBody: Buffer | null;
  snapshotBodyOversized: boolean;
}

const TEXT_LIKE_CONTENT_TYPE = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|.*\+json|.*\+xml)/i;

async function bufferResponseBody(response: Response, ceilingBytes: number): Promise<{ buffer: Buffer; exceededCeiling: boolean }> {
  const stream = response.body;
  if (!stream) {
    return { buffer: Buffer.alloc(0), exceededCeiling: false };
  }
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  let exceededCeiling = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value || value.byteLength === 0) {
        continue;
      }
      chunks.push(Buffer.from(value));
      total += value.byteLength;
      if (total >= ceilingBytes) {
        exceededCeiling = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { buffer: Buffer.concat(chunks), exceededCeiling };
}

// Reads the full response body once via a chunked loop capped at
// snapshotCapBytes + 1 (so an oversized body is detected without buffering
// it unboundedly), then derives two views from that single buffer: the
// existing RunExecution trace (text truncated to
// MAX_STORED_RESPONSE_BODY_BYTES, binary metadata-only — REQ-RUN-008
// RS-008-18, unchanged) and a full-fidelity copy for Snapshot (REQ-SNP-001/
// 004, Q1 decision — capture full text+binary bodies instead of inheriting
// RUN-008's 1MB truncation).
export async function readResponseBody(response: Response, snapshotCapBytes: number): Promise<ReadResponseBodyResult> {
  const contentType = response.headers.get("content-type");
  const isTextLike = !contentType || TEXT_LIKE_CONTENT_TYPE.test(contentType);

  const { buffer, exceededCeiling } = await bufferResponseBody(response, snapshotCapBytes + 1);
  const totalBytes = exceededCeiling ? null : buffer.byteLength;
  const snapshotBody = exceededCeiling ? null : buffer;

  if (!isTextLike) {
    return {
      bodyKind: "BINARY",
      bodyText: null,
      isTruncated: false,
      sizeBytes: totalBytes,
      storedBytes: null,
      contentType,
      snapshotBody,
      snapshotBodyOversized: exceededCeiling,
    };
  }

  const isTruncated = exceededCeiling || buffer.byteLength > MAX_STORED_RESPONSE_BODY_BYTES;
  const storedBuffer = buffer.subarray(0, MAX_STORED_RESPONSE_BODY_BYTES);
  const storedText = storedBuffer.toString("utf-8");

  return {
    bodyKind: "TEXT",
    bodyText: storedText,
    isTruncated,
    sizeBytes: totalBytes,
    storedBytes: Buffer.byteLength(storedText, "utf-8"),
    contentType,
    snapshotBody,
    snapshotBodyOversized: exceededCeiling,
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
