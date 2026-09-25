import { Button } from "../../components/ui/Button";
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView";
import { formatSnapshotShortId } from "./snapshot-id.util";
import { SnapshotStatusBadge } from "./SnapshotStatusBadge";
import { useSnapshotDetail } from "./useSnapshotDetail";

// Right-hand "Selected Snapshot" summary panel — a compact pointer to
// whichever row is selected in SnapshotHistoryScreen's left accordion, not a
// second detail view. The API accordion is this screen's primary subject
// (~2/3 width), so this panel is deliberately narrow and limited to
// identity plus a few key fields; full request/response and saved body data
// live on SnapshotDetailScreen behind "View Snapshot Detail" instead of
// being duplicated here. Kept as its own component (own useSnapshotDetail
// fetch) so switching the selected row doesn't need to thread detail state
// back up through the list screen.
export function SnapshotSelectedPanel({
  projectId,
  snapshotId,
  accessToken,
  onViewSnapshot,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string;
  snapshotId: string | null;
  accessToken: string | null;
  onViewSnapshot: (snapshotId: string) => void;
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

  if (snapshotId === null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-dashed border-border p-6">
        <p className="m-0 text-sm text-muted">Select a Snapshot to see its summary.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-white p-4">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">Selected Snapshot</h3>

      {loading && <p className="m-0 mt-3 text-sm text-muted">Loading…</p>}

      {!loading && notFound && <p className="m-0 mt-3 text-sm text-muted">This Snapshot no longer exists.</p>}

      {!loading && !notFound && error && (
        <div className="mt-3 flex flex-col items-start gap-2">
          <p className="m-0 text-sm text-error">{error}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !notFound && !error && snapshot && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-gray-900" title={snapshot.snapshotId}>
              {formatSnapshotShortId(snapshot.snapshotId)}
            </span>
            <SnapshotStatusBadge status={snapshot.snapshotStatus} />
          </div>
          <p className="m-0 text-xs text-muted">Created {formatTimestamp(snapshot.createdAt)}</p>

          <dl className="m-0 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">Environment</dt>
              <dd className="m-0 truncate text-right text-gray-900">{snapshot.environmentName}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">API Version</dt>
              <dd className="m-0 truncate text-right font-mono text-gray-900">{snapshot.apiVersion}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">DB Version</dt>
              <dd className="m-0 truncate text-right font-mono text-gray-900">{snapshot.databaseVersion}</dd>
            </div>
          </dl>

          <button
            onClick={() => onViewSnapshot(snapshot.snapshotId)}
            className="mt-1 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            View Snapshot Detail
          </button>
        </div>
      )}
    </div>
  );
}
