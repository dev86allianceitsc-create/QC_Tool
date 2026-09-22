import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../services/api-client";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import type { Role } from "../projects/projects.types";
import { AUTH_TYPE_LABELS } from "./authentication.util";
import { ConfigurationArea } from "./ConfigurationArea";
import { CreateEditApiModal } from "./CreateEditApiModal";
import { InactiveBanner } from "./InactiveBanner";
import { RunApiArea } from "./RunApiArea";
import { useApiDetail } from "./useApiDetail";
import { useApiEnvironmentConfigs } from "./useApiEnvironmentConfigs";
import { useAuthentication } from "./useAuthentication";
import { useEnvironmentList } from "./useEnvironmentList";
import { useRequestInput } from "./useRequestInput";
import { Button } from "../../components/ui/Button";
import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge";
import type { StepReadiness } from "../../components/ui/StepSidebar";

type ApiWorkspaceArea = "configuration" | "run";

// REVISION 3C-R01 — Separate Configuration & Run API. This screen is now a
// thin shell: header (breadcrumb, Method/Path, Environment selector, Run API
// nav button, Edit/Delete) plus the two areas below it. All data fetching
// and the unsaved-changes guard stay here so state survives switching
// between areas; ConfigurationArea/RunApiArea only render their own step
// content from props — the underlying hooks/components (useRequestInput,
// useApiEnvironmentConfigs, useAuthentication, RequestInputTab,
// AuthenticationTab) are unchanged. The header "Run API" button only
// navigates to the Run API area — it never executes a request.
export function ApiDetailScreen({
  user,
  projectId,
  projectStatus,
  apiId,
  accessToken,
  onBack,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  projectId: string;
  projectStatus: "ACTIVE" | "INACTIVE";
  apiId: string;
  accessToken: string | null;
  onBack: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const projectInactive = projectStatus === "INACTIVE";

  const { api, loading, error, refetch, updateApi, deleteApi } = useApiDetail(projectId, apiId, accessToken, onSessionExpired, onAccessDenied);
  const { environments } = useEnvironmentList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const { configs, loading: configsLoading, putConfig, refetch: refetchConfigs } = useApiEnvironmentConfigs(projectId, apiId, accessToken, onSessionExpired, onAccessDenied);
  const requestInput = useRequestInput(projectId, apiId, accessToken, onSessionExpired, onAccessDenied);

  const [area, setArea] = useState<ApiWorkspaceArea>("configuration");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState<Record<string, string>>({});
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [requestInputDirty, setRequestInputDirty] = useState(false);
  const [authenticationDirty, setAuthenticationDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const authentication = useAuthentication(projectId, apiId, selectedEnvironmentId, accessToken, onSessionExpired, onAccessDenied);

  // INACTIVE Environments are not a valid Execution Target: an Admin
  // reactivates them from the Environments list, not from this per-API
  // screen, so here they must be neither shown nor selectable. Everything
  // in this screen that picks or lists "the Environments for this API"
  // reads activeEnvironments, never the raw fetch result.
  const activeEnvironments = useMemo(() => environments.filter((e) => e.environmentStatus === "ACTIVE"), [environments]);

  useEffect(() => {
    if (activeEnvironments.length === 0) return;
    const stillActive = activeEnvironments.some((e) => e.environmentId === selectedEnvironmentId);
    if (!stillActive) {
      setSelectedEnvironmentId(activeEnvironments[0].environmentId);
    }
  }, [activeEnvironments, selectedEnvironmentId]);

  if (loading) {
    return (
      <div className="p-5">
        <p>Loading API...</p>
      </div>
    );
  }

  if (error || !api) {
    return (
      <div className="p-5">
        <p className="text-error">{error ?? "API not found."}</p>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button variant="secondary" onClick={onBack}>
            ← APIs
          </Button>
        </div>
      </div>
    );
  }

  const currentApi = api;
  const selectedEnvironment = activeEnvironments.find((e) => e.environmentId === selectedEnvironmentId) ?? null;
  const config = selectedEnvironment ? configs.find((c) => c.environmentId === selectedEnvironment.environmentId) ?? null : null;
  const environmentInactive = selectedEnvironment?.environmentStatus === "INACTIVE";
  const readOnlyConfig = projectInactive || environmentInactive;
  const canRun = !!requestInput.definition && activeEnvironments.length > 0;

  // UX-01: switching area/step (or, for Authentication, switching
  // Environment) away from an unsaved draft would silently drop it (Full URL
  // drafts live in this screen's own state and survive navigation, so they
  // need no such guard). No reusable "unsaved changes" mechanism exists
  // elsewhere in the app yet, so this guard is scoped to this screen's own
  // internal navigation only.
  function guardedNavigate(action: () => void) {
    if (requestInputDirty || authenticationDirty) {
      setPendingNav(() => action);
    } else {
      action();
    }
  }

  function confirmPendingNav() {
    pendingNav?.();
    setPendingNav(null);
  }

  async function handleSaveEdit(input: { apiName: string; httpMethod: string; path: string; description: string | null }) {
    setSaving(true);
    setEditError(null);
    try {
      await updateApi(input);
      setShowEditModal(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Unable to save API.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteApi();
      setShowDeleteConfirm(false);
      onBack();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Unable to delete API.");
    }
  }

  // The Environment-config list carries its own credentialStatus (derived
  // server-side from the same Authentication Configuration rows), and it
  // feeds the step readiness badges and the Execution Target readiness card.
  // It is fetched once per API, so every Authentication mutation has to
  // refresh it or those places keep showing the pre-mutation status.
  async function withConfigRefresh<T>(mutate: () => Promise<T>): Promise<T> {
    const result = await mutate();
    await refetchConfigs();
    return result;
  }

  async function handleSaveUrl() {
    if (!selectedEnvironment) return;
    const value = urlDraft[selectedEnvironment.environmentId] ?? config?.fullUrl ?? "";
    setSavingUrl(true);
    setUrlError(null);
    try {
      await putConfig(selectedEnvironment.environmentId, value.trim());
    } catch (err) {
      setUrlError(err instanceof ApiError ? err.message : "Unable to save Full URL.");
    } finally {
      setSavingUrl(false);
    }
  }

  const requestInputHasData =
    !!requestInput.definition &&
    (requestInput.definition.pathParameters.length > 0 ||
      requestInput.definition.queryParameters.length > 0 ||
      requestInput.definition.headerParameters.length > 0 ||
      requestInput.definition.requestBody !== null);
  // "not_configured" (not "not required") — an empty Request Input has no
  // backing business rule saying the API needs no input; it may simply not
  // be filled in yet, so the badge must not claim more than that fact.
  const requestInputReadiness: StepReadiness | undefined = requestInput.definition ? (requestInputHasData ? "configured" : "not_configured") : undefined;

  const executionTargetReadiness: StepReadiness =
    activeEnvironments.length === 0 ? "not_available" : config?.urlStatus === "CONFIGURED" ? "configured" : "needs_attention";

  // CL-3C-01: only an Admin may change the Authentication Type, the Login
  // metadata or the credential; Users see the same safe metadata and status
  // read-only. Project/Environment INACTIVE freezes it for everyone. The
  // reason is stated so a disabled form never looks broken.
  const authenticationReadOnlyReason = !isAdmin
    ? "Only an Admin can change the Authentication Type or credential for this API in this Environment."
    : projectInactive
      ? "This Project is INACTIVE — Authentication is view-only until the Project is reactivated."
      : environmentInactive
        ? "This Environment is INACTIVE — Authentication is view-only until the Environment is reactivated."
        : undefined;

  // Both the Authentication step (per-Environment fetch) and the Environment
  // config list carry credentialStatus. Once the step has loaded the live
  // configuration for the selected Environment it is the fresher of the
  // two, so readiness and the Execution Target card prefer it.
  const liveAuthConfig =
    authentication.config && authentication.config.environmentId === selectedEnvironmentId ? authentication.config : null;
  const credentialStatus = liveAuthConfig?.credentialStatus ?? config?.credentialStatus ?? null;
  const authTypeLabel = liveAuthConfig ? AUTH_TYPE_LABELS[liveAuthConfig.authType] : null;

  // credentialStatus already collapses NONE→NOT_REQUIRED at the backend, so
  // "configured" covers both "no credential needed" and "credential set";
  // "needs_attention" is only the transient state before configs load.
  const authenticationReadiness: StepReadiness =
    activeEnvironments.length === 0
      ? "not_available"
      : !credentialStatus
        ? "needs_attention"
        : credentialStatus === "NOT_CONFIGURED"
          ? "not_configured"
          : "configured";

  // UI-RUN-01: the concrete reasons a Run could not be started for the
  // selected Environment. Run execution itself is out of 3C scope — this
  // only reports readiness, it never attempts a request.
  const runBlockers: string[] = selectedEnvironment
    ? [
        projectInactive ? "The Project is INACTIVE." : null,
        environmentInactive ? "The Environment is INACTIVE." : null,
        !selectedEnvironment.allowRun ? "Allow Run is OFF for this Environment." : null,
        config?.urlStatus !== "CONFIGURED" ? "The Full URL is not configured for this Environment." : null,
        credentialStatus === "NOT_CONFIGURED" ? "The credential for the selected Authentication Type is not configured." : null,
      ].filter((reason): reason is string => reason !== null)
    : [];

  return (
    <div>
      {projectInactive && <InactiveBanner message="This Project is INACTIVE. This API is view-only until the Project is reactivated." />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="text-xs text-muted">
            <button onClick={onBack} className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline">
              APIs
            </button>
            <span className="mx-1.5">/</span>
            <span className="text-gray-900">{currentApi.apiName}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <HttpMethodBadge method={currentApi.httpMethod} />
            <span className="font-mono text-sm text-gray-900">{currentApi.path}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeEnvironments.length > 0 && (
            <select
              aria-label="Environment"
              value={selectedEnvironmentId ?? ""}
              onChange={(e) => {
                const nextEnvironmentId = e.target.value;
                guardedNavigate(() => setSelectedEnvironmentId(nextEnvironmentId));
              }}
              className="rounded-md border border-border px-2.5 py-1.5 text-sm text-gray-900"
            >
              {activeEnvironments.map((env) => (
                <option key={env.environmentId} value={env.environmentId}>
                  {env.environmentName}
                </option>
              ))}
            </select>
          )}
          {!projectInactive && (
            <>
              {area === "run" ? (
                <Button variant="secondary" onClick={() => guardedNavigate(() => setArea("configuration"))}>
                  ← Configuration
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => guardedNavigate(() => setArea("run"))}
                  disabled={!canRun}
                  title="Run execution is not part of this release — this opens Run API to prepare values manually."
                >
                  Run API
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setEditError(null);
                  setShowEditModal(true);
                }}
              >
                Edit
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeleteError(null);
                    setShowDeleteConfirm(true);
                  }}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {area === "configuration" && (
        <ConfigurationArea
          currentApi={currentApi}
          environments={activeEnvironments}
          selectedEnvironment={selectedEnvironment}
          environmentInactive={environmentInactive}
          config={config}
          configsLoading={configsLoading}
          readOnlyConfig={readOnlyConfig}
          urlDraft={urlDraft}
          onUrlDraftChange={(environmentId, value) => setUrlDraft((prev) => ({ ...prev, [environmentId]: value }))}
          savingUrl={savingUrl}
          urlError={urlError}
          onSaveUrl={() => void handleSaveUrl()}
          requestInput={requestInput}
          projectInactive={projectInactive}
          requestInputReadiness={requestInputReadiness}
          onRequestInputDirtyChange={setRequestInputDirty}
          apiId={apiId}
          authentication={{
            config: authentication.config,
            loading: authentication.loading,
            error: authentication.error,
            saving: authentication.saving,
            refetch: authentication.refetch,
            saveConfiguration: (payload) => withConfigRefresh(() => authentication.saveConfiguration(payload)),
            saveCredential: (payload) => withConfigRefresh(() => authentication.saveCredential(payload)),
            removeCredential: () => withConfigRefresh(() => authentication.removeCredential()),
          }}
          selectedEnvironmentId={selectedEnvironmentId}
          isAdmin={isAdmin}
          authenticationReadOnlyReason={authenticationReadOnlyReason}
          authenticationReadiness={authenticationReadiness}
          onAuthenticationDirtyChange={setAuthenticationDirty}
          guardedNavigate={guardedNavigate}
        />
      )}

      {area === "run" && (
        <RunApiArea
          httpMethod={currentApi.httpMethod}
          environments={activeEnvironments}
          selectedEnvironmentId={selectedEnvironmentId}
          onSelectEnvironment={(environmentId) => guardedNavigate(() => setSelectedEnvironmentId(environmentId))}
          config={config}
          configsLoading={configsLoading}
          executionTargetReadiness={executionTargetReadiness}
          requestInputDefinition={requestInput.definition}
          authTypeLabel={authTypeLabel}
          credentialStatus={credentialStatus}
          runBlockers={runBlockers}
        />
      )}

      {showEditModal && (
        <CreateEditApiModal
          editing={currentApi}
          saving={saving}
          error={editError}
          onSave={(input) => void handleSaveEdit(input)}
          onCancel={() => setShowEditModal(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete API"
          message={
            `This will delete "${currentApi.apiName}" (${currentApi.httpMethod} ${currentApi.path}). It will no longer appear in the API list, but its historical Run/Snapshot/Comparison data will be retained.` +
            (deleteError ? `\n${deleteError}` : "")
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {pendingNav && (
        <ConfirmDialog
          title="Unsaved changes"
          message="You have unsaved changes on this step. Leave and discard them?"
          confirmLabel="Leave"
          danger
          onConfirm={confirmPendingNav}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  );
}
