import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView";
import type { Role } from "../projects/projects.types";
import { InvalidateSnapshotDialog } from "./InvalidateSnapshotDialog";
import { CheckIcon, CopyIcon } from "./snapshotIcons";
import { SnapshotBodyView } from "./SnapshotBodyView";
import { SnapshotStatusBadge } from "./SnapshotStatusBadge";
import type { HeaderPair } from "./snapshot.types";
import { useSnapshotDetail } from "./useSnapshotDetail";

function findHeader(headers: HeaderPair[] | null, name: string): string | null {
  if (!headers) return null;
  return headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value ?? null;
}

// Derives a compact "/path?query" for the page title from the Snapshot's
// stored full request URL — a display-only reformat, never a separate stored
// value (the Request card below always shows the real, complete url). Falls
// back to the untouched url if it isn't parseable, so the title never shows
// anything but real data.
function getDisplayPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

// A value with a copy-to-clipboard affordance — used for the full Snapshot ID
// and the Auth Context key, both real identifiers a user may need to paste
// elsewhere but too long to show unclipped without breaking layout.
function CopyableText({ value, display, className = "" }: { value: string; display?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied/unavailable — copy is a convenience,
      // not a requirement, so failing silently is acceptable here.
    }
  }

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1 ${className}`}>
      <span className="min-w-0 truncate" title={value}>
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        title="Copy to clipboard"
        className="flex-shrink-0 cursor-pointer rounded border-none bg-transparent p-0.5 text-muted hover:text-gray-900"
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5 text-success" /> : <CopyIcon className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

// requestHeaders/responseHeaders are null only for a Snapshot saved before
// the header columns existed (20260924130000_add_snapshot_headers) — never a
// fabricated value — so that case is shown distinctly from "captured, but
// empty". A populated list collapses behind a toggle (open by default only
// when short) so a long Response header list can't dominate the page.
function CollapsibleHeaders({ headers }: { headers: HeaderPair[] | null }) {
  const [open, setOpen] = useState(headers !== null && headers.length > 0 && headers.length <= 3);
  const [copied, setCopied] = useState(false);

  if (headers === null) {
    return <p className="m-0 text-xs text-muted">Headers not recorded for this Snapshot.</p>;
  }
  if (headers.length === 0) {
    return <p className="m-0 text-xs text-muted">No headers.</p>;
  }

  // Reassigned so the nested handleCopyAll closure below sees a plain
  // HeaderPair[] type — TS narrowing from the guard clauses above doesn't
  // carry into a function declared in this scope.
  const headerList = headers;

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(headerList.map((h) => `${h.key}: ${h.value}`).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Copy is a convenience only — ignore if the clipboard API is unavailable.
    }
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-xs font-medium text-gray-700"
        >
          <span className="text-muted">{open ? "▾" : "▸"}</span>
          Headers ({headers.length})
        </button>
        {open && (
          <button
            type="button"
            onClick={handleCopyAll}
            className="cursor-pointer border-none bg-transparent p-0 text-xs text-primary underline"
          >
            {copied ? "Copied!" : "Copy all"}
          </button>
        )}
      </div>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border bg-gray-50 p-2 font-mono text-xs text-gray-900">
          {headers.map((h, i) => (
            <div key={i} className="break-all py-0.5">
              <span className="text-gray-500">{h.key}:</span> {h.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="m-0 text-[11px] text-muted">{label}</dt>
      <dd className="m-0 mt-0.5 truncate text-xs text-gray-900">{value}</dd>
    </div>
  );
}

// UI-SNP-002 Snapshot Detail — a historical, fully-saved record of one 2xx
// Run Execution's actual request/response. Deliberately distinct from
// ExecutionResultView (used for live Run Results): no "Run Again", no
// truncation-in-storage warning (a Snapshot's preview truncation is a
// display cap over fully-stored bytes, not a live-capture loss), and its own
// one-time Invalidate action instead of Run's Skip/Interrupt vocabulary.
//
// Layout favors identity/scanability over the previous flat "Provenance"
// grid: the UUID moves off the title into a small copyable line, a single
// "Snapshot Information" card groups related fields (identity, who/how,
// timing) instead of auto-flowing them through a blind 4-column grid, and
// Request/Response become their own titled cards with headers collapsed by
// default so a long list can't push the body out of view.
export function SnapshotDetailScreen({
  projectId,
  snapshotId,
  accessToken,
  user,
  onBack,
  onViewSourceExecution,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string;
  snapshotId: string;
  accessToken: string | null;
  user: { email: string; role: Role };
  onBack: () => void;
  onViewSourceExecution: (runId: string, executionId: string) => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const { snapshot, loading, error, notFound, refetch } = useSnapshotDetail(
    projectId,
    snapshotId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );
  const [showInvalidateDialog, setShowInvalidateDialog] = useState(false);
  const isAdmin = user.role === "ADMIN";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <button onClick={onBack} className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline">
            Back to Snapshots
          </button>

          <h2 className="m-0 mt-1.5 truncate text-lg font-semibold text-gray-900">
            {snapshot ? (
              <>
                Snapshot ·{" "}
                <span className="font-mono">
                  {snapshot.request.method} {getDisplayPath(snapshot.request.url)}
                </span>
              </>
            ) : (
              "Snapshot"
            )}
          </h2>

          {snapshot && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <SnapshotStatusBadge status={snapshot.snapshotStatus} />
              <span>Saved {formatTimestamp(snapshot.createdAt)}</span>
            </div>
          )}

          <div className="mt-1.5">
            <CopyableText value={snapshotId} className="font-mono text-xs text-muted" />
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
          {snapshot && snapshot.snapshotStatus === "NORMAL" && isAdmin && (
            <Button variant="danger" size="sm" onClick={() => setShowInvalidateDialog(true)}>
              Invalidate
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {loading && <p className="m-0 text-sm text-muted">Loading…</p>}

        {!loading && notFound && <p className="m-0 text-sm text-muted">This Snapshot no longer exists.</p>}

        {!loading && !notFound && error && (
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        )}

        {!loading && snapshot && (
          <>
            <div className="rounded-md border border-border bg-white p-4">
              <h3 className="m-0 mb-3 text-sm font-semibold text-gray-900">Snapshot Information</h3>

              <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
                <InfoField label="API" value={snapshot.apiName} />
                <InfoField label="Environment" value={snapshot.environmentName} />
                <InfoField label="API Version" value={<span className="font-mono">{snapshot.apiVersion || "UNKNOWN"}</span>} />
                <InfoField label="DB Version" value={<span className="font-mono">{snapshot.databaseVersion || "UNKNOWN"}</span>} />
                <InfoField label="Initiated By" value={snapshot.initiatedBy.label} />
                <div className="min-w-0">
                  <dt className="m-0 text-[11px] text-muted">Auth Context</dt>
                  <dd className="m-0 mt-0.5 min-w-0 text-xs text-gray-900">
                    <CopyableText
                      value={snapshot.authContext.label ?? snapshot.authContext.key}
                      display={snapshot.authContext.label ?? `${snapshot.authContext.key.slice(0, 12)}…`}
                    />
                  </dd>
                </div>
                <InfoField
                  label="Source Execution"
                  value={
                    <button
                      onClick={() => onViewSourceExecution(snapshot.runId, snapshot.executionId)}
                      className="cursor-pointer border-none bg-transparent p-0 text-xs text-primary underline"
                    >
                      View source Execution
                    </button>
                  }
                />
                <InfoField label="Duration" value={snapshot.durationMs !== null ? `${snapshot.durationMs} ms` : "—"} />
              </dl>

              <div className="mt-3 border-t border-border pt-2.5">
                <p className="m-0 mb-1 text-[11px] text-muted">Timeline</p>
                <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-900">
                  <span>Requested {formatTimestamp(snapshot.requestedAt)}</span>
                  <span className="text-muted">→</span>
                  <span>Started {formatTimestamp(snapshot.startedAt)}</span>
                  <span className="text-muted">→</span>
                  <span>Completed {formatTimestamp(snapshot.completedAt)}</span>
                </p>
              </div>
            </div>

            {snapshot.invalidation && (
              <div className="rounded-md border border-border bg-gray-50 p-4">
                <h4 className="m-0 mb-1.5 text-xs font-semibold text-gray-900">Invalidated</h4>
                <p className="m-0 text-xs text-gray-900">{snapshot.invalidation.reason}</p>
                <p className="m-0 mt-1 text-xs text-muted">
                  By {snapshot.invalidation.invalidatedBy.label} on {formatTimestamp(snapshot.invalidation.invalidatedAt)}
                </p>
              </div>
            )}

            <div className="rounded-md border border-border bg-white p-4">
              <h3 className="m-0 mb-3 text-sm font-semibold text-gray-900">Request</h3>
              <p className="m-0 mb-2.5 break-all font-mono text-xs text-gray-900">
                <span className="font-semibold">{snapshot.request.method}</span> {snapshot.request.url}
              </p>
              <div className="mb-3">
                <CollapsibleHeaders headers={snapshot.request.headers} />
              </div>
              <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Request body</p>
              <SnapshotBodyView
                projectId={projectId}
                snapshotId={snapshotId}
                accessToken={accessToken}
                bodyPart="request"
                descriptor={snapshot.request.body}
              />
            </div>

            <div className="rounded-md border border-border bg-white p-4">
              <h3 className="m-0 mb-3 text-sm font-semibold text-gray-900">Response</h3>
              <p className="m-0 mb-2.5 font-mono text-xs text-gray-900">
                HTTP {snapshot.response.httpStatus ?? "—"}
                {snapshot.response.body.contentType ? ` · ${snapshot.response.body.contentType}` : ""}
              </p>
              {snapshot.response.httpStatus === 206 && findHeader(snapshot.response.headers, "content-range") && (
                <p className="m-0 mb-2.5 text-xs text-warning">
                  Partial content — Content-Range: {findHeader(snapshot.response.headers, "content-range")}
                </p>
              )}
              <div className="mb-3">
                <CollapsibleHeaders headers={snapshot.response.headers} />
              </div>
              <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Response body</p>
              <SnapshotBodyView
                projectId={projectId}
                snapshotId={snapshotId}
                accessToken={accessToken}
                bodyPart="response"
                descriptor={snapshot.response.body}
              />
            </div>
          </>
        )}
      </div>

      {showInvalidateDialog && snapshot && (
        <InvalidateSnapshotDialog
          projectId={projectId}
          snapshotId={snapshotId}
          accessToken={accessToken}
          onCancel={() => setShowInvalidateDialog(false)}
          onSuccess={() => {
            setShowInvalidateDialog(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
}
