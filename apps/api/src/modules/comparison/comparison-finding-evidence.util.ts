import type { HeaderPair } from "../run/run-dispatch.util";
import { SENSITIVE_HEADER_NAMES, SENSITIVE_JSON_FIELD_NAMES } from "./comparison.constants";

// Group 6/7 Comparison Detail — read-time re-derivation of real A/B display
// values from the Snapshot pair's already-immutable stored bytes/headers,
// keyed purely off evidence a ComparisonFinding row already persists
// (locationPath / aByteOffset+aByteLength / bByteOffset+bByteLength /
// aValueKind+bValueKind). This is a pure historical read (CMP-015/017/018's
// "permission-rechecking raw-content contract"): it never re-runs the
// engine, never recomputes SAME/DIFFERENT, never touches a terminal
// attempt. It only looks up, for a finding the engine already decided is a
// difference, what the two sides actually contained in the Snapshot at the
// time of that comparison — subject to this module's own redaction pass
// (never a passthrough of Snapshot's raw stored bytes, regardless of
// whatever masking convention Snapshot storage itself does or does not
// apply — see run-dispatch.util.ts's toSnapshotRequestHeaderPairs/
// toSnapshotResponseHeaderPairs doc comment).
//
// No new persisted evidence is required for any component — every column
// used below already existed before this module was added:
// - METHOD: Snapshot.httpMethod on each side (same small, fixed, non-secret
//   vocabulary already echoed verbatim in comparison-input-gate.util.ts's
//   methodMismatchFinding safeSummary).
// - URL: Snapshot.requestUrl on each side, reduced to path (and, when the
//   path alone doesn't already show a difference, origin) — the query string
//   and fragment are never derived, since comparison-input-gate.util.ts's
//   urlMismatchFinding deliberately never puts them in safeSummary either
//   (they can carry secrets/tokens). See urlSides()'s own comment for why
//   origin is included conditionally rather than never.
// - HTTP_STATUS: Snapshot.httpStatusCode on each side (already a small,
//   fixed, non-secret vocabulary — see comparison-output-gate.util.ts).
// - REQUEST_HEADER/RESPONSE_HEADER: locationPath IS the lowercased header
//   name (header-diff.util.ts's groupByLowerName); looking it up in the
//   Snapshot's own stored header list, case-insensitively, reproduces the
//   exact value(s) the engine already compared.
// - REQUEST_BODY/RESPONSE_BODY: aByteOffset/aByteLength (resp. b) are UTF-8
//   byte spans into the Snapshot's stored body bytes (body-diff.util.ts),
//   already populated for every JSON/raw body finding kind.
//
// A finding whose evidence genuinely isn't available (e.g. the referenced
// Snapshot payload row is missing) is reported as unavailable, never
// fabricated or recomputed from anything else.

export type DerivedPresenceKind = "ABSENT" | "NULL" | "EMPTY" | "VALUE";
export type DerivedDisplayKind = "object" | "array" | "string" | "number" | "boolean" | "null" | "raw" | "text";

export interface DerivedFindingSide {
  presenceKind: DerivedPresenceKind;
  displayKind: DerivedDisplayKind;
  safeText: string | null;
  hexPreview: string | null;
  isRedacted: boolean;
  hasMore: boolean;
}

export interface FindingEvidenceRow {
  component: string;
  locationPath: string | null;
  aByteOffset: bigint | null;
  aByteLength: bigint | null;
  bByteOffset: bigint | null;
  bByteLength: bigint | null;
  aValueKind: string | null;
  bValueKind: string | null;
}

export interface SnapshotSideEvidence {
  httpMethod: string | null;
  requestUrl: string | null;
  httpStatusCode: number | null;
  requestHeaders: readonly HeaderPair[];
  responseHeaders: readonly HeaderPair[];
  requestBody: Uint8Array | null;
  responseBody: Uint8Array | null;
}

const NOT_AVAILABLE_TEXT = "Value not available in stored finding";
const MAX_DISPLAY_TEXT_LENGTH = 2000;

export function deriveFindingSides(row: FindingEvidenceRow, a: SnapshotSideEvidence, b: SnapshotSideEvidence): { a: DerivedFindingSide; b: DerivedFindingSide } {
  if (row.component === "METHOD") {
    return { a: methodSide(a.httpMethod), b: methodSide(b.httpMethod) };
  }

  if (row.component === "URL") {
    return urlSides(a.requestUrl, b.requestUrl);
  }

  if (row.component === "HTTP_STATUS") {
    return { a: httpStatusSide(a.httpStatusCode), b: httpStatusSide(b.httpStatusCode) };
  }

  if (row.component === "REQUEST_HEADER" || row.component === "RESPONSE_HEADER") {
    const aHeaders = row.component === "REQUEST_HEADER" ? a.requestHeaders : a.responseHeaders;
    const bHeaders = row.component === "REQUEST_HEADER" ? b.requestHeaders : b.responseHeaders;
    return deriveHeaderSides(row.locationPath, aHeaders, bHeaders);
  }

  // REQUEST_BODY / RESPONSE_BODY
  const aBody = row.component === "REQUEST_BODY" ? a.requestBody : a.responseBody;
  const bBody = row.component === "REQUEST_BODY" ? b.requestBody : b.responseBody;
  return {
    a: deriveBodySide(row.locationPath, aBody, row.aByteOffset, row.aByteLength, row.aValueKind),
    b: deriveBodySide(row.locationPath, bBody, row.bByteOffset, row.bByteLength, row.bValueKind),
  };
}

