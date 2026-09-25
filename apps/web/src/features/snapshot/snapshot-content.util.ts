const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "application/json": "json",
  "text/plain": "txt",
  "text/html": "html",
  "text/csv": "csv",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/octet-stream": "bin",
};

function inferExtension(contentType: string | null): string {
  if (!contentType) return "bin";
  const base = contentType.split(";")[0].trim().toLowerCase();
  return EXTENSION_BY_CONTENT_TYPE[base] ?? "bin";
}

// SNP-004/API-SNP-003 — the Content endpoint sends no Content-Disposition
// header, so the download filename is synthesized client-side from the
// Snapshot id, body part and the real Content-Type it did send.
export function downloadSnapshotBlob(
  blob: Blob,
  snapshotId: string,
  bodyPart: "request" | "response",
  contentType: string | null,
): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `snapshot-${snapshotId}-${bodyPart}.${inferExtension(contentType)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
