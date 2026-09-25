import { useExecutionDetail } from "./useExecutionDetail";
import { ExecutionResultView } from "./ExecutionResultView";
import { Button } from "../../components/ui/Button";

// UI-RUN-05 standalone Execution Detail screen, reached from Run Result's
// per-execution "View" link. Same ExecutionResultView the Single Run Execute
// step uses inline (REQ-SEC-002 — only the backend's own redacted trace is
// ever shown). "Run Again" is deliberately not offered here: re-executing
// would need to reconstruct the original Request Values, which is out of
// this screen's scope — Back and Refresh are enough.
export function ExecutionDetailScreen({
  projectId,
  runId,
  executionId,
  accessToken,
  onBack,
  onViewSnapshot,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string;
  runId: string;
  executionId: string;
  accessToken: string | null;
  onBack: () => void;
  onViewSnapshot?: (snapshotId: string) => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const { execution, executionDetail, loading, timedOut, error, refetch } = useExecutionDetail(
    projectId,
    runId,
    executionId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <button onClick={onBack} className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline">
            Back
          </button>
          <h2 className="m-0 mt-1 text-lg font-semibold text-gray-900">Execution Detail</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="p-5">
        {loading && <p className="m-0 text-sm text-muted">Loading…</p>}
        {!loading && !execution && <p className="m-0 text-sm text-muted">{error ?? "Execution not found."}</p>}
        {!loading && execution && (
          <ExecutionResultView
            execution={execution}
            executionDetail={executionDetail}
            timedOut={timedOut}
            error={error}
            onViewSnapshot={onViewSnapshot}
          />
        )}
      </div>
    </div>
  );
}