function methodSide(method: string | null): DerivedFindingSide {
  // Same defensive-only null branch as httpStatusSide: a finding can only
  // exist for a Snapshot pair that was actually loaded, so this never fires
  // in practice — it exists only so a genuinely missing row reports
  // "unavailable" rather than an empty string masquerading as a real value.
  if (method === null) {
    return unavailableSide("text");
  }
  return valueTextSide(method);
}

// checkInputCompatibility (comparison-input-gate.util.ts) flags URL_MISMATCH
// on exact-string inequality of the *full* requestUrl, but this module only
// ever displays path/origin — never the query string or fragment (they can
// carry secrets/tokens). That gap used to be silent: whenever two Snapshots
// resolved to the same path (the overwhelmingly common case — same endpoint,
// different environment or query params), both sides rendered the identical
// path with no indication anything was hidden, so a genuine "differs"
// verdict sat next to two visually identical values. This widens the safe
// disclosure in two steps before falling back to an explicit note, instead
// of ever repeating one identical string next to "differs" unexplained:
//   1. Paths differ -> show path only, exactly as before (the common case;
//      origin would just be redundant noise here).
//   2. Paths match but origins differ -> show origin+path (scheme/host/port
//      are routing information, not secrets, and this is the real reason,
//      e.g. comparing across environments with different base URLs).
//   3. Paths and origins both match -> the difference is confined to the
//      query string/fragment; say so explicitly rather than displaying two
//      identical strings with no explanation.
function urlSides(aUrl: string | null, bUrl: string | null): { a: DerivedFindingSide; b: DerivedFindingSide } {
  if (aUrl === null || bUrl === null) {
    return {
      a: aUrl === null ? unavailableSide("text") : valueTextSide(urlPathOnly(aUrl)),
      b: bUrl === null ? unavailableSide("text") : valueTextSide(urlPathOnly(bUrl)),
    };
  }

  const aPath = urlPathOnly(aUrl);
  const bPath = urlPathOnly(bUrl);
  if (aPath !== bPath) {
    return { a: valueTextSide(aPath), b: valueTextSide(bPath) };
  }

  const aOrigin = urlOriginOnly(aUrl);
  const bOrigin = urlOriginOnly(bUrl);
  if (aOrigin !== bOrigin) {
    return { a: valueTextSide(`${aOrigin ?? ""}${aPath}`), b: valueTextSide(`${bOrigin ?? ""}${bPath}`) };
  }

  const note = `${aPath} (same path/host on both sides — the difference is in the query string or fragment, not shown for security)`;
  return { a: valueTextSide(note), b: valueTextSide(note) };
}

// Snapshot.requestUrl is normally an absolute URL (built at dispatch time),
// so `new URL` succeeds and `.pathname` already excludes both query and
// fragment; the catch branch is a defensive fallback for any historical row
// that isn't a well-formed absolute URL.
function urlPathOnly(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const withoutFragment = url.split("#")[0]!;
    const queryIndex = withoutFragment.indexOf("?");
    return queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  }
}

