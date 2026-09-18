import { useState } from "react";
import { ApiError } from "../../services/api-client";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import type { Role } from "../projects/projects.types";
import { deleteApi } from "./apiEnvironment.api";
import { CreateEditApiModal } from "./CreateEditApiModal";
import { ImportSwaggerFlow } from "./ImportSwaggerFlow";
import { InactiveBanner } from "./InactiveBanner";
import type { ApiListItem } from "./apiEnvironment.types";
import { useApiList } from "./useApiList";

// UI-API-01: API List for a Project. Per REQ-SEC-003, both ADMIN and USER
// (with Project Access, already guaranteed by the time this screen renders)
// can Create/Edit/Import APIs; only ADMIN can Delete an API. Project-level
// Header/Back/tabs live in ProjectLayout.
export function ApiListScreen({
  user,
  projectId,
  projectStatus,
  accessToken,
  onSessionExpired,
  onAccessDenied,
  onSelectApi,
}: {
  user: { email: string; role: Role };
  projectId: string;
  projectStatus: "ACTIVE" | "INACTIVE";
  accessToken: string | null;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
  onSelectApi: (apiId: string) => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const projectInactive = projectStatus === "INACTIVE";
  const { apis, loading, error, refetch, createApi, importPreview, importConfirm } = useApiList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showModal, setShowModal] = useState<"create" | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSaveApi(input: { apiName: string; httpMethod: string; path: string; description: string | null }) {
    setSaving(true);
    setModalError(null);
    try {
      await createApi(input);
      setShowModal(null);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Unable to save API.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !accessToken) return;
    try {
      await deleteApi(projectId, deleteTarget.apiId, accessToken);
      setDeleteTarget(null);
      await refetch();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Unable to delete API.");
    }
  }

  return (
    <div>
      {projectInactive && <InactiveBanner message="This Project is INACTIVE. APIs are view-only until the Project is reactivated." />}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "flex-end", position: "relative" }}>
        {!projectInactive && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowAddMenu((v) => !v)} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              + Add API
            </button>
            {showAddMenu && (
              <div style={{ position: "absolute", right: 0, top: "36px", border: "1px solid #000", backgroundColor: "#fff", zIndex: 10, minWidth: "200px" }}>
                <button
                  onClick={() => { setShowAddMenu(false); setModalError(null); setShowModal("create"); }}
                  style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", backgroundColor: "#fff", cursor: "pointer", textAlign: "left" }}
                >
                  Create manually
                </button>
                <button
                  onClick={() => { setShowAddMenu(false); setShowImport(true); }}
                  style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderTop: "1px solid #ccc", backgroundColor: "#fff", cursor: "pointer", textAlign: "left" }}
                >
                  Import from Swagger/OpenAPI
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        {loading && <p>Loading APIs...</p>}
        {!loading && error && (
          <div>
            <p style={{ color: "red" }}>{error}</p>
            <button onClick={() => void refetch()} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && apis.length === 0 && <p style={{ color: "#666" }}>No APIs yet in this Project.</p>}
        {!loading && !error && apis.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #000" }}>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Method</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Path</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Name</th>
                <th style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apis.map((api) => (
                <tr key={api.apiId} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ padding: "10px" }}>{api.httpMethod}</td>
                  <td style={{ padding: "10px" }}>
                    <button onClick={() => onSelectApi(api.apiId)} style={{ border: "none", background: "none", padding: 0, color: "#000", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                      {api.path}
                    </button>
                  </td>
                  <td style={{ padding: "10px" }}>{api.apiName}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>
                    <button
                      onClick={() => onSelectApi(api.apiId)}
                      disabled={projectInactive}
                      style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: projectInactive ? "not-allowed" : "pointer", marginRight: "5px", opacity: projectInactive ? 0.5 : 1 }}
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => { setDeleteError(null); setDeleteTarget(api); }}
                        disabled={projectInactive}
                        style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: projectInactive ? "not-allowed" : "pointer", color: "red", opacity: projectInactive ? 0.5 : 1 }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CreateEditApiModal editing={null} saving={saving} error={modalError} onSave={handleSaveApi} onCancel={() => setShowModal(null)} />
      )}

      {showImport && (
        <ImportSwaggerFlow
          onPreview={importPreview}
          onConfirm={importConfirm}
          onClose={() => setShowImport(false)}
          onImported={() => void refetch()}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete API"
          message={
            `This will delete "${deleteTarget.apiName}" (${deleteTarget.httpMethod} ${deleteTarget.path}). It will no longer appear in the API list, but its historical Run/Snapshot/Comparison data will be retained.` +
            (deleteError ? `\n${deleteError}` : "")
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
