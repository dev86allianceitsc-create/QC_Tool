import { useState } from "react"

import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { thClass, tdClass, trHoverClass } from "../../components/ui/table"

import { ApiError } from "../../services/api-client"

import type {
  ImportOutcome,
  PreviewCandidate,
  PreviewImportResult,
} from "./apiEnvironment.types"

// UI-API-03/04/05 as one modal: Upload -> Preview (select endpoints) ->

// Confirm Import -> Result. Parsing, duplicate detection and import

// execution all happen on the backend (REQ-FUN-002); this flow only

// uploads the file and renders the server's response at each step.

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8 text-muted"
      aria-hidden="true"
    >
      <path d="M12 16V4m0 0-4 4m4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export function ImportSwaggerFlow({
  onPreview,

  onConfirm,

  onImported,

  onClose,
}: {
  onPreview: (file: File) => Promise<PreviewImportResult>

  onConfirm: (
    file: File,
    selectedCandidates: { httpMethod: string; path: string }[],
  ) => Promise<ImportOutcome>

  onImported: () => void

  onClose: () => void
}) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload")

  const [file, setFile] = useState<File | null>(null)

  const [preview, setPreview] = useState<PreviewImportResult | null>(null)

  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [result, setResult] = useState<ImportOutcome | null>(null)

  const [uploadError, setUploadError] = useState<string | null>(null)

  const [previewLoading, setPreviewLoading] = useState(false)

  const [importing, setImporting] = useState(false)

  const [dragActive, setDragActive] = useState(false)

  async function handleFileSelect(selectedFile: File | undefined) {
    if (!selectedFile) return

    if (
      !selectedFile.name.endsWith(".json") &&
      !selectedFile.name.endsWith(".yaml") &&
      !selectedFile.name.endsWith(".yml")
    ) {
      setUploadError("File must be JSON or YAML (OpenAPI/Swagger spec)")

      return
    }

    setUploadError(null)

    setPreviewLoading(true)

    try {
      const previewResult = await onPreview(selectedFile)

      setFile(selectedFile)

      setPreview(previewResult)

      setSelected(
        new Set(
          previewResult.items
            .map((item, i) => (item.status === "VALID" ? i : -1))
            .filter((i) => i >= 0),
        ),
      )

      setStep("preview")
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : "Unable to preview file.",
      )
    } finally {
      setPreviewLoading(false)
    }
  }

  function toggleEndpoint(index: number, candidate: PreviewCandidate) {
    if (candidate.status !== "VALID") return

    setSelected((prev) => {
      const next = new Set(prev)

      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }

      return next
    })
  }

  async function handleImportSelected() {
    if (!file || !preview) return

    const selectedCandidates = preview.items

      .filter((_, i) => selected.has(i))

      .map((c) => ({ httpMethod: c.httpMethod, path: c.path }))

    setImporting(true)

    setUploadError(null)

    try {
      const outcome = await onConfirm(file, selectedCandidates)

      setResult(outcome)

      setStep("result")

      onImported()
    } catch (err) {
      setUploadError(
        err instanceof ApiError
          ? err.message
          : "Unable to import selected endpoints.",
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[560px] rounded-lg border border-border bg-white p-6 shadow-lg">
        {step === "upload" && (
          <>
            <h3 className="m-0 text-base font-semibold text-gray-900">
              Import from Swagger/OpenAPI
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              Upload a JSON or YAML OpenAPI/Swagger spec file. Only endpoints
              you select will be imported.
            </p>

            <label
              htmlFor="swagger-file-input"
              onDragOver={(e) => {
                e.preventDefault()
                if (!previewLoading) setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                if (!previewLoading) void handleFileSelect(e.dataTransfer.files?.[0])
              }}
              className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                previewLoading
                  ? "cursor-not-allowed border-border bg-gray-50"
                  : dragActive
                    ? "cursor-pointer border-primary bg-primary-light"
                    : "cursor-pointer border-border bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <UploadIcon />
              <p className="text-sm font-medium text-gray-900">
                {previewLoading ? (
                  "Uploading and parsing..."
                ) : (
                  <>
                    Drag and drop your file here, or{" "}
                    <span className="text-primary">browse</span>
                  </>
                )}
              </p>
              <p className="text-xs text-muted">JSON or YAML (.json, .yaml, .yml)</p>
              <input
                id="swagger-file-input"
                type="file"
                accept=".json,.yaml,.yml"
                disabled={previewLoading}
                onChange={(e) => void handleFileSelect(e.target.files?.[0])}
                className="sr-only"
              />
            </label>

            {uploadError && (
              <p className="mt-3 text-xs text-error">{uploadError}</p>
            )}

            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {step === "preview" && preview && (
          <>
            <h3 className="m-0 text-base font-semibold text-gray-900">
              Preview — {file?.name}
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              Select the endpoints to import as APIs in this Project.
            </p>

            <div className="mt-4 max-h-[320px] overflow-y-auto rounded-md border border-border">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${thClass} w-10`}></th>
                    <th className={thClass}>Method</th>
                    <th className={thClass}>Path</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((c, i) => (
                    <tr
                      key={`${c.httpMethod}-${c.path}`}
                      className={`${trHoverClass} ${c.status !== "VALID" ? "opacity-60" : ""}`}
                    >
                      <td className={`${tdClass} text-center`}>
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          disabled={c.status !== "VALID"}
                          onChange={() => toggleEndpoint(i, c)}
                          className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className={`${tdClass} font-medium`}>{c.httpMethod}</td>
                      <td className={tdClass}>{c.path}</td>
                      <td className={tdClass}>
                        {c.status === "VALID" ? (
                          <Badge tone="success" label="Ready to import" />
                        ) : (
                          <Badge tone="warning" label={c.reason ?? c.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {uploadError && (
              <p className="mt-3 text-xs text-error">{uploadError}</p>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="secondary" onClick={onClose} disabled={importing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleImportSelected()}
                disabled={selected.size === 0 || importing}
              >
                {importing ? "Importing..." : "Import Selected"}
              </Button>
            </div>
          </>
        )}

        {step === "result" && result && (
          <>
            <h3 className="m-0 text-base font-semibold text-gray-900">
              Import Result
            </h3>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="success" label={`${result.summary.imported} imported`} />
              {result.summary.skipped > 0 && (
                <Badge tone="warning" label={`${result.summary.skipped} skipped`} />
              )}
              {result.summary.failed > 0 && (
                <Badge tone="danger" label={`${result.summary.failed} failed`} />
              )}
            </div>

            {result.summary.skipped > 0 && (
              <div className="mt-4">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
                  Skipped
                </p>
                <ul className="m-0 mt-1.5 list-none space-y-1 p-0 text-sm text-gray-900">
                  {result.results

                    .filter((r) => r.result === "SKIPPED")

                    .map((r) => (
                      <li key={`${r.httpMethod}-${r.path}`}>
                        <span className="font-medium">{r.httpMethod}</span> {r.path}
                        {r.reason ? (
                          <span className="text-muted"> — {r.reason}</span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {result.summary.failed > 0 && (
              <div className="mt-4">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
                  Failed
                </p>
                <ul className="m-0 mt-1.5 list-none space-y-1 p-0 text-sm text-gray-900">
                  {result.results

                    .filter((r) => r.result === "FAILED")

                    .map((r) => (
                      <li key={`${r.httpMethod}-${r.path}`}>
                        <span className="font-medium">{r.httpMethod}</span> {r.path}
                        {r.reason ? (
                          <span className="text-error"> — {r.reason}</span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