// Scheme+host+port only — never the query string/fragment. Null for a
// non-absolute URL (no origin to report), same defensive fallback case as
// urlPathOnly's catch branch.
function urlOriginOnly(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function valueTextSide(text: string): DerivedFindingSide {
  return { presenceKind: "VALUE", displayKind: "text", safeText: text, hexPreview: null, isRedacted: false, hasMore: false };
}

function httpStatusSide(status: number | null): DerivedFindingSide {
  // A COMPLETED OUTPUT attempt's Snapshot pair always has a real status
  // (ELIGIBILITY's hasPayload check, which an HTTP_STATUS finding can never
  // exist without, guarantees a non-2xx-free numeric status) — the null
  // branch is defensive only, never hit in practice.
  if (status === null) {
    return unavailableSide("text");
  }
  return { presenceKind: "VALUE", displayKind: "number", safeText: String(status), hexPreview: null, isRedacted: false, hasMore: false };
}

function deriveHeaderSides(name: string | null, aHeaders: readonly HeaderPair[], bHeaders: readonly HeaderPair[]): { a: DerivedFindingSide; b: DerivedFindingSide } {
  if (name === null) {
    return { a: unavailableSide("text"), b: unavailableSide("text") };
  }
  const sensitive = SENSITIVE_HEADER_NAMES.has(name);
  return { a: headerSide(valuesForHeaderName(aHeaders, name), sensitive), b: headerSide(valuesForHeaderName(bHeaders, name), sensitive) };
}

function valuesForHeaderName(headers: readonly HeaderPair[], name: string): string[] {
  return headers.filter((h) => h.key.toLowerCase() === name).map((h) => h.value);
}

function headerSide(values: string[], sensitive: boolean): DerivedFindingSide {
  if (values.length === 0) {
    return { presenceKind: "ABSENT", displayKind: "text", safeText: null, hexPreview: null, isRedacted: false, hasMore: false };
  }
  if (sensitive) {
    // A changed credential is still a real, worth-flagging difference — it
    // is the value itself, not the fact of the difference, that must never
    // be exposed (per the security contract: "Difference detected in
    // protected value", not a fabricated "looks the same" signal).
    return { presenceKind: "VALUE", displayKind: "text", safeText: "[REDACTED]", hexPreview: null, isRedacted: true, hasMore: false };
  }
  const text = values.length === 1 ? values[0]! : JSON.stringify(values);
  return truncatedTextSide(text, "text");
}

function deriveBodySide(path: string | null, body: Uint8Array | null, offset: bigint | null, length: bigint | null, valueKind: string | null): DerivedFindingSide {
  const displayKind = jsonValueKindToDisplayKind(valueKind);

  if (offset === null && length === null) {
    return { presenceKind: "ABSENT", displayKind, safeText: null, hexPreview: null, isRedacted: false, hasMore: false };
  }
  if (valueKind === "null") {
    return { presenceKind: "NULL", displayKind, safeText: null, hexPreview: null, isRedacted: false, hasMore: false };
  }
  if (length === 0n) {
    return { presenceKind: "EMPTY", displayKind, safeText: null, hexPreview: null, isRedacted: false, hasMore: false };
  }
  if (body === null) {
    // The finding row carries real byte-span evidence but the Snapshot's
    // payload bytes could not be loaded (should not happen given
    // SnapshotPayload's onDelete: Restrict FK) — reported as unavailable,
    // never recomputed or guessed at.
    return { presenceKind: "VALUE", displayKind, safeText: NOT_AVAILABLE_TEXT, hexPreview: null, isRedacted: false, hasMore: false };
  }

  // Whole-body findings (RAW_BYTES / body-level PRESENCE) never carry a JSON
  // path — there is no field name to check for sensitivity, so the actual
  // bytes are deliberately never decoded/shown here (the byte lengths are
  // already visible via the finding's own location metadata) rather than
  // risk exposing an unscoped body that might be entirely a credential
  // payload.
  if (path === null) {
    return { presenceKind: "VALUE", displayKind, safeText: "[Binary/raw body content not shown]", hexPreview: null, isRedacted: true, hasMore: false };
  }

  if (isSensitiveJsonPath(path)) {
    return { presenceKind: "VALUE", displayKind, safeText: "[REDACTED]", hexPreview: null, isRedacted: true, hasMore: false };
  }

  const start = Number(offset);
  const end = start + Number(length);
  const text = Buffer.from(body.subarray(start, end)).toString("utf-8");
  return truncatedTextSide(text, displayKind);
}

function truncatedTextSide(text: string, displayKind: DerivedDisplayKind): DerivedFindingSide {
  const truncated = text.length > MAX_DISPLAY_TEXT_LENGTH;
  return {
    presenceKind: "VALUE",
    displayKind,
    safeText: truncated ? text.slice(0, MAX_DISPLAY_TEXT_LENGTH) : text,
    hexPreview: null,
    isRedacted: false,
    hasMore: truncated,
  };
}

function unavailableSide(displayKind: DerivedDisplayKind): DerivedFindingSide {
  return { presenceKind: "VALUE", displayKind, safeText: NOT_AVAILABLE_TEXT, hexPreview: null, isRedacted: false, hasMore: false };
}

function jsonValueKindToDisplayKind(valueKind: string | null): DerivedDisplayKind {
  switch (valueKind) {
    case "object":
      return "object";
    case "array":
      return "array";
    case "string":
      return "string";
    case "number":
      return "number";
    case "true":
    case "false":
      return "boolean";
    case "null":
      return "null";
    default:
      return "raw";
  }
}

// Checks every property-name segment of a JSONPath-flavored location
// ("$.a.credentials[3].token" -> a, credentials, token — array indices are
// stripped, never treated as names), not just the last one: a sensitive
// field must stay redacted at any depth under it. Segment comparison
// ignores case and punctuation so "access_token", "accessToken", and
// "access-token" all match the same canonical "accesstoken" policy entry.
export function isSensitiveJsonPath(path: string): boolean {
  const segments = path
    .replace(/\[\d+\]/g, ".")
    .split(".")
    .map((segment) => segment.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((segment) => segment.length > 0);
  return segments.some((segment) => SENSITIVE_JSON_FIELD_NAMES.has(segment));
}
