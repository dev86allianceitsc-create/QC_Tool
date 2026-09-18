import { useState } from "react";
import { ApiError } from "../../services/api-client";
import type { ImportOutcome, PreviewCandidate, PreviewImportResult } from "./apiEnvironment.types";

// UI-API-03/04/05 as one modal: Upload -> Preview (select endpoints) ->
// Confirm Import -> Result. Parsing, duplicate detection and import
// execution all happen on the backend (REQ-FUN-002); this flow only
// uploads the file and renders the server's response at each step.
export function ImportSwaggerFlow({
  onPreview,
  onConfirm,
  onImported,
  onClose,
}: {
  onPreview: (file: File) => Promise<PreviewImportResult>;
  onConfirm: (file: File, selectedCandidates: { httpMethod: string; path: string }[]) => Promise<ImportOutcome>;
  onImported: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewImportResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleFileSelect(selectedFile: File | undefined) {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".json") && !selectedFile.name.endsWith(".yaml") && !selectedFile.name.endsWith(".yml")) {
      setUploadError("File must be JSON or YAML (OpenAPI/Swagger spec)");
      return;
    }
    setUploadError(null);
    setPreviewLoading(true);
    try {
      const previewResult = await onPreview(selectedFile);
      setFile(selectedFile);
      setPreview(previewResult);
      setSelected(new Set(previewResult.items.map((item, i) => (item.status === "VALID" ? i : -1)).filter((i) => i >= 0)));
      setStep("preview");
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Unable to preview file.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function toggleEndpoint(index: number, candidate: PreviewCandidate) {
    if (candidate.status !== "VALID") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleImportSelected() {
    if (!file || !preview) return;
    const selectedCandidates = preview.items
      .filter((_, i) => selected.has(i))
      .map((c) => ({ httpMethod: c.httpMethod, path: c.path }));
    setImporting(true);
    setUploadError(null);
    try {
      const outcome = await onConfirm(file, selectedCandidates);
      setResult(outcome);
      setStep("result");
      onImported();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Unable to import selected endpoints.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "480px" }}>
        {step === "upload" && (
          <>
            <h3>Import from Swagger/OpenAPI</h3>
            <p style={{ color: "#666", fontSize: "13px" }}>Upload a JSON or YAML OpenAPI/Swagger spec file. Only endpoints you select will be imported.</p>
            <input
              type="file"
              accept=".json,.yaml,.yml"
              disabled={previewLoading}
              onChange={(e) => void handleFileSelect(e.target.files?.[0])}
              style={{ marginTop: "10px" }}
            />
            {previewLoading && <p style={{ fontSize: "13px" }}>Uploading and parsing...</p>}
            {uploadError && <p style={{ color: "red", fontSize: "12px" }}>{uploadError}</p>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "preview" && preview && (
          <>
            <h3>Preview — {file?.name}</h3>
            <p style={{ color: "#666", fontSize: "13px" }}>Select the endpoints to import as APIs in this Project.</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000" }}>
                  <th style={{ padding: "6px" }}></th>
                  <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid #ccc" }}>Method</th>
                  <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid #ccc" }}>Path</th>
                  <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid #ccc" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((c, i) => (
                  <tr key={`${c.httpMethod}-${c.path}`} style={{ borderBottom: "1px solid #ccc", opacity: c.status === "VALID" ? 1 : 0.6 }}>
                    <td style={{ padding: "6px", textAlign: "center" }}>
                      <input type="checkbox" checked={selected.has(i)} disabled={c.status !== "VALID"} onChange={() => toggleEndpoint(i, c)} />
                    </td>
                    <td style={{ padding: "6px" }}>{c.httpMethod}</td>
                    <td style={{ padding: "6px" }}>{c.path}</td>
                    <td style={{ padding: "6px", fontSize: "12px", color: c.status === "VALID" ? "#666" : "#D97706" }}>
                      {c.status === "VALID" ? "Ready to import" : c.reason ?? c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {uploadError && <p style={{ color: "red", fontSize: "12px" }}>{uploadError}</p>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={onClose} disabled={importing} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: importing ? "not-allowed" : "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => void handleImportSelected()}
                disabled={selected.size === 0 || importing}
                style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: selected.size === 0 || importing ? "not-allowed" : "pointer", opacity: importing ? 0.6 : 1 }}
              >
                {importing ? "Importing..." : "Import Selected"}
              </button>
            </div>
          </>
        )}

        {step === "result" && result && (
          <>
            <h3>Import Result</h3>
            <p>{result.summary.imported} API(s) imported successfully.</p>
            {result.summary.skipped > 0 && (
              <>
                <p style={{ color: "#D97706" }}>{result.summary.skipped} endpoint(s) skipped:</p>
                <ul style={{ fontSize: "13px", color: "#666" }}>
                  {result.results
                    .filter((r) => r.result === "SKIPPED")
                    .map((r) => (
                      <li key={`${r.httpMethod}-${r.path}`}>
                        {r.httpMethod} {r.path}
                        {r.reason ? ` — ${r.reason}` : ""}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {result.summary.failed > 0 && (
              <>
                <p style={{ color: "red" }}>{result.summary.failed} endpoint(s) failed:</p>
                <ul style={{ fontSize: "13px", color: "#666" }}>
                  {result.results
                    .filter((r) => r.result === "FAILED")
                    .map((r) => (
                      <li key={`${r.httpMethod}-${r.path}`}>
                        {r.httpMethod} {r.path}
                        {r.reason ? ` — ${r.reason}` : ""}
                      </li>
                    ))}
                </ul>
              </>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
