import { useMemo, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { AUTH_TYPE_LABELS } from "./authentication.util";
import type { ApiEnvironmentConfigListItem } from "./apiEnvironment.types";
import { InactiveBanner } from "./InactiveBanner";
import { evaluateEligibility, skipReasonLabel, type SkipReasonCode } from "./run-eligibility.util";
import { createRun } from "./run.api";
import { MAX_BATCH_EXECUTIONS } from "./run.constants";
import type { RunRequestValues } from "./requestInput.types";
import { RunRequestPreviewPanel } from "./RunRequestPreviewPanel";
import { RunRequestValuesPanel } from "./RunRequestValuesPanel";
import { RunVersionMetadataPanel } from "./RunVersionMetadataPanel";
import { useBatchApiContext } from "./useBatchApiContext";
import { useEnvironmentList } from "./useEnvironmentList";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";

const EMPTY_VALUES: RunRequestValues = { pathValues: {}, queryValues: {}, headerValues: {}, bodyValue: "" };

interface ApiEvaluation {
  skip: SkipReasonCode | null;
  runBlockers: string[];
  authTypeLabel: string | null;
  credentialStatus: ApiEnvironmentConfigListItem["credentialStatus"] | null;
}

// Full in-progress state of this screen, handed to the caller when the user
// leaves for Configuration (see onOpenConfiguration) so it can be restored
// via initialDraft when the caller navigates back here — no manual "back"
// click, no modal, nothing lost.
export interface BatchDraftSnapshot {
  apiIds: string[];
  environmentId: string;
  activeApiId: string | null;
  mode: "prepare" | "review";
  valuesByApiId: Record<string, RunRequestValues>;
  apiVersionByApiId: Record<string, string>;
  dbVersionByApiId: Record<string, string>;
}

// UI-RUN-04 — Batch Run Preparation + Review. Left: ordered list of the APIs
// selected on the API List (RS-RUN-001-01), each with a live Execute/Skip
// prediction mirroring the backend's run-eligibility.util.ts. Right: the same
// controlled Request Values / Version Metadata / Request Preview panels Run
// API already uses for Single Run (RS-RUN-009-07,08,14 — per-API×Environment
// version). Review mode is the explicit confirmation gate before Execute
// (DC-01), reached via the header toggle or the "Continue to Review" CTA in
// Prepare mode — Execute itself always stays Review-only. Missing credential
// is shown as a caution, never a Skip prediction — see run-eligibility.util.ts
// for why. "Open Configuration" hands the caller this screen's full draft
// (see BatchDraftSnapshot) so it can be restored via initialDraft when the
// caller navigates back after a Configuration save.
export function BatchRunPreparationScreen({
  projectId,
  projectStatus,
  apiIds,
  environmentId,
  accessToken,
  initialDraft,
  onBack,
  onOpenConfiguration,
  onSessionExpired,
  onAccessDenied,
  onExecuted,
}: {
  projectId: string;
  projectStatus: "ACTIVE" | "INACTIVE";
  apiIds: string[];
  environmentId: string;
  accessToken: string | null;
  initialDraft?: BatchDraftSnapshot | null;
  onBack: () => void;
  onOpenConfiguration: (apiId: string, snapshot: BatchDraftSnapshot) => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
  onExecuted: (runId: string) => void;
}) {
  const projectInactive = projectStatus === "INACTIVE";
  const { environments } = useEnvironmentList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const environment = environments.find((e) => e.environmentId === environmentId) ?? null;
  const environmentInactive = environment?.environmentStatus === "INACTIVE";
  const { contextByApiId, loading, error: contextError } = useBatchApiContext(
    projectId,
    apiIds,
    environmentId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const [activeApiId, setActiveApiId] = useState<string | null>(initialDraft?.activeApiId ?? apiIds[0] ?? null);
  const [mode, setMode] = useState<"prepare" | "review">(initialDraft?.mode ?? "prepare");
  const [valuesByApiId, setValuesByApiId] = useState<Record<string, RunRequestValues>>(initialDraft?.valuesByApiId ?? {});
  const [apiVersionByApiId, setApiVersionByApiId] = useState<Record<string, string>>(initialDraft?.apiVersionByApiId ?? {});
  const [dbVersionByApiId, setDbVersionByApiId] = useState<Record<string, string>>(initialDraft?.dbVersionByApiId ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function valuesFor(apiId: string): RunRequestValues {
    return valuesByApiId[apiId] ?? EMPTY_VALUES;
  }

  const evaluations = useMemo(() => {
    const map: Record<string, ApiEvaluation> = {};
    for (const apiId of apiIds) {
      const ctx = contextByApiId[apiId];
      if (!ctx) continue;
      const skip = evaluateEligibility(ctx.config, ctx.definition, valuesByApiId[apiId] ?? EMPTY_VALUES);
      const credentialStatus = ctx.authConfig?.credentialStatus ?? ctx.config?.credentialStatus ?? null;
      const authTypeLabel = ctx.authConfig ? AUTH_TYPE_LABELS[ctx.authConfig.authType] : null;
      const runBlockers = [
        projectInactive ? "The Project is INACTIVE." : null,
        environmentInactive ? "The Environment is INACTIVE." : null,
        environment && !environment.allowRun ? "Allow Run is OFF for this Environment." : null,
        ctx.config?.urlStatus !== "CONFIGURED" ? "The Full URL is not configured for this Environment." : null,
        credentialStatus === "NOT_CONFIGURED" ? "The credential for the selected Authentication Type is not configured." : null,
      ].filter((reason): reason is string => reason !== null);
      map[apiId] = { skip, runBlockers, authTypeLabel, credentialStatus };
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiIds, contextByApiId, valuesByApiId, projectInactive, environmentInactive, environment]);

  const readyCount = apiIds.filter((id) => evaluations[id]?.skip === null).length;
  const needsInputCount = apiIds.filter((id) => evaluations[id]?.skip === "MISSING_REQUIRED_INPUT").length;
  const blockedCount = apiIds.filter((id) => evaluations[id]?.skip === "MISSING_FULL_URL").length;

  const environmentBlocked = !environment || environmentInactive || !environment.allowRun;
  const canExecute = !projectInactive && !environmentBlocked && !submitting && !loading && !!accessToken;

  async function handleExecute() {
    if (!accessToken || !canExecute) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const run = await createRun(
        projectId,
        {
          runType: "BATCH",
          environmentId,
          executions: apiIds.map((apiId) => {
            const values = valuesFor(apiId);
            const apiVersion = (apiVersionByApiId[apiId] ?? "").trim();
            const databaseVersion = (dbVersionByApiId[apiId] ?? "").trim();
            return {
              apiId,
              requestValues: {
                pathValues: values.pathValues,
                queryValues: values.queryValues,
                headerValues: values.headerValues,
                bodyValue: values.bodyValue,
              },
              apiVersion: apiVersion || undefined,
              databaseVersion: databaseVersion || undefined,
            };
          }),
        },
        accessToken,
      );
      onExecuted(run.runId);
    } catch (err) {
      if (!handleApiError(err)) {
        setSubmitError(err instanceof ApiError ? err.message : "Unable to execute the Batch Run.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const activeCtx = activeApiId ? contextByApiId[activeApiId] : undefined;
  const activeEval = activeApiId ? evaluations[activeApiId] : undefined;

  return (
    <div>
      {projectInactive && <InactiveBanner message="This Project is INACTIVE. A Batch Run cannot be executed until the Project is reactivated." />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <button onClick={onBack} className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline">
            APIs
          </button>
          <h2 className="m-0 mt-1 text-lg font-semibold text-gray-900">Batch Run Preparation</h2>
          <p className="m-0 mt-1 text-xs text-muted">
            {apiIds.length} of {MAX_BATCH_EXECUTIONS} API{apiIds.length === 1 ? "" : "s"} selected — Environment:{" "}
            {environment?.environmentName ?? "…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={mode === "prepare" ? "primary" : "secondary"} size="sm" onClick={() => setMode("prepare")}>
            Prepare
          </Button>
          <Button variant={mode === "review" ? "primary" : "secondary"} size="sm" onClick={() => setMode("review")}>
            Review ({apiIds.length})
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-2.5">
        <Badge tone="success" label={`${readyCount} Ready`} />
        <Badge tone="warning" label={`${needsInputCount} Needs Input`} />
        <Badge tone="danger" label={`${blockedCount} Missing Full URL`} />
        {environmentBlocked && (
          <span className="text-xs text-error">
            {!environment
              ? "Environment not found."
              : environmentInactive
                ? "This Environment is INACTIVE — a Batch Run cannot be executed."
                : "Allow Run is OFF for this Environment — a Batch Run cannot be executed."}
          </span>
        )}
      </div>

      {loading && <p className="m-0 px-6 py-4 text-sm text-muted">Loading API details…</p>}
      {!loading && contextError && <p className="m-0 px-6 py-2 text-xs text-warning">{contextError}</p>}

      {!loading && mode === "prepare" && (
        <>
        <div className="flex flex-col md:flex-row">
          <div className="shrink-0 border-border md:w-72 md:border-r">
            {apiIds.map((apiId) => {
              const ctx = contextByApiId[apiId];
              const evalResult = evaluations[apiId];
              if (!ctx) return null;
              const active = apiId === activeApiId;
              return (
                <button
                  key={apiId}
                  onClick={() => setActiveApiId(apiId)}
                  className={`block w-full cursor-pointer border-none border-b border-border px-3 py-2.5 text-left ${active ? "bg-gray-50" : "bg-white hover:bg-gray-50"}`}
                >
                  <div className="flex items-center gap-1.5">
                    <HttpMethodBadge method={ctx.api.httpMethod} />
                    <span className="truncate font-mono text-xs text-gray-900">{ctx.api.path}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-gray-700">{ctx.api.apiName}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {evalResult?.skip === null && <Badge tone="success" label="Ready" />}
                    {evalResult?.skip === "MISSING_REQUIRED_INPUT" && <Badge tone="warning" label="Needs Input" />}
                    {evalResult?.skip === "MISSING_FULL_URL" && <Badge tone="danger" label="Missing Full URL" />}
                    {evalResult?.skip === null && evalResult.credentialStatus === "NOT_CONFIGURED" && (
                      <span className="text-xs text-warning">No credential</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-5">
            {!activeCtx && <p className="m-0 text-sm text-muted">Select an API on the left.</p>}
            {activeCtx && activeApiId && activeEval && (
              <div className="flex flex-col gap-4">
                <Card>
                  <h3 className="m-0 mb-2 text-base font-semibold text-gray-900">Execution Target</h3>
                  <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-900 sm:grid-cols-3">
                    <div>
                      <dt className="text-muted">Full URL</dt>
                      <dd className="m-0 break-all font-mono">{activeCtx.config?.fullUrl ?? "Not configured"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Authentication</dt>
                      <dd className="m-0">
                        {activeEval.authTypeLabel
                          ? `${activeEval.authTypeLabel} — ${
                              activeEval.credentialStatus === "CONFIGURED"
                                ? "Configured"
                                : activeEval.credentialStatus === "NOT_CONFIGURED"
                                  ? "Not configured"
                                  : "Not required"
                            }`
                          : "Not configured"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Predicted</dt>
                      <dd className="m-0">
                        {activeEval.skip === null ? (
                          <Badge tone="success" label="Execute" />
                        ) : (
                          <Badge tone="warning" label={`Skip — ${skipReasonLabel(activeEval.skip)}`} />
                        )}
                      </dd>
                    </div>
                  </dl>
                  <button
                    onClick={() =>
                      onOpenConfiguration(activeApiId, {
                        apiIds,
                        environmentId,
                        activeApiId,
                        mode,
                        valuesByApiId,
                        apiVersionByApiId,
                        dbVersionByApiId,
                      })
                    }
                    className="mt-3 cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline"
                  >
                    Open Configuration
                  </button>
                </Card>

                <RunRequestValuesPanel
                  definition={activeCtx.definition}
                  values={valuesFor(activeApiId)}
                  onChange={(v) => setValuesByApiId((prev) => ({ ...prev, [activeApiId]: v }))}
                />
                <RunVersionMetadataPanel
                  apiVersion={apiVersionByApiId[activeApiId] ?? ""}
                  dbVersion={dbVersionByApiId[activeApiId] ?? ""}
                  onApiVersionChange={(v) => setApiVersionByApiId((prev) => ({ ...prev, [activeApiId]: v }))}
                  onDbVersionChange={(v) => setDbVersionByApiId((prev) => ({ ...prev, [activeApiId]: v }))}
                />
                <RunRequestPreviewPanel
                  httpMethod={activeCtx.api.httpMethod}
                  fullUrl={activeCtx.config?.fullUrl ?? null}
                  values={valuesFor(activeApiId)}
                  authTypeLabel={activeEval.authTypeLabel}
                  credentialStatus={activeEval.credentialStatus}
                  runBlockers={activeEval.runBlockers}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="m-0 text-xs text-muted">
            Review the predicted Execute/Skip outcome for all {apiIds.length} APIs, then continue when ready.
          </p>
          <Button variant="primary" onClick={() => setMode("review")}>
            Continue to Review ({apiIds.length}) →
          </Button>
        </div>
        </>
      )}

      {!loading && mode === "review" && (
        <div className="p-5">
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Path</th>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Predicted</th>
                  <th className={thClass}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {apiIds.map((apiId) => {
                  const ctx = contextByApiId[apiId];
                  const evalResult = evaluations[apiId];
                  if (!ctx) return null;
                  return (
                    <tr key={apiId} className={trHoverClass}>
                      <td className={tdClass}>
                        <HttpMethodBadge method={ctx.api.httpMethod} />
                      </td>
                      <td className={`${tdClass} font-mono`}>{ctx.api.path}</td>
                      <td className={tdClass}>{ctx.api.apiName}</td>
                      <td className={tdClass}>
                        {evalResult?.skip === null ? <Badge tone="success" label="Execute" /> : <Badge tone="warning" label="Skip" />}
                      </td>
                      <td className={`${tdClass} text-xs text-muted`}>
                        {evalResult?.skip
                          ? skipReasonLabel(evalResult.skip)
                          : evalResult?.credentialStatus === "NOT_CONFIGURED"
                            ? "No credential configured — may fail"
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            {submitError && <p className="m-0 mb-2 text-xs text-error">{submitError}</p>}
            <Button
              variant="primary"
              disabled={!canExecute}
              onClick={() => void handleExecute()}
              title={
                projectInactive
                  ? "The Project is INACTIVE."
                  : environmentBlocked
                    ? "This Environment cannot accept a Run right now."
                    : undefined
              }
            >
              {submitting ? "Executing…" : `Execute Batch (${apiIds.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
