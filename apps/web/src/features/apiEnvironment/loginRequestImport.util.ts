import type { ParsedHttpRequest } from "./curlFetchImport.util"

import { isDuplicateName } from "./requestInput.util"

import { validateLoginUrlSyntax } from "./authentication.util"

import type {
  AuthenticationConfiguration,
  FieldLocation,
  FieldLocationKind,
  ImportBodyFormat,
  KeyValueEntry,
  PutAuthenticationConfigurationPayload,
} from "./authentication.types"

// Phase C (Import Login Request) — companion to curlFetchImport.util.ts.
// Reuses its parseImportInput/ParsedHttpRequest as-is; everything here is
// specific to turning a parsed login request into a reviewable draft with
// detected username/password locations. Detection/preview stays entirely
// client-side; the backend never re-parses cURL/fetch text.

export type LoginImportBodyFormat = ImportBodyFormat | "UNSUPPORTED"

export interface LoginImportCandidateField {
  location: FieldLocation
  name: string
  value: string
}

export interface LoginImportPreview {
  httpMethod: string
  url: string
  headerFields: KeyValueEntry[]
  bodyFields: KeyValueEntry[]
  bodyFormat: LoginImportBodyFormat
  candidates: LoginImportCandidateField[]
  detectedUsernameLocation: FieldLocation | null
  detectedPasswordLocation: FieldLocation | null
  warnings: string[]
}

export interface LoginImportDraft {
  httpMethod: string
  url: string
  headerFields: KeyValueEntry[]
  bodyFields: KeyValueEntry[]
  bodyFormat: LoginImportBodyFormat
  usernameLocation: FieldLocation | null
  passwordLocation: FieldLocation | null
}

// Priority-ordered, case-insensitive — same style as ACCESS_TOKEN_KEY_CANDIDATES
// in run-dispatch.util.ts. A field earlier in the list wins when a response
// carries more than one plausible candidate.
export const USERNAME_KEY_CANDIDATES = [
  "username",
  "user_name",
  "user",
  "email",
  "login",
  "account",
]

export const PASSWORD_KEY_CANDIDATES = ["password", "passwd", "pwd", "pass"]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function detectBodyFormat(
  headers: Record<string, string>,
  body: string | null,
): LoginImportBodyFormat {
  if (body == null || body === "") return "NONE"

  const contentType = (
    Object.entries(headers).find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? ""
  ).toLowerCase()

  if (contentType.includes("json")) {
    try {
      if (isPlainObject(JSON.parse(body))) return "JSON"
    } catch {
      // Header claims JSON but the body doesn't parse — fall through to sniffing.
    }
  }

  if (contentType.includes("x-www-form-urlencoded")) return "FORM_URLENCODED"

  const trimmed = body.trim()

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      if (isPlainObject(JSON.parse(trimmed))) return "JSON"
    } catch {
      // Falls through to UNSUPPORTED below.
    }
    return "UNSUPPORTED"
  }

  if (/^[^\s=&]+=[^\s&]*(&[^\s=&]+=[^\s&]*)*$/.test(trimmed)) return "FORM_URLENCODED"

  return "UNSUPPORTED"
}

function extractBodyFields(body: string | null, bodyFormat: LoginImportBodyFormat): KeyValueEntry[] {
  if (bodyFormat === "JSON") {
    try {
      const parsed = JSON.parse(body ?? "{}")
      if (!isPlainObject(parsed)) return []
      return Object.entries(parsed).map(([name, value]) => ({
        name,
        value: typeof value === "string" ? value : JSON.stringify(value),
      }))
    } catch {
      return []
    }
  }

  if (bodyFormat === "FORM_URLENCODED") {
    return Array.from(new URLSearchParams(body ?? "").entries()).map(([name, value]) => ({
      name,
      value,
    }))
  }

  return []
}

export function extractCandidateFields(
  headerFields: KeyValueEntry[],
  bodyFields: KeyValueEntry[],
): LoginImportCandidateField[] {
  return [
    ...headerFields.map((f) => ({
      location: { kind: "HEADER" as FieldLocationKind, name: f.name },
      name: f.name,
      value: f.value,
    })),
    ...bodyFields.map((f) => ({
      location: { kind: "BODY" as FieldLocationKind, name: f.name },
      name: f.name,
      value: f.value,
    })),
  ]
}

function findFirstMatch(
  candidates: LoginImportCandidateField[],
  keyCandidates: string[],
  exclude: FieldLocation | null,
): FieldLocation | null {
  for (const key of keyCandidates) {
    for (const candidate of candidates) {
      if (
        exclude &&
        candidate.location.kind === exclude.kind &&
        candidate.location.name === exclude.name
      ) {
        continue
      }
      if (candidate.name.toLowerCase() === key) return candidate.location
    }
  }
  return null
}

