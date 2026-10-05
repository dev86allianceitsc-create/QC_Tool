import type { CurlFetchImportPreview } from "./apiEnvironment.types"

import { isDuplicateName, isReservedHeaderName } from "./requestInput.util"

// Phase 2 (customer feedback #1) — parses a pasted curl command or a
// browser DevTools "Copy as fetch" snippet entirely client-side (no file
// upload, no backend round-trip). Deliberately never uses eval/Function on
// pasted text: parsing is plain string scanning/regex only.

export interface ParsedHttpRequest {
  httpMethod: string
  url: string
  headers: Record<string, string>
  body: string | null
}

export type ImportFormat = "CURL" | "FETCH" | "UNKNOWN"

export function detectImportFormat(raw: string): ImportFormat {
  const trimmed = raw.trim()

  if (/^curl\b/i.test(trimmed)) return "CURL"
  if (/\bfetch\s*\(/.test(trimmed)) return "FETCH"

  return "UNKNOWN"
}

function joinLineContinuations(raw: string): string {
  return raw.replace(/\\\r?\n/g, " ").replace(/\^\r?\n/g, " ")
}

function tokenizeShellLike(input: string): string[] {
  const tokens: string[] = []

  let current = ""
  let inSingle = false
  let inDouble = false
  let hasToken = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inSingle) {
      if (ch === "'") {
        inSingle = false
      } else {
        current += ch
      }
      continue
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false
      } else if (ch === "\\" && i + 1 < input.length && '"\\$`'.includes(input[i + 1])) {
        current += input[i + 1]
        i++
      } else {
        current += ch
      }
      continue
    }

    if (ch === "'") {
      inSingle = true
      hasToken = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      hasToken = true
      continue
    }
    if (ch === "\\" && i + 1 < input.length) {
      current += input[i + 1]
      i++
      hasToken = true
      continue
    }
    if (/\s/.test(ch)) {
      if (hasToken) {
        tokens.push(current)
        current = ""
        hasToken = false
      }
      continue
    }

    current += ch
    hasToken = true
  }

  if (hasToken) tokens.push(current)

  return tokens
}

// Flags that take a value we don't care about, but must still skip over so
// the next real token isn't mistaken for the URL.
const SKIPPED_VALUE_FLAGS = new Set([
  "-A",
  "--user-agent",
  "-b",
  "--cookie",
  "-u",
  "--user",
  "-e",
  "--referer",
  "--connect-timeout",
  "-m",
  "--max-time",
  "-o",
  "--output",
  "-w",
  "--write-out",
  "--cacert",
  "--cert",
  "--key",
  "--proxy",
])

export function parseCurlCommand(raw: string): ParsedHttpRequest {
  const tokens = tokenizeShellLike(joinLineContinuations(raw.trim()))

  let method: string | null = null
  let url: string | null = null
  let body: string | null = null
  let dataFlagUsed = false
  const headers: Record<string, string> = {}

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i]

    if (tok === "-X" || tok === "--request") {
      const value = tokens[++i]
      if (value) method = value.toUpperCase()
      continue
    }

    if (tok === "-H" || tok === "--header") {
      const headerToken = tokens[++i] ?? ""
      const idx = headerToken.indexOf(":")
      if (idx > 0) {
        const name = headerToken.slice(0, idx).trim()
        const value = headerToken.slice(idx + 1).trim()
        if (name) headers[name] = value
      }
      continue
    }

    if (tok === "-d" || tok === "--data" || tok === "--data-raw" || tok === "--data-binary" || tok === "--data-ascii") {
      body = tokens[++i] ?? ""
      dataFlagUsed = true
      continue
    }

    if (tok === "--url") {
      const value = tokens[++i]
      if (value) url = value
      continue
    }

    if (tok === "-G" || tok === "--get") {
      // Real curl moves -d payloads into the query string when -G is
      // present; recognized here only so it doesn't break parsing.
      continue
    }

    if (SKIPPED_VALUE_FLAGS.has(tok)) {
      i++
      continue
    }

    if (tok.startsWith("-")) {
      // Unrecognized flag with no value we track (-s, -v, -k, -L,
      // --compressed, etc.) — ignore.
      continue
    }

    if (!url) url = tok
  }

  if (!url) {
    throw new Error("Could not find a URL in the curl command.")
  }

  return { httpMethod: method ?? (dataFlagUsed ? "POST" : "GET"), url, headers, body }
}

