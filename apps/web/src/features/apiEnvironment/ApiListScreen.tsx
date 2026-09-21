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
import { Button } from "../../components/ui/Button";
import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";

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
      <div className="flex items-center justify-end border-b border-border px-5 py-2.5">
        {!projectInactive && (
          <div className="relative">
            <Button variant="primary" onClick={() => setShowAddMenu((v) => !v)}>
              + Add API
            </Button>
            {showAddMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[200px] rounded-md border border-border bg-white shadow-lg">
                <button
                  onClick={() => { setShowAddMenu(false); setModalError(null); setShowModal("create"); }}
                  className="block w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Create manually
                </button>
                <button
                  onClick={() => { setShowAddMenu(false); setShowImport(true); }}
                  className="block w-full border-t border-border px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Import from Swagger/OpenAPI
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading && <p className="text-sm text-muted">Loading APIs...</p>}
        {!loading && error && (
          <div>
            <p className="text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!loading && !error && apis.length === 0 && <p className="text-sm text-muted">No APIs yet in this Project.</p>}
        {!loading && !error && apis.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Method</th>
                <th className={thClass}>Path</th>
                <th className={thClass}>Name</th>
                <th className={`${thClass} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apis.map((api) => (
                <tr key={api.apiId} className={trHoverClass}>
                  <td className={tdClass}>
                    <HttpMethodBadge method={api.httpMethod} />
                  </td>
                  <td className={tdClass}>
                    <button
                      onClick={() => onSelectApi(api.apiId)}
                      className="cursor-pointer border-none bg-transparent p-0 font-mono text-sm text-gray-900 underline"
                    >
                      {api.path}
                    </button>
                  </td>
                  <td className={tdClass}>{api.apiName}</td>
                  <td className={`${tdClass} text-center`}>
                    <Button variant="secondary" size="sm" className="mr-1.5" onClick={() => onSelectApi(api.apiId)} disabled={projectInactive}>
                      Edit
                    </Button>
                    {isAdmin && (
                      <Button variant="danger" size="sm" onClick={() => { setDeleteError(null); setDeleteTarget(api); }} disabled={projectInactive}>
                        Delete
                      </Button>
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