export function detectCredentialFields(candidates: LoginImportCandidateField[]): {
  usernameLocation: FieldLocation | null
  passwordLocation: FieldLocation | null
} {
  const usernameLocation = findFirstMatch(candidates, USERNAME_KEY_CANDIDATES, null)
  const passwordLocation = findFirstMatch(candidates, PASSWORD_KEY_CANDIDATES, usernameLocation)

  return { usernameLocation, passwordLocation }
}

export function buildLoginImportPreview(parsed: ParsedHttpRequest): LoginImportPreview {
  const warnings: string[] = []

  const headerFields: KeyValueEntry[] = []
  const seenHeaderNames: string[] = []
  for (const name of Object.keys(parsed.headers)) {
    if (isDuplicateName(name, seenHeaderNames, "HEADER")) {
      warnings.push(`Duplicate header '${name}' was ignored; only the first occurrence was imported.`)
      continue
    }
    seenHeaderNames.push(name)
    headerFields.push({ name, value: parsed.headers[name] })
  }

  const bodyFormat = detectBodyFormat(parsed.headers, parsed.body)
  const bodyFields = extractBodyFields(parsed.body, bodyFormat)

  if (bodyFormat === "UNSUPPORTED") {
    warnings.push(
      "The request body isn't JSON or form-urlencoded, so its fields couldn't be imported. Use Manual configuration instead.",
    )
  }

  const candidates = extractCandidateFields(headerFields, bodyFields)
  const { usernameLocation, passwordLocation } = detectCredentialFields(candidates)

  return {
    httpMethod: parsed.httpMethod,
    url: parsed.url,
    headerFields,
    bodyFields,
    bodyFormat,
    candidates,
    detectedUsernameLocation: usernameLocation,
    detectedPasswordLocation: passwordLocation,
    warnings,
  }
}

function locationTargetExists(
  location: FieldLocation,
  headerFields: KeyValueEntry[],
  bodyFields: KeyValueEntry[],
): boolean {
  const pool = location.kind === "HEADER" ? headerFields : bodyFields
  return pool.some((entry) => entry.name === location.name)
}

export function validateLoginImportDraft(draft: LoginImportDraft): string | null {
  const url = draft.url.trim()

  if (!url) return "Login URL is required."

  const urlError = validateLoginUrlSyntax(url)
  if (urlError) return urlError

  if (url.length > 2048) return "Login URL must be 2048 characters or fewer."

  if (!draft.httpMethod) return "Method is required."

  if (draft.bodyFormat === "UNSUPPORTED") {
    return "The imported body format isn't supported for Import Login Request. Use Manual configuration instead."
  }

  if (draft.bodyFormat !== "NONE" && draft.bodyFields.length === 0) {
    return "At least one body field is required unless the body format is None."
  }

  if (!draft.usernameLocation) return "Select which field represents the username."
  if (!draft.passwordLocation) return "Select which field represents the password."

  if (
    draft.usernameLocation.kind === draft.passwordLocation.kind &&
    draft.usernameLocation.name === draft.passwordLocation.name
  ) {
    return "Username field and Password field must be different."
  }

  if (!locationTargetExists(draft.usernameLocation, draft.headerFields, draft.bodyFields)) {
    return "Username field must reference an imported header or body field."
  }
  if (!locationTargetExists(draft.passwordLocation, draft.headerFields, draft.bodyFields)) {
    return "Password field must reference an imported header or body field."
  }

  return null
}

export function toLoginImportDraft(config: AuthenticationConfiguration): LoginImportDraft {
  return {
    httpMethod: config.importMethod ?? "",
    url: config.importUrl ?? "",
    headerFields: config.importHeaders ?? [],
    bodyFields: config.importBodyFields ?? [],
    bodyFormat: config.importBodyFormat ?? "NONE",
    usernameLocation: config.importUsernameLocation ?? null,
    passwordLocation: config.importPasswordLocation ?? null,
  }
}

export function isLoginImportDraftDirty(
  draft: LoginImportDraft | null,
  config: AuthenticationConfiguration,
): boolean {
  return JSON.stringify(draft) !== JSON.stringify(toLoginImportDraft(config))
}

export function buildImportedConfigurationPayload(
  draft: LoginImportDraft,
): PutAuthenticationConfigurationPayload {
  return {
    authType: "LOGIN_FORM",
    loginMode: "IMPORTED",
    importMethod: draft.httpMethod,
    importUrl: draft.url.trim(),
    importHeaders: draft.headerFields,
    importBodyFormat: draft.bodyFormat === "UNSUPPORTED" ? "NONE" : draft.bodyFormat,
    importBodyFields: draft.bodyFields,
    importUsernameLocation: draft.usernameLocation ?? undefined,
    importPasswordLocation: draft.passwordLocation ?? undefined,
  }
}