function unescapeJsString(value: string): string {
  return value.replace(/\\(.)/g, (_, ch: string) => {
    switch (ch) {
      case "n":
        return "\n"
      case "t":
        return "\t"
      case "r":
        return "\r"
      default:
        return ch
    }
  })
}

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0
  let inSingle = false
  let inDouble = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]

    if (inSingle) {
      if (ch === "\\") {
        i++
      } else if (ch === "'") {
        inSingle = false
      }
      continue
    }
    if (inDouble) {
      if (ch === "\\") {
        i++
      } else if (ch === '"') {
        inDouble = false
      }
      continue
    }
    if (ch === "'") {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0
  let inSingle = false
  let inDouble = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]

    if (inSingle) {
      if (ch === "\\") {
        i++
      } else if (ch === "'") {
        inSingle = false
      }
      continue
    }
    if (inDouble) {
      if (ch === "\\") {
        i++
      } else if (ch === '"') {
        inDouble = false
      }
      continue
    }
    if (ch === "'") {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }
    if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

export function parseFetchSnippet(raw: string): ParsedHttpRequest {
  const fetchIdx = raw.indexOf("fetch(")
  if (fetchIdx === -1) {
    throw new Error("Could not find a fetch(...) call.")
  }

  const openParenIdx = fetchIdx + "fetch".length
  const closeParenIdx = findMatchingParen(raw, openParenIdx)
  const callBody = closeParenIdx === -1 ? raw.slice(openParenIdx + 1) : raw.slice(openParenIdx + 1, closeParenIdx)

  const urlMatch = /^\s*["']((?:[^"'\\]|\\.)*)["']/.exec(callBody)
  if (!urlMatch) {
    throw new Error("Could not find the request URL in the fetch() call.")
  }
  const url = unescapeJsString(urlMatch[1])

  let method = "GET"
  const headers: Record<string, string> = {}
  let body: string | null = null

  const optionsBraceIdx = callBody.indexOf("{", urlMatch.index + urlMatch[0].length)

  if (optionsBraceIdx !== -1) {
    const optionsCloseIdx = findMatchingBrace(callBody, optionsBraceIdx)
    const optionsText = optionsCloseIdx === -1 ? callBody.slice(optionsBraceIdx) : callBody.slice(optionsBraceIdx, optionsCloseIdx + 1)

    const methodMatch = /["']?\bmethod\b["']?\s*:\s*["']([A-Za-z]+)["']/.exec(optionsText)
    if (methodMatch) method = methodMatch[1].toUpperCase()

    const headersKeyMatch = /["']?\bheaders\b["']?\s*:\s*\{/.exec(optionsText)
    if (headersKeyMatch) {
      const headersBraceIdx = headersKeyMatch.index + headersKeyMatch[0].length - 1
      const headersCloseIdx = findMatchingBrace(optionsText, headersBraceIdx)
      const headersText =
        headersCloseIdx === -1 ? optionsText.slice(headersBraceIdx) : optionsText.slice(headersBraceIdx + 1, headersCloseIdx)

      const headerEntryPattern = /["']([^"']+)["']\s*:\s*["']((?:[^"'\\]|\\.)*)["']/g
      let entryMatch: RegExpExecArray | null
      while ((entryMatch = headerEntryPattern.exec(headersText)) !== null) {
        headers[entryMatch[1]] = unescapeJsString(entryMatch[2])
      }
    }

    const bodyKeyMatch = /["']?\bbody\b["']?\s*:\s*/.exec(optionsText)
    if (bodyKeyMatch) {
      const afterBodyKey = optionsText.slice(bodyKeyMatch.index + bodyKeyMatch[0].length)
      const bodyStringMatch = /^["']((?:[^"'\\]|\\.)*)["']/.exec(afterBodyKey)

      if (bodyStringMatch) {
        body = unescapeJsString(bodyStringMatch[1])
      } else if (/^JSON\.stringify\(/.exec(afterBodyKey)) {
        const argOpenIdx = "JSON.stringify".length
        const argCloseIdx = findMatchingParen(afterBodyKey, argOpenIdx)
        body = (argCloseIdx === -1 ? afterBodyKey.slice(argOpenIdx + 1) : afterBodyKey.slice(argOpenIdx + 1, argCloseIdx)).trim()
      }
    }
  }

  return { httpMethod: method, url, headers, body }
}

export function parseImportInput(raw: string): { parsed: ParsedHttpRequest } | { error: string } {
  const format = detectImportFormat(raw)

  try {
    if (format === "CURL") return { parsed: parseCurlCommand(raw) }
    if (format === "FETCH") return { parsed: parseFetchSnippet(raw) }

    return {
      error:
        "Couldn't recognize this as a curl command or a fetch() call. Paste the output of your browser's \"Copy as cURL\" or \"Copy as fetch\".",
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to parse the pasted command." }
  }
}

function toUrlObject(rawUrl: string): URL {
  try {
    return new URL(rawUrl)
  } catch {
    return new URL(rawUrl, "http://placeholder.local")
  }
}

export function buildImportPreview(parsed: ParsedHttpRequest): CurlFetchImportPreview {
  const warnings: string[] = []
  const url = toUrlObject(parsed.url)
  const path = url.pathname || "/"

  const queryParameters: { name: string; required: boolean; value: string }[] = []
  const seenQueryNames: string[] = []
  for (const name of url.searchParams.keys()) {
    if (isDuplicateName(name, seenQueryNames, "QUERY")) {
      warnings.push(`Duplicate QUERY parameter '${name}' was ignored; only the first occurrence was imported.`)
      continue
    }
    seenQueryNames.push(name)
    queryParameters.push({ name, required: false, value: url.searchParams.get(name) ?? "" })
  }

  const headerParameters: { name: string; required: boolean; value: string }[] = []
  const seenHeaderNames: string[] = []
  for (const name of Object.keys(parsed.headers)) {
    if (isReservedHeaderName(name)) {
      warnings.push(`Header '${name}' is reserved and was not imported as a normal Header parameter.`)
      continue
    }
    if (isDuplicateName(name, seenHeaderNames, "HEADER")) {
      warnings.push(`Duplicate HEADER parameter '${name}' was ignored; only the first occurrence was imported.`)
      continue
    }
    seenHeaderNames.push(name)
    headerParameters.push({ name, required: false, value: parsed.headers[name] })
  }

  let requestBody: { bodyType: "JSON" } | null = null
  let bodyValue: string | null = null
  if (parsed.body != null && parsed.body !== "") {
    try {
      JSON.parse(parsed.body)
      requestBody = { bodyType: "JSON" }
      bodyValue = parsed.body
    } catch {
      warnings.push("A request body was detected but is not valid JSON, so it was not included. You can add a JSON body manually.")
    }
  }

  warnings.push("The request's domain was not imported. Configure the API's URL per Environment separately.")

  return {
    httpMethod: parsed.httpMethod,
    path,
    suggestedApiName: `${parsed.httpMethod} ${path}`,
    queryParameters,
    headerParameters,
    requestBody,
    bodyValue,
    warnings,
  }
}

// Run API's Request Values step needs a value for every Path Parameter (the
// `{name}` tokens auto-detected from the API's Path — see
// PathParameterDefinition.source). The Path is free text the user edits
// after parsing (e.g. /widgets/123 -> /widgets/{id}), so the parameter set
// only exists at Save time; this maps each {name} in the edited Path back to
// the concrete value at the same segment position in the originally parsed
// Path, best-effort.
export function derivePathValues(originalPath: string, editedPath: string): Record<string, string> {
  const originalSegments = originalPath.split("/")
  const values: Record<string, string> = {}

  editedPath.split("/").forEach((segment, i) => {
    const match = /^\{(.+)\}$/.exec(segment)
    const originalValue = match ? originalSegments[i] : undefined
    if (match && originalValue) values[match[1]] = originalValue
  })

  return values
}
