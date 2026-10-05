import { useState } from "react"

import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input, Textarea } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"

import { ApiError } from "../../services/api-client"

import { buildImportPreview, derivePathValues, parseImportInput } from "./curlFetchImport.util"

import { isDuplicateName, isReservedHeaderName, validateParameterNameFormat } from "./requestInput.util"

import type { ApiDetail, ApiMethod, ImportCurlFetchPayload } from "./apiEnvironment.types"

import type { RunRequestValues } from "./requestInput.types"

const METHODS: ApiMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]

interface ParameterRow {
  name: string
  required: boolean
  included: boolean
  value: string
}

// Phase 2 (customer feedback #1) — paste a curl command or a browser
// DevTools "Copy as fetch" snippet, review/edit the parsed result (the
// captured request always has concrete values, e.g. /widgets/123, so the
// user turns that into /widgets/{id} themselves), then save. Parsing is
// entirely client-side (curlFetchImport.util.ts); duplicate detection
// (409 API_ALREADY_EXISTS) stays authoritative on the backend.
export function ImportCurlFetchFlow({
  onImport,

  onImported,

  onClose,
}: {
  onImport: (payload: ImportCurlFetchPayload) => Promise<ApiDetail>

  onImported: (created: ApiDetail, runValues: RunRequestValues) => void

  onClose: () => void
}) {
  const [step, setStep] = useState<"paste" | "review">("paste")

  const [rawText, setRawText] = useState("")
  const [parseError, setParseError] = useState<string | null>(null)

  const [warnings, setWarnings] = useState<string[]>([])

  const [apiName, setApiName] = useState("")
  const [method, setMethod] = useState<ApiMethod>("GET")
  const [originalPath, setOriginalPath] = useState("")
  const [path, setPath] = useState("")
  const [description, setDescription] = useState("")
  const [queryRows, setQueryRows] = useState<ParameterRow[]>([])
  const [headerRows, setHeaderRows] = useState<ParameterRow[]>([])
  const [includeBody, setIncludeBody] = useState(false)
  const [bodyValue, setBodyValue] = useState<string | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleParse() {
    const outcome = parseImportInput(rawText)

    if ("error" in outcome) {
      setParseError(outcome.error)
      return
    }

    const preview = buildImportPreview(outcome.parsed)

    setParseError(null)
    setWarnings(preview.warnings)
    setApiName(preview.suggestedApiName)
    setMethod((METHODS as string[]).includes(preview.httpMethod) ? (preview.httpMethod as ApiMethod) : "GET")
    setOriginalPath(preview.path)
    setPath(preview.path)
    setDescription("")
    setQueryRows(preview.queryParameters.map((p) => ({ ...p, included: true })))
    setHeaderRows(preview.headerParameters.map((p) => ({ ...p, included: true })))
    setIncludeBody(preview.requestBody !== null)
    setBodyValue(preview.bodyValue)
    setFormError(null)
    setStep("review")
  }

  function updateRow(rows: ParameterRow[], setRows: (rows: ParameterRow[]) => void, index: number, changes: Partial<ParameterRow>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  function validateForm(): string | null {
    if (!apiName.trim()) return "API Name is required"
    if (!path.trim() || !path.trim().startsWith("/")) return "Path is required and must start with /"

    const includedQuery = queryRows.filter((r) => r.included)
    const includedHeader = headerRows.filter((r) => r.included)

    const seenQuery: string[] = []
    for (const row of includedQuery) {
      const trimmed = row.name.trim()
      const err = validateParameterNameFormat(trimmed, "QUERY")
      if (err) return err
      if (isDuplicateName(trimmed, seenQuery, "QUERY")) return `Duplicate Query parameter name '${trimmed}' is not allowed.`
      seenQuery.push(trimmed)
    }

    const seenHeader: string[] = []
    for (const row of includedHeader) {
      const trimmed = row.name.trim()
      const err = validateParameterNameFormat(trimmed, "HEADER")
      if (err) return err
      if (isReservedHeaderName(trimmed)) {
        return `'${trimmed}' is reserved and cannot be configured as a normal Header.`
      }
      if (isDuplicateName(trimmed, seenHeader, "HEADER")) return `Duplicate Header parameter name '${trimmed}' is not allowed.`
      seenHeader.push(trimmed)
    }

    return null
  }

  async function handleSave() {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setFormError(null)
    setSubmitting(true)

    const payload: ImportCurlFetchPayload = {
      apiName: apiName.trim(),
      httpMethod: method,
      path: path.trim(),
      description: description.trim() || null,
      queryParameters: queryRows.filter((r) => r.included).map((r) => ({ name: r.name.trim(), required: r.required })),
      headerParameters: headerRows.filter((r) => r.included).map((r) => ({ name: r.name.trim(), required: r.required })),
      requestBody: includeBody ? { bodyType: "JSON" } : null,
    }

    try {
      const created = await onImport(payload)

      const runValues: RunRequestValues = {
        pathValues: derivePathValues(originalPath, path.trim()),
        queryValues: Object.fromEntries(queryRows.filter((r) => r.included).map((r) => [r.name.trim(), r.value])),
        headerValues: Object.fromEntries(headerRows.filter((r) => r.included).map((r) => [r.name.trim(), r.value])),
        bodyValue: includeBody ? (bodyValue ?? "") : "",
      }

      onImported(created, runValues)
      onClose()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unable to import this API.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-lg border border-border bg-white p-6 shadow-lg">
        {step === "paste" && (
          <>
            <h3 className="m-0 text-base font-semibold text-gray-900">Import from curl/fetch</h3>
            <p className="mt-1.5 text-sm text-muted">
              Paste a <code>curl ...</code> command or a browser DevTools "Copy as fetch" snippet captured from a
              request you already made. You'll review and edit the result before saving.
            </p>

            <div className="mt-4">
              <Textarea
                label="Pasted command"
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value)
                  setParseError(null)
                }}
                placeholder={`curl 'https://api.example.com/widgets/123' -H 'Authorization: Bearer ...'`}
                className="min-h-[160px] font-mono"
              />
            </div>

            {parseError && <p className="mt-3 text-xs text-error">{parseError}</p>}

            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleParse} disabled={!rawText.trim()}>
                Parse
              </Button>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <h3 className="m-0 text-base font-semibold text-gray-900">Review Import</h3>
            <p className="mt-1.5 text-sm text-muted">
              Edit the API name, path, and parameters as needed before saving. Path placeholders like{" "}
              <code>{"{id}"}</code> aren't detected automatically — replace concrete values here.
            </p>

            {warnings.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {warnings.map((w, i) => (
                  <Badge key={i} tone="warning" label={w} className="whitespace-normal text-left" />
                ))}
              </div>
            )}

            <div className="mt-4">
              <Input label="API Name *" type="text" value={apiName} onChange={(e) => setApiName(e.target.value)} />
            </div>

            <div className="mt-3 flex gap-2.5">
              <div className="w-[120px]">
                <Select label="Method *" value={method} onChange={(e) => setMethod(e.target.value as ApiMethod)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  label="Path *"
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/widgets/{id}"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="mt-3">
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="mt-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">Query Parameters</p>
              {queryRows.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted">None detected.</p>
              ) : (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {queryRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => updateRow(queryRows, setQueryRows, i, { included: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      <input
                        type="text"
                        value={row.name}
                        disabled={!row.included}
                        onChange={(e) => updateRow(queryRows, setQueryRows, i, { name: e.target.value })}
                        className="flex-1 rounded-md border border-border px-2 py-1 font-mono text-sm disabled:bg-gray-50 disabled:text-muted"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={row.required}
                          disabled={!row.included}
                          onChange={(e) => updateRow(queryRows, setQueryRows, i, { required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">Header Parameters</p>
              {headerRows.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted">None detected.</p>
              ) : (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {headerRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => updateRow(headerRows, setHeaderRows, i, { included: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      <input
                        type="text"
                        value={row.name}
                        disabled={!row.included}
                        onChange={(e) => updateRow(headerRows, setHeaderRows, i, { name: e.target.value })}
                        className="flex-1 rounded-md border border-border px-2 py-1 font-mono text-sm disabled:bg-gray-50 disabled:text-muted"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={row.required}
                          disabled={!row.included}
                          onChange={(e) => updateRow(headerRows, setHeaderRows, i, { required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-1.5 text-sm text-gray-900">
                <input type="checkbox" checked={includeBody} onChange={(e) => setIncludeBody(e.target.checked)} />
                Include JSON request body
              </label>
            </div>

            {formError && <p className="mt-3 text-xs text-error">{formError}</p>}

            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setStep("paste")} disabled={submitting}>
                Back
              </Button>
              <Button variant="primary" onClick={() => void handleSave()} disabled={submitting}>
                {submitting ? "Creating..." : "Create API"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
