import { useState } from "react"

import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Input, Textarea } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"

import { parseImportInput } from "./curlFetchImport.util"

import {
  buildLoginImportPreview,
  validateLoginImportDraft,
  type LoginImportBodyFormat,
  type LoginImportDraft,
} from "./loginRequestImport.util"

import type { FieldLocation, FieldLocationKind } from "./authentication.types"

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

const BODY_FORMAT_LABELS: Record<LoginImportBodyFormat, string> = {
  JSON: "JSON",
  FORM_URLENCODED: "Form URL-encoded",
  NONE: "No body",
  UNSUPPORTED: "Unsupported",
}

interface FieldRow {
  name: string
  value: string
  included: boolean
}

function locationKey(loc: FieldLocation | null): string {
  return loc ? `${loc.kind}:${loc.name}` : ""
}

function parseLocationKey(key: string): FieldLocation | null {
  if (!key) return null
  const idx = key.indexOf(":")
  return { kind: key.slice(0, idx) as FieldLocationKind, name: key.slice(idx + 1) }
}

// Phase C (Import Login Request) — two-step paste -> review wizard modeled
// directly on ImportCurlFetchFlow.tsx. Parsing/detection is entirely
// client-side (loginRequestImport.util.ts, itself built on
// curlFetchImport.util.ts's parser); this component never calls the API —
// it reports the reviewed draft back to AuthenticationTab, which owns the
// actual saveConfiguration call once the Admin hits the page-level Save.
export function ImportLoginRequestFlow({
  initialDraft,

  onSave,

  onCancel,

  readOnly,
}: {
  initialDraft: LoginImportDraft | null

  onSave: (draft: LoginImportDraft) => void

  onCancel: () => void

  readOnly?: boolean
}) {
  const [step, setStep] = useState<"paste" | "review">(
    initialDraft && initialDraft.url ? "review" : "paste",
  )

  const [rawText, setRawText] = useState("")
  const [parseError, setParseError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const [method, setMethod] = useState(initialDraft?.httpMethod || "POST")
  const [url, setUrl] = useState(initialDraft?.url ?? "")
  const [headerRows, setHeaderRows] = useState<FieldRow[]>(
    (initialDraft?.headerFields ?? []).map((f) => ({ ...f, included: true })),
  )
  const [bodyRows, setBodyRows] = useState<FieldRow[]>(
    (initialDraft?.bodyFields ?? []).map((f) => ({ ...f, included: true })),
  )
  const [bodyFormat, setBodyFormat] = useState<LoginImportBodyFormat>(
    initialDraft?.bodyFormat ?? "NONE",
  )
  const [usernameLocation, setUsernameLocation] = useState<FieldLocation | null>(
    initialDraft?.usernameLocation ?? null,
  )
  const [passwordLocation, setPasswordLocation] = useState<FieldLocation | null>(
    initialDraft?.passwordLocation ?? null,
  )
  const [detectedHint, setDetectedHint] = useState(false)

  const [formError, setFormError] = useState<string | null>(null)

  // Tracks the last draft actually handed back to AuthenticationTab via
  // onSave, so the review step can show a "captured" confirmation instead of
  // silently doing nothing when "Use this request" is clicked — the Admin
  // still has to click the page-level Save to persist it, so the message
  // says that explicitly rather than implying the change is already saved.
  const [capturedDraft, setCapturedDraft] = useState<LoginImportDraft | null>(
    initialDraft && initialDraft.url ? initialDraft : null,
  )

  function handleParse() {
    const outcome = parseImportInput(rawText)

    if ("error" in outcome) {
      setParseError(outcome.error)
      return
    }

    const preview = buildLoginImportPreview(outcome.parsed)

    setParseError(null)
    setWarnings(preview.warnings)
    setMethod((HTTP_METHODS.includes(preview.httpMethod) ? preview.httpMethod : "POST"))
    setUrl(preview.url)
    setHeaderRows(preview.headerFields.map((f) => ({ ...f, included: true })))
    setBodyRows(preview.bodyFields.map((f) => ({ ...f, included: true })))
    setBodyFormat(preview.bodyFormat)
    setUsernameLocation(preview.detectedUsernameLocation)
    setPasswordLocation(preview.detectedPasswordLocation)
    setDetectedHint(preview.detectedUsernameLocation !== null || preview.detectedPasswordLocation !== null)
    setFormError(null)
    setStep("review")
  }

  function updateRow(rows: FieldRow[], setRows: (rows: FieldRow[]) => void, index: number, changes: Partial<FieldRow>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  // The captured curl/fetch snippet only reflects what the browser happened
  // to send — some real login endpoints reject a request missing a header
  // the browser adds automatically (Origin, User-Agent) and that DevTools
  // therefore never included in "Copy as fetch"/"Copy as cURL" output. This
  // lets the admin add such a header or body field by hand rather than
  // being stuck re-capturing a different snippet format and hoping it's
  // more complete.
  function addRow(rows: FieldRow[], setRows: (rows: FieldRow[]) => void) {
    setRows([...rows, { name: "", value: "", included: true }])
  }

  const includedHeaderRows = headerRows.filter((r) => r.included)
  const includedBodyRows = bodyRows.filter((r) => r.included)

  const candidateOptions: { key: string; label: string }[] = [
    ...includedHeaderRows.map((r) => ({ key: locationKey({ kind: "HEADER", name: r.name }), label: `Header: ${r.name}` })),
    ...includedBodyRows.map((r) => ({ key: locationKey({ kind: "BODY", name: r.name }), label: `Body: ${r.name}` })),
  ]

  function buildDraft(): LoginImportDraft {
    return {
      httpMethod: method,
      url,
      headerFields: includedHeaderRows.map((r) => ({ name: r.name.trim(), value: r.value })),
      bodyFields: includedBodyRows.map((r) => ({ name: r.name.trim(), value: r.value })),
      bodyFormat,
      usernameLocation,
      passwordLocation,
    }
  }

  function handleSave() {
    const draft = buildDraft()
    const error = validateLoginImportDraft(draft)

    if (error) {
      setFormError(error)
      return
    }

    setFormError(null)
    setCapturedDraft(draft)
    onSave(draft)
  }

  const justCaptured =
    capturedDraft !== null &&
    JSON.stringify(capturedDraft) === JSON.stringify(buildDraft())

  if (step === "paste") {
    return (
      <Card>
        <h3 className="m-0 text-base font-semibold text-gray-900">Import Login Request</h3>
        <p className="mt-1.5 text-sm text-muted">
          Paste a <code>curl ...</code> command or a browser DevTools "Copy as fetch" snippet captured from the
          target system's real login request. You'll review and confirm the detected fields before saving.
        </p>

        <div className="mt-4">
          <Textarea
            label="Pasted command"
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value)
              setParseError(null)
            }}
            placeholder={`curl 'https://target.example.com/oauth/token' -d 'username=alice&password=s3cret'`}
            className="min-h-[160px] font-mono"
            disabled={readOnly}
          />
        </div>

        {parseError && <p className="mt-3 text-xs text-error">{parseError}</p>}

        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleParse} disabled={!rawText.trim() || readOnly}>
            Parse
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="m-0 text-base font-semibold text-gray-900">Review Import</h3>
      <p className="mt-1.5 text-sm text-muted">
        Confirm the method, URL, headers, and body fields, and which field carries the username and password. At Run
        time, the selected Test Account's real values replace these two fields.
      </p>

      {warnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {warnings.map((w, i) => (
            <Badge key={i} tone="warning" label={w} className="whitespace-normal text-left" />
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2.5">
        <div className="w-[120px]">
          <Select
            label="Method *"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={readOnly}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Input
            label="Login URL *"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://target.example.com/oauth/token"
            className="font-mono"
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">Headers</p>
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
                  disabled={readOnly}
                  className="h-4 w-4 accent-primary"
                />
                <input
                  type="text"
                  value={row.name}
                  disabled={!row.included || readOnly}
                  onChange={(e) => updateRow(headerRows, setHeaderRows, i, { name: e.target.value })}
                  className="flex-1 rounded-md border border-border px-2 py-1 font-mono text-sm disabled:bg-gray-50 disabled:text-muted"
                />
                <input
                  type="text"
                  value={row.value}
                  disabled={!row.included || readOnly}
                  onChange={(e) => updateRow(headerRows, setHeaderRows, i, { value: e.target.value })}
                  className="flex-1 rounded-md border border-border px-2 py-1 font-mono text-sm disabled:bg-gray-50 disabled:text-muted"
                />
              </div>
            ))}
          </div>
        )}
        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addRow(headerRows, setHeaderRows)}
            className="mt-2"
          >
            + Add Header
          </Button>
        )}
      </div>

      <div className="mt-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
          Body fields ({BODY_FORMAT_LABELS[bodyFormat]})
        </p>
        {bodyFormat === "UNSUPPORTED" ? (
          <p className="mt-1.5 text-sm text-error">
            This request's body isn't JSON or form-urlencoded, so its fields couldn't be imported. Use Manual
            configuration instead.
          </p>
        ) : (
          <>
            {bodyRows.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted">None detected.</p>
            ) : (
              <div className="mt-1.5 flex flex-col gap-1.5">
                {bodyRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.included}
                      onChange={(e) => updateRow(bodyRows, setBodyRows, i, { included: e.target.checked })}
                      disabled={readOnly}
                      className="h-4 w-4 accent-primary"
                    />
                    <input
                      type="text"
                      value={row.name}
                      disabled={!row.included || readOnly}
                      onChange={(e) => updateRow(bodyRows, setBodyRows, i, { name: e.target.value })}
                      className="flex-1 rounded-md border border-border px-2 py-1 font-mono text-sm disabled:bg-gray-50 disabled:text-muted"
                    />
                    <input
                      type="text"
                      value={row.value}
                      disabled={!row.included || readOnly}
                      onChange={(e) => updateRow(bodyRows, setBodyRows, i, { value: e.target.value })}
                      className="flex-1 rounded-md border border-border px-2 py-1 font-mono text-sm disabled:bg-gray-50 disabled:text-muted"
                    />
                  </div>
                ))}
              </div>
            )}
            {!readOnly && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addRow(bodyRows, setBodyRows)}
                className="mt-2"
              >
                + Add Body Field
              </Button>
            )}
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Select
            label="Username field *"
            value={locationKey(usernameLocation)}
            onChange={(e) => setUsernameLocation(parseLocationKey(e.target.value))}
            disabled={readOnly}
          >
            <option value="">Select a field...</option>
            {candidateOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </Select>
          {detectedHint && usernameLocation && (
            <p className="mt-1 text-xs text-muted">Detected automatically — change it if this isn't right.</p>
          )}
        </div>
        <div>
          <Select
            label="Password field *"
            value={locationKey(passwordLocation)}
            onChange={(e) => setPasswordLocation(parseLocationKey(e.target.value))}
            disabled={readOnly}
          >
            <option value="">Select a field...</option>
            {candidateOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </Select>
          {detectedHint && passwordLocation && (
            <p className="mt-1 text-xs text-muted">Detected automatically — change it if this isn't right.</p>
          )}
        </div>
      </div>

      {formError && <p className="mt-3 text-xs text-error">{formError}</p>}

      {justCaptured && !formError && (
        <p className="mt-3 text-xs text-success">
          Request captured. Click Save at the top of the page to save this Authentication
          configuration.
        </p>
      )}

      {!readOnly && (
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setStep("paste")}>
            Back
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Use this request
          </Button>
        </div>
      )}
    </Card>
  )
}
