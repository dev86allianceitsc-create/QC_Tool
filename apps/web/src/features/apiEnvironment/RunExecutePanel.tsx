import type { RunRequestValues } from "./requestInput.types";
import type { UseSingleRunExecutionResult } from "./useSingleRunExecution";
import { buildPreviewUrl } from "./runApi.util";
import { validateVersion } from "./version.util";
import { ExecutionResultView } from "./ExecutionResultView";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

// Group Run — real Single Run execution. Sends the values already staged in
// the earlier wizard steps to the backend via useSingleRunExecution, then
// shows exactly what the backend recorded: its own redacted actual request
// and stored response. No secret value is ever requested or shown here
// (REQ-SEC-002) — only the already-masked trace the API returns.
export function RunExecutePanel({
  httpMethod,
  fullUrl,
  values,
  apiVersion,
  dbVersion,
  runBlockers,
  runExecution,
}: {
  httpMethod: string;
  fullUrl: string | null;
  values: RunRequestValues;
  apiVersion: string;
  dbVersion: string;
  runBlockers: string[];
  runExecution: UseSingleRunExecutionResult;
}) {
  const { run, executionDetail, executing, timedOut, error, execute, reset } = runExecution;
  const previewUrl = buildPreviewUrl(fullUrl, values.pathValues, values.queryValues);
  const versionError = validateVersion(apiVersion, "API Version") ?? validateVersion(dbVersion, "Database Version");
  const canExecute = runBlockers.length === 0 && !!previewUrl && !versionError && !executing;
  const execution = run?.executions[0] ?? null;

  return (
    <Card>
      <h3 className="m-0 mb-2 text-base font-semibold text-gray-900">Execute</h3>

      {!run && (
        <>
          <p className="m-0 mb-3 text-sm text-muted">
            Sends this Run to the API now. The actual request and response are recorded and shown below once it finishes.
          </p>
          {previewUrl && (
            <p className="m-0 mb-3 break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-900">
              <span className="font-semibold">{httpMethod}</span> {previewUrl}
            </p>
          )}
          <Button
            variant="primary"
            disabled={!canExecute}
            onClick={() => void execute(values, apiVersion, dbVersion)}
            title={runBlockers.length > 0 ? runBlockers[0] : (versionError ?? undefined)}
          >
            {executing ? "Executing…" : "Execute"}
          </Button>
          {versionError && <p className="m-0 mt-2 text-xs text-error">{versionError}</p>}
          {error && <p className="m-0 mt-2 text-xs text-error">{error}</p>}
          {runBlockers.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="m-0 mb-1 text-xs font-semibold text-gray-900">A Run cannot proceed yet:</p>
              <ul className="m-0 list-disc pl-5 text-xs text-muted">
                {runBlockers.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {run && execution && (
        <ExecutionResultView execution={execution} executionDetail={executionDetail} timedOut={timedOut} error={error} onRunAgain={reset} />
      )}
    </Card>
  );
}
