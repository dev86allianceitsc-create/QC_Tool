import { useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import { StatusBadge } from "../projects/StatusBadge";
import type { Role } from "../projects/projects.types";
import { ClassificationBadge } from "./ClassificationBadge";
import { CreateEditApiModal } from "./CreateEditApiModal";
import { CredentialSection } from "./CredentialSection";
import { InactiveBanner } from "./InactiveBanner";
import { RequestInputTab } from "./RequestInputTab";
import { RunRequestPanel } from "./RunRequestPanel";
import { useApiDetail } from "./useApiDetail";
import { useApiEnvironmentConfigs } from "./useApiEnvironmentConfigs";
import { useEnvironmentList } from "./useEnvironmentList";
import { useRequestInput } from "./useRequestInput";

const TAB_LABELS: Record<"overview" | "requestInput" | "environments", string> = {
  overview: "Overview",
  requestInput: "Request Input",
  environments: "Environments",
};

// UI-API-06 (Overview) + UI-APIENV-01 (per-Environment Full URL + Credential
// boundary). Allow Run itself is only mutated from EnvironmentListScreen
// (REQ-ENV-003 scopes that mutation to the Environment, not the API) — here
// it is read-only context alongside the Environment's Classification/Status.
// Project-level Header/tabs live in ProjectLayout; this screen only adds an
// "APIs / {api}" breadcrumb back to the API List.
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

  const [activeTab, setActiveTab] = useState<"overview" | "requestInput" | "environments">("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState<Record<string, string>>({});
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [runPanelOpen, setRunPanelOpen] = useState(false);

  useEffect(() => {
    if (!selectedEnvironmentId && environments.length > 0) {
      setSelectedEnvironmentId(environments[0].environmentId);
    }
  }, [environments, selectedEnvironmentId]);

  if (loading) {
    return (
      <div style={{ padding: "20px" }}>
        <p>Loading API...</p>
      </div>
    );
  }

  if (error || !api) {
    return (
      <div style={{ padding: "20px" }}>
        <p style={{ color: "red" }}>{error ?? "API not found."}</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => void refetch()} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            Retry
          </button>
          <button onClick={onBack} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            ← APIs
          </button>
        </div>
      </div>
    );
  }

  const currentApi = api;
  const selectedEnvironment = environments.find((e) => e.environmentId === selectedEnvironmentId) ?? null;
  const config = selectedEnvironment ? configs.find((c) => c.environmentId === selectedEnvironment.environmentId) ?? null : null;
  const environmentInactive = selectedEnvironment?.environmentStatus === "INACTIVE";
  const readOnlyConfig = projectInactive || environmentInactive;

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

  return (
    <div>
      {projectInactive && <InactiveBanner message="This Project is INACTIVE. This API is view-only until the Project is reactivated." />}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "14px" }}>
          <button onClick={onBack} style={{ border: "none", background: "none", padding: 0, color: "#000", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
            APIs
          </button>
          <span style={{ margin: "0 6px", color: "#666" }}>/</span>
          <span>{currentApi.apiName}</span>
        </div>
        {!projectInactive && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setRunPanelOpen(true)}
              disabled={!requestInput.definition || environments.length === 0}
              style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: !requestInput.definition || environments.length === 0 ? "not-allowed" : "pointer", opacity: !requestInput.definition || environments.length === 0 ? 0.5 : 1 }}
            >
              Run API
            </button>
            <button onClick={() => { setEditError(null); setShowEditModal(true); }} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              Edit
            </button>
            {isAdmin && (
              <button onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", color: "red" }}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
        {(["overview", "requestInput", "environments"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #000" : "none",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontWeight: activeTab === tab ? "bold" : "normal",
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        {activeTab === "overview" && (
          <div style={{ border: "1px solid #ccc", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ margin: 0 }}>{currentApi.apiName}</h3>
            </div>
            <p style={{ marginTop: "10px" }}>
              <strong>{currentApi.httpMethod}</strong> {currentApi.path}
            </p>
            <p style={{ color: "#666", marginTop: "10px" }}>{currentApi.description || "No description provided."}</p>
          </div>
        )}

        {activeTab === "requestInput" && requestInput.loading && (
          <div style={{ border: "1px solid #ccc", padding: "20px" }}>
            <p>Loading Request Input...</p>
          </div>
        )}

        {activeTab === "requestInput" && !requestInput.loading && requestInput.error && (
          <div style={{ border: "1px solid #ccc", padding: "20px" }}>
            <p style={{ color: "red" }}>{requestInput.error}</p>
            <button onClick={() => void requestInput.refetch()} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {activeTab === "requestInput" && !requestInput.loading && !requestInput.error && requestInput.definition && (
          <RequestInputTab
            key={apiId}
            definition={requestInput.definition}
            readOnly={projectInactive}
            saving={requestInput.saving}
            onSave={requestInput.save}
          />
        )}

        {activeTab === "environments" && (
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ width: "200px", borderRight: "1px solid #ccc" }}>
              {environments.map((env) => (
                <button
                  key={env.environmentId}
                  onClick={() => setSelectedEnvironmentId(env.environmentId)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    border: "none",
                    borderBottom: "1px solid #ccc",
                    backgroundColor: env.environmentId === selectedEnvironmentId ? "#f3f3f3" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: env.environmentId === selectedEnvironmentId ? "bold" : "normal",
                  }}
                >
                  {env.environmentName}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              {selectedEnvironment && !configsLoading && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h4 style={{ margin: 0 }}>{selectedEnvironment.environmentName}</h4>
                    <ClassificationBadge classification={selectedEnvironment.classification} />
                    <StatusBadge status={selectedEnvironment.environmentStatus} />
                  </div>
                  <p style={{ color: "#666", fontSize: "13px", marginTop: "5px" }}>
                    Allow Run: {selectedEnvironment.allowRun ? "ON" : "OFF"} (managed from the Environments list)
                  </p>
                  {environmentInactive && (
                    <p style={{ color: "#6B7280", fontSize: "13px" }}>This Environment is INACTIVE — URL and Credential are view-only.</p>
                  )}

                  <div style={{ border: "1px solid #ccc", padding: "15px", marginTop: "15px" }}>
                    <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Full URL</span>
                    <input
                      type="text"
                      value={urlDraft[selectedEnvironment.environmentId] ?? config?.fullUrl ?? ""}
                      onChange={(e) => setUrlDraft((prev) => ({ ...prev, [selectedEnvironment.environmentId]: e.target.value }))}
                      disabled={readOnlyConfig}
                      placeholder="https://example.com/api/..."
                      style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
                    />
                    {!config?.fullUrl && <p style={{ color: "#D97706", fontSize: "12px", marginTop: "5px" }}>No URL configured — Run is blocked for this API in this Environment.</p>}
                    {urlError && <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>{urlError}</p>}
                    {!readOnlyConfig && (
                      <button onClick={() => void handleSaveUrl()} disabled={savingUrl} style={{ marginTop: "10px", padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: savingUrl ? "not-allowed" : "pointer", opacity: savingUrl ? 0.6 : 1 }}>
                        {savingUrl ? "Saving..." : "Save URL"}
                      </button>
                    )}
                  </div>

                  <CredentialSection />
                </>
              )}
            </div>
          </div>
        )}
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

      {runPanelOpen && requestInput.definition && (
        <RunRequestPanel
          definition={requestInput.definition}
          environments={environments}
          selectedEnvironmentId={selectedEnvironmentId}
          onSelectEnvironment={setSelectedEnvironmentId}
          onClose={() => setRunPanelOpen(false)}
        />
      )}
    </div>
  );
}
