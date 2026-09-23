import type { RunExecutionDetail, RunExecutionListItem } from "./run.types";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { JsonHighlight } from "../../components/ui/JsonHighlight";

// Exported so Run Result's per-execution table can reuse the same
// status/outcome vocabulary instead of redefining it.
export const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "info",
  RUNNING: "info",
  COMPLETED: "success",
  SKIPPED: "warning",
  INTERRUPTED: "danger",
  NOT_EXECUTED: "neutral",
};

export const OUTCOME_TONE: Record<string, BadgeTone> = {
  RESPONSE_RECEIVED: "success",
  RUN_ERROR: "danger",
  SKIPPED: "warning",
};

const UNFINISHED_STATUSES = new Set(["PENDING", "RUNNING"]);

export function formatCode(code: string): string {
  return code.replace(/_/g, " ");
}

function formatJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "UNKNOWN";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

// Group Run — shared Execution Result display (UI-RUN-05) for one
// RunExecution: Overview (status/outcome badges), Metadata, Input (request
// sent) and Output (response/error) sections. Used both inline by Single
// Run's Execute step (RunExecutePanel) and standalone by ExecutionDetailScreen
// and Batch Run Result's per-execution detail (REQ-RUN-008). `running` is
// deliberately derived from execution.executionStatus, not run.runStatus —
// they diverge for Batch children (a whole Batch Run can stay RUNNING while
// one specific execution has already finished, or vice versa).
export function ExecutionResultView({
  execution,
  executionDetail,
  timedOut,
  error,
  onRunAgain,
}: {
  execution: RunExecutionListItem;
  executionDetail: RunExecutionDetail | null;
  timedOut?: boolean;
  error?: string | null;
  onRunAgain?: () => void;
}) {
  const running = UNFINISHED_STATUSES.has(execution.executionStatus);
  const showOutcomeBadge = execution.executionOutcome !== null && execution.executionOutcome !== execution.executionStatus;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[execution.executionStatus] ?? "neutral"} label={formatCode(execution.executionStatus)} />
        {showOutcomeBadge && (
          <Badge tone={OUTCOME_TONE[execution.executionOutcome!] ?? "neutral"} label={formatCode(execution.executionOutcome!)} />
        )}
        {execution.httpStatus !== null && <span className="font-mono text-xs text-gray-900">HTTP {execution.httpStatus}</span>}
        {execution.durationMs !== null && <span className="text-xs text-muted">{execution.durationMs} ms</span>}
      </div>

      {running && <p className="m-0 text-sm text-muted">Running…</p>}
      {timedOut && (
        <p className="m-0 text-xs text-warning">
          Still not finished after a while — the server may be busy. You can keep waiting or check again later from Project Test Runs.
        </p>
      )}
      {execution.executionStatus === "SKIPPED" && execution.skipReasonCode && (
        <p className="m-0 text-xs text-warning">Skipped — {formatCode(execution.skipReasonCode)}</p>
      )}
      {execution.executionStatus === "NOT_EXECUTED" && (
        <p className="m-0 text-xs text-muted">Not executed — the Run was interrupted before this API's turn.</p>
      )}
      {execution.executionStatus === "INTERRUPTED" && (
        <p className="m-0 text-xs text-error">Interrupted — the Run was interrupted while this API was executing.</p>
      )}
      {error && <p className="m-0 text-xs text-error">{error}</p>}

      <div>
        <h4 className="m-0 mb-1.5 text-xs font-semibold text-gray-900">Metadata</h4>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-900 sm:grid-cols-4">
          <div>
            <dt className="text-muted">API Version</dt>
            <dd className="m-0 font-mono">{execution.apiVersion || "UNKNOWN"}</dd>
          </div>
          <div>
            <dt className="text-muted">Database Version</dt>
            <dd className="m-0 font-mono">{execution.databaseVersion || "UNKNOWN"}</dd>
          </div>
          <div>
            <dt className="text-muted">Started</dt>
            <dd className="m-0">{formatTimestamp(execution.startedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted">Ended</dt>
            <dd className="m-0">{formatTimestamp(execution.endedAt)}</dd>
          </div>
        </dl>
      </div>

      {executionDetail?.executionError && (
        <div>
          <p className="m-0 mb-1 text-xs font-semibold text-error">{formatCode(executionDetail.executionError.reasonCode)}</p>
          {executionDetail.executionError.message && <p className="m-0 text-xs text-muted">{executionDetail.executionError.message}</p>}
        </div>
      )}

      {executionDetail?.actualRequest && (
        <div>
          <h4 className="m-0 mb-1 text-xs font-semibold text-gray-900">Request Sent</h4>
          <p className="m-0 break-all font-mono text-xs text-gray-900">
            <span className="font-semibold">{executionDetail.actualRequest.method}</span> {executionDetail.actualRequest.url}
          </p>
          {formatJson(executionDetail.actualRequest.headers) && (
            <pre className="m-0 mt-1.5 whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-900">
              <JsonHighlight value={formatJson(executionDetail.actualRequest.headers)!} />
            </pre>
          )}
          {executionDetail.actualRequest.body && (
            <pre className="m-0 mt-1.5 whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-900">
              <JsonHighlight value={executionDetail.actualRequest.body} />
            </pre>
          )}
        </div>
      )}

      {executionDetail?.httpResponse && (
        <div>
          <h4 className="m-0 mb-1 text-xs font-semibold text-gray-900">Response</h4>
          {formatJson(executionDetail.httpResponse.headers) && (
            <pre className="m-0 mb-1.5 whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-900">
              <JsonHighlight value={formatJson(executionDetail.httpResponse.headers)!} />
            </pre>
          )}
          {executionDetail.httpResponse.bodyKind === "BINARY" ? (
            <p className="m-0 text-xs text-muted">
              Binary response body ({executionDetail.httpResponse.contentType ?? "unknown type"}) — not shown.
            </p>
          ) : executionDetail.httpResponse.body ? (
            <pre className="m-0 whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-900">
              <JsonHighlight value={executionDetail.httpResponse.body} />
            </pre>
          ) : (
            <p className="m-0 text-xs text-muted">Empty response body.</p>
          )}
          {executionDetail.httpResponse.isTruncated && (
            <p className="m-0 mt-1 text-xs text-warning">Response body was truncated in storage.</p>
          )}
        </div>
      )}

      {!running && onRunAgain && (
        <div className="border-t border-border pt-3">
          <Button variant="secondary" onClick={onRunAgain}>
            Run Again
          </Button>
        </div>
      )}
    </div>
  );
}
