import { useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import { StatusBadge } from "../projects/StatusBadge";
import type { Role } from "../projects/projects.types";
import { AuthenticationTab } from "./AuthenticationTab";
import { ClassificationBadge } from "./ClassificationBadge";
import { CreateEditApiModal } from "./CreateEditApiModal";
import { InactiveBanner } from "./InactiveBanner";
import { RequestInputTab } from "./RequestInputTab";
import { RunRequestPanel } from "./RunRequestPanel";
import { useApiDetail } from "./useApiDetail";
import { useApiEnvironmentConfigs } from "./useApiEnvironmentConfigs";
import { useAuthentication } from "./useAuthentication";
import { useEnvironmentList } from "./useEnvironmentList";
import { useRequestInput } from "./useRequestInput";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge";
import { StepSidebar, type StepReadiness, type StepSidebarItem } from "../../components/ui/StepSidebar";

type ApiDetailTab = "endpoint" | "requestInput" | "authentication" | "reviewRun";

const STEP_ORDER: ApiDetailTab[] = ["endpoint", "requestInput", "authentication", "reviewRun"];

// UI-API-06 (Endpoint) + UI-APIENV-01 (per-Environment Full URL + Credential
// boundary), restructured into the handoff's guided-step order: Endpoint →
// Request Input → Authentication → Review & Run. Every step stays directly
// reachable (not a locked wizard) — this is presentation/navigation only,
// the underlying hooks/components (useRequestInput, useApiEnvironmentConfigs,
// useAuthentication, RunRequestPanel) are unchanged. Allow Run itself is
// only mutated from EnvironmentListScreen (REQ-ENV-003 scopes that mutation
// to the Environment, not the API) — here it is read-only context alongside
// the Environment's Classification/Status. Project-level Header/tabs live in
// ProjectLayout; this screen only adds an "APIs / {api}" breadcrumb back to
// the API List. Step readiness badges are derived only from real fields
// (requestInput contents, urlStatus, credentialStatus, environments.length)
// — never invented UI-only rules.
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
  const { configs, loading: configsLoading, putConfig } = useApiEnvironmentConfigs(projectId, apiId, accessToken, onSessionExpired, onAccessDenied);
  const requestInput = useRequestInput(projectId, apiId, accessToken, onSessionExpired, onAccessDenied);

  const [activeTab, setActiveTab] = useState<ApiDetailTab>("endpoint");
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

  useEffect(() => {
    if (!selectedEnvironmentId && environments.length > 0) {
      setSelectedEnvironmentId(environments[0].environmentId);
    }
  }, [environments, selectedEnvironmentId]);

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
  const selectedEnvironment = environments.find((e) => e.environmentId === selectedEnvironmentId) ?? null;
  const config = selectedEnvironment ? configs.find((c) => c.environmentId === selectedEnvironment.environmentId) ?? null : null;
  const environmentInactive = selectedEnvironment?.environmentStatus === "INACTIVE";
  const readOnlyConfig = projectInactive || environmentInactive;
  const canRun = !!requestInput.definition && environments.length > 0;

  // UX-01: switching step/tab (or, for Authentication, switching Environment)
  // away from an unsaved draft would silently drop it (Full URL drafts live
  // in this screen's own state and survive tab switches, so they need no
  // such guard). No reusable "unsaved changes" mechanism exists elsewhere in
  // the app yet, so this guard is scoped to this screen's own internal
  // navigation only.
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

  const reviewRunReadiness: StepReadiness =
    environments.length === 0 ? "not_available" : config?.urlStatus === "CONFIGURED" ? "configured" : "needs_attention";

  // credentialStatus already collapses NONE→NOT_REQUIRED at the backend, so
  // "configured" covers both "no credential needed" and "credential set";
  // "needs_attention" is only the transient state before configs load.
  const authenticationReadiness: StepReadiness =
    environments.length === 0
      ? "not_available"
      : !config
        ? "needs_attention"
        : config.credentialStatus === "NOT_CONFIGURED"
          ? "not_configured"
          : "configured";

  const steps: StepSidebarItem[] = [
    { key: "endpoint", label: "Endpoint", description: "Method, path, and description." },
    { key: "requestInput", label: "Request Input", description: "Path, Query, Header parameters and Body.", readiness: requestInputReadiness },
    { key: "authentication", label: "Authentication", description: "Credential configuration.", readiness: authenticationReadiness },
    { key: "reviewRun", label: "Review & Run", description: "Execution target and manual Run values.", readiness: reviewRunReadiness },
  ];

  const currentIndex = STEP_ORDER.indexOf(activeTab);

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
          {environments.length > 0 && (
            <select
              aria-label="Environment"
              value={selectedEnvironmentId ?? ""}
              onChange={(e) => {
                const nextEnvironmentId = e.target.value;
                guardedNavigate(() => setSelectedEnvironmentId(nextEnvironmentId));
              }}
              className="rounded-md border border-border px-2.5 py-1.5 text-sm text-gray-900"
            >
              {environments.map((env) => (
                <option key={env.environmentId} value={env.environmentId}>
                  {env.environmentName}
                </option>
              ))}
            </select>
          )}
          {!projectInactive && (
            <>
              <Button
                variant="primary"
                onClick={() => guardedNavigate(() => setActiveTab("reviewRun"))}
                disabled={!canRun}
                title="Run execution is not part of this release — this opens Review & Run to prepare values manually."
              >
                Run API
              </Button>
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

      <div className="flex flex-col gap-6 p-6 md:flex-row">
        <StepSidebar
          ariaLabel="API Workspace steps"
          steps={steps}
          activeKey={activeTab}
          onSelect={(key) => guardedNavigate(() => setActiveTab(key as ApiDetailTab))}
        />

        <div className="min-w-0 flex-1">
          {activeTab === "endpoint" && (
            <Card>
              <h3 className="m-0 text-base font-semibold text-gray-900">{currentApi.apiName}</h3>
              <p className="mt-2.5 font-mono text-sm text-gray-900">
                <span className="font-semibold">{currentApi.httpMethod}</span> {currentApi.path}
              </p>
              <p className="mt-2.5 text-sm text-muted">{currentApi.description || "No description provided."}</p>
            </Card>
          )}

          {activeTab === "requestInput" && requestInput.loading && (
            <Card>
              <p className="m-0">Loading Request Input...</p>
            </Card>
          )}

          {activeTab === "requestInput" && !requestInput.loading && requestInput.error && (
            <Card>
              <p className="text-error">{requestInput.error}</p>
              <Button variant="secondary" onClick={() => void requestInput.refetch()}>
                Retry
              </Button>
            </Card>
          )}

          {activeTab === "requestInput" && !requestInput.loading && !requestInput.error && requestInput.definition && (
            <RequestInputTab
              key={apiId}
              definition={requestInput.definition}
              readOnly={projectInactive}
              saving={requestInput.saving}
              onSave={requestInput.save}
              onDirtyChange={setRequestInputDirty}
            />
          )}

          {activeTab === "authentication" && environments.length === 0 && (
            <Card>
              <p className="m-0 text-sm text-muted">No Environments exist for this API yet. Add an Environment to configure Authentication.</p>
            </Card>
          )}

          {activeTab === "authentication" && environments.length > 0 && authentication.loading && (
            <Card>
              <p className="m-0">Loading Authentication...</p>
            </Card>
          )}

          {activeTab === "authentication" && environments.length > 0 && !authentication.loading && authentication.error && (
            <Card>
              <p className="text-error">{authentication.error}</p>
              <Button variant="secondary" onClick={() => void authentication.refetch()}>
                Retry
              </Button>
            </Card>
          )}

          {activeTab === "authentication" && environments.length > 0 && !authentication.loading && !authentication.error && authentication.config && (
            <AuthenticationTab
              key={`${apiId}:${selectedEnvironmentId}`}
              config={authentication.config}
              readOnly={!isAdmin || readOnlyConfig}
              saving={authentication.saving}
              onSaveConfiguration={authentication.saveConfiguration}
              onSaveCredential={authentication.saveCredential}
              onRemoveCredential={authentication.removeCredential}
              onDirtyChange={setAuthenticationDirty}
            />
          )}

          {activeTab === "reviewRun" && (
            <div className="flex flex-col gap-5 lg:flex-row">
              <div className="w-full shrink-0 lg:w-48">
                <h4 className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Execution Target</h4>
                <p className="mb-2 text-xs text-muted">
                  {environments.length} Environment{environments.length === 1 ? "" : "s"} in this Project
                </p>
                <ol className="flex flex-col gap-1">
                  {environments.map((env) => (
                    <li key={env.environmentId}>
                      <button
                        onClick={() => guardedNavigate(() => setSelectedEnvironmentId(env.environmentId))}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          env.environmentId === selectedEnvironmentId ? "bg-primary-light font-semibold text-gray-900" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="block">{env.environmentName}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted">
                          <span className={`h-1.5 w-1.5 rounded-full ${env.environmentStatus === "ACTIVE" ? "bg-success" : "bg-gray-300"}`} />
                          {env.environmentStatus === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="min-w-0 flex-1">
                {selectedEnvironment && !configsLoading && (
                  <>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="m-0 text-sm font-semibold text-gray-900">{selectedEnvironment.environmentName}</h4>
                      <ClassificationBadge classification={selectedEnvironment.classification} />
                      <StatusBadge status={selectedEnvironment.environmentStatus} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">Allow Run: {selectedEnvironment.allowRun ? "ON" : "OFF"} (managed from the Environments list)</p>
                    {environmentInactive && <p className="text-xs text-muted">This Environment is INACTIVE — URL and Credential are view-only.</p>}

                    <Card className="mt-4">
                      <span className="mb-1.5 block text-xs font-semibold text-gray-900">Full URL</span>
                      <input
                        type="text"
                        value={urlDraft[selectedEnvironment.environmentId] ?? config?.fullUrl ?? ""}
                        onChange={(e) => setUrlDraft((prev) => ({ ...prev, [selectedEnvironment.environmentId]: e.target.value }))}
                        disabled={readOnlyConfig}
                        placeholder="https://example.com/api/..."
                        className="w-full rounded-md border border-border px-3 py-2 text-sm font-mono text-gray-900 disabled:bg-gray-50 disabled:text-muted"
                      />
                      {!config?.fullUrl && <p className="mt-1.5 text-xs text-warning">No URL configured — Run is blocked for this API in this Environment.</p>}
                      {urlError && <p className="mt-1.5 text-xs text-error">{urlError}</p>}
                      {!readOnlyConfig && (
                        <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => void handleSaveUrl()} disabled={savingUrl}>
                          {savingUrl ? "Saving..." : "Save URL"}
                        </Button>
                      )}
                    </Card>

                    <Card className="mt-4">
                      <h4 className="m-0 mb-2.5 text-sm font-semibold text-gray-900">Configuration Readiness — {selectedEnvironment.environmentName}</h4>
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Environment Status</span>
                          <Badge tone={selectedEnvironment.environmentStatus === "ACTIVE" ? "success" : "neutral"} label={selectedEnvironment.environmentStatus === "ACTIVE" ? "Active" : "Inactive"} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Allow Run</span>
                          <Badge tone={selectedEnvironment.allowRun ? "success" : "neutral"} label={selectedEnvironment.allowRun ? "ON" : "OFF"} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">URL</span>
                          <Badge tone={config?.urlStatus === "CONFIGURED" ? "success" : "warning"} label={config?.urlStatus === "CONFIGURED" ? "Configured" : "Not Configured"} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Credential</span>
                          <Badge
                            tone={config?.credentialStatus === "CONFIGURED" ? "success" : config?.credentialStatus === "NOT_CONFIGURED" ? "warning" : "neutral"}
                            label={config?.credentialStatus === "CONFIGURED" ? "Configured" : config?.credentialStatus === "NOT_CONFIGURED" ? "Not Configured" : "Not Required"}
                          />
                        </div>
                      </div>
                    </Card>

                    {requestInput.definition && (
                      <div className="mt-4">
                        <RunRequestPanel
                          variant="inline"
                          definition={requestInput.definition}
                          environments={environments}
                          selectedEnvironmentId={selectedEnvironmentId}
                          onSelectEnvironment={setSelectedEnvironmentId}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between border-t border-border pt-4">
            <Button variant="secondary" onClick={() => guardedNavigate(() => setActiveTab(STEP_ORDER[currentIndex - 1]))} disabled={currentIndex <= 0}>
              ← Back
            </Button>
            <Button
              variant="secondary"
              onClick={() => guardedNavigate(() => setActiveTab(STEP_ORDER[currentIndex + 1]))}
              disabled={currentIndex >= STEP_ORDER.length - 1}
            >
              Next →
            </Button>
          </div>
        </div>
      </div>

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
