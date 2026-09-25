import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { JsonHighlight } from "../../components/ui/JsonHighlight";
import { getSnapshotContent } from "./snapshot.api";
import { downloadSnapshotBlob } from "./snapshot-content.util";
import type { SnapshotBodyDescriptor } from "./snapshot.types";

// AnD UI §4 "Payload retrieval" + §95 body tri-state rules: absent, present
// with 0 bytes, and present-with-content (including a literal JSON `null`,
// which is just the 4-character text "null" and renders as plain text) must
// never be conflated. previewText === null on a present body means
// binary/non-textual content — show metadata + Download only, never attempt
// to render it as text.
export function SnapshotBodyView({
  projectId,
  snapshotId,
  accessToken,
  bodyPart,
  descriptor,
}: {
  projectId: string;
  snapshotId: string;
  accessToken: string | null;
  bodyPart: "request" | "response";
  descriptor: SnapshotBodyDescriptor;
}) {
  const [fullText, setFullText] = useState<string | null>(null);
  const [pending, setPending] = useState<"view" | "download" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleViewFull() {
    if (!accessToken) return;
    setPending("view");
    setActionError(null);
    try {
      const result = await getSnapshotContent(projectId, snapshotId, bodyPart, accessToken);
      if (!result.present || !result.blob) {
        setActionError("Content is no longer available.");
        return;
      }
      setFullText(await result.blob.text());
    } catch {
      setActionError("Unable to load the full content.");
    } finally {
      setPending(null);
    }
  }

  async function handleDownload() {
    if (!accessToken) return;
    setPending("download");
    setActionError(null);
    try {
      const result = await getSnapshotContent(projectId, snapshotId, bodyPart, accessToken);
      if (!result.present || !result.blob) {
        setActionError("Content is no longer available.");
        return;
      }
      downloadSnapshotBlob(result.blob, snapshotId, bodyPart, result.contentType ?? descriptor.contentType);
    } catch {
      setActionError("Unable to download this content.");
    } finally {
      setPending(null);
    }
  }

  if (!descriptor.present) {
    return <p className="m-0 text-xs text-muted">No body</p>;
  }

  if (descriptor.sizeBytes === 0) {
    return <p className="m-0 text-xs text-muted">Empty body (0 bytes)</p>;
  }

  const isTextual = descriptor.previewText !== null;
  const canViewFull = isTextual && descriptor.previewTruncated && fullText === null;

  return (
    <div className="flex flex-col gap-2">
      {isTextual ? (
        <pre className="m-0 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-900">
          <JsonHighlight value={fullText ?? descriptor.previewText ?? ""} />
        </pre>
      ) : (
        <p className="m-0 text-xs text-muted">
          Binary content ({descriptor.contentType ?? "unknown type"}, {descriptor.sizeBytes ?? 0} bytes) — not shown.
        </p>
      )}

      {isTextual && descriptor.previewTruncated && fullText === null && (
        <p className="m-0 text-xs text-warning">Preview truncated — showing the first part only.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canViewFull && (
          <Button variant="secondary" size="sm" onClick={handleViewFull} disabled={pending !== null}>
            {pending === "view" ? "Loading…" : "View full"}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={handleDownload} disabled={pending !== null}>
          {pending === "download" ? "Downloading…" : isTextual ? "Download full content" : "Download original content"}
        </Button>
      </div>

      {actionError && <p className="m-0 text-xs text-error">{actionError}</p>}
    </div>
  );
}
