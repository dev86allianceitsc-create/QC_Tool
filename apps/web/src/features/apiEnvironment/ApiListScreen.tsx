import { useMemo, useState } from "react";
import { ApiError } from "../../services/api-client";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import type { Role } from "../projects/projects.types";
import { deleteApi } from "./apiEnvironment.api";
import { CreateEditApiModal } from "./CreateEditApiModal";
import { ImportSwaggerFlow } from "./ImportSwaggerFlow";
import { InactiveBanner } from "./InactiveBanner";
import type { ApiListItem } from "./apiEnvironment.types";
import { MAX_BATCH_EXECUTIONS } from "./run.constants";
import { useApiList } from "./useApiList";
import { useApiListReadiness, type ApiConfigurationStatus } from "./useApiListReadiness";
import { useEnvironmentList } from "./useEnvironmentList";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";

// UI-API-01 / UI-RUN-01: API List for a Project. Per REQ-SEC-003, both ADMIN
// and USER (with Project Access, already guaranteed by the time this screen
// renders) can Create/Edit/Import APIs; only ADMIN can Delete an API.
// Project-level Header/Back/tabs live in ProjectLayout. Group Run adds
// Environment-scoped readiness plus an opt-in batch-selection mode (entered
// via "Select APIs to Run") that reveals checkboxes and Run Selected ->
// Batch Run Preparation (RS-RUN-001-01,02,05,06,08). Readiness here is an
// early, non-blocking hint only — Batch Run Preparation performs the real
// gating.
export function ApiListScreen({
  user,
  projectId,
  projectStatus,
  accessToken,
  onSessionExpired,
  onAccessDenied,
  onSelectApi,
  onRunSelected,
}: {
  user: { email: string; role: Role };
  projectId: string;
  projectStatus: "ACTIVE" | "INACTIVE";
  accessToken: string | null;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
  onSelectApi: (apiId: string) => void;
  onRunSelected: (apiIds: string[], environmentId: string) => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const projectInactive = projectStatus === "INACTIVE";
  const { apis, loading, error, refetch, createApi, importPreview, importConfirm } = useApiList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );
  const { environments } = useEnvironmentList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const activeEnvironments = useMemo(() => environments.filter((e) => e.environmentStatus === "ACTIVE"), [environments]);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showModal, setShowModal] = useState<"create" | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [selectedApiIds, setSelectedApiIds] = useState<Set<string>>(new Set());
  const [batchSelectMode, setBatchSelectMode] = useState(false);

  const selectedEnvironment = activeEnvironments.find((e) => e.environmentId === selectedEnvironmentId) ?? null;
  const { readinessByApiId, loading: readinessLoading } = useApiListReadiness(
    projectId,
    apis,
    selectedEnvironmentId,
    selectedEnvironment?.allowRun ?? null,
    accessToken,
  );

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
    const target = deleteTarget;
    try {
      await deleteApi(projectId, target.apiId, accessToken);
      setDeleteTarget(null);
      setSelectedApiIds((prev) => {
        if (!prev.has(target.apiId)) return prev;
        const next = new Set(prev);
        next.delete(target.apiId);
        return next;
      });
      await refetch();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Unable to delete API.");
    }
  }

  function toggleApi(apiId: string) {
    setSelectedApiIds((prev) => {
      const next = new Set(prev);
      if (next.has(apiId)) {
        next.delete(apiId);
      } else if (next.size < MAX_BATCH_EXECUTIONS) {
        next.add(apiId);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedApiIds((prev) => {
      const allSelected = apis.length > 0 && apis.every((a) => prev.has(a.apiId));
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const api of apis) {
        if (next.size >= MAX_BATCH_EXECUTIONS) break;
        next.add(api.apiId);
      }
      return next;
    });
  }

  function readinessBadge(status: ApiConfigurationStatus | undefined) {
    if (!selectedEnvironmentId) return <span className="text-xs text-muted">Select an Environment</span>;
    if (!status) return <Badge tone="neutral" label={readinessLoading ? "Checking…" : "Unknown"} />;
    switch (status) {
      case "CONFIGURED":
        return <Badge tone="success" label="Configured" />;
      case "MISSING_URL":
        return <Badge tone="warning" label="Missing Full URL" />;
      case "MISSING_CREDENTIAL":
        return <Badge tone="warning" label="Missing Credential" />;
      case "ALLOW_RUN_OFF":
        return <Badge tone="danger" label="Allow Run OFF" />;
    }
  }

  const allVisibleSelected = apis.length > 0 && apis.every((a) => selectedApiIds.has(a.apiId));

  return (
    <div>
      {projectInactive && <InactiveBanner message="This Project is INACTIVE. APIs are view-only until the Project is reactivated." />}

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {activeEnvironments.length > 0 && (
            <select
              aria-label="Environment"
              value={selectedEnvironmentId ?? ""}
              onChange={(e) => setSelectedEnvironmentId(e.target.value || null)}
              className="rounded-md border border-border px-2.5 py-1.5 text-sm text-gray-900"
            >
              <option value="">Select Environment…</option>
              {activeEnvironments.map((env) => (
                <option key={env.environmentId} value={env.environmentId}>
                  {env.environmentName}
                </option>
              ))}
            </select>
          )}
          {!batchSelectMode ? (
            <Button variant="secondary" size="sm" onClick={() => setBatchSelectMode(true)} disabled={projectInactive}>
              Select APIs to Run
            </Button>
          ) : (
            <>
              <span className="text-sm text-muted">
                {selectedApiIds.size} / {MAX_BATCH_EXECUTIONS} selected
              </span>
              {selectedApiIds.size > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setSelectedApiIds(new Set())}>
                  Clear Selection
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={projectInactive || selectedApiIds.size === 0 || !selectedEnvironmentId}
                onClick={() => selectedEnvironmentId && onRunSelected(Array.from(selectedApiIds), selectedEnvironmentId)}
                title={!selectedEnvironmentId ? "Select an Environment first" : selectedApiIds.size === 0 ? "Select at least one API" : undefined}
              >
                Run Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBatchSelectMode(false);
                  setSelectedApiIds(new Set());
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
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

      {batchSelectMode && selectedApiIds.size > 0 && !selectedEnvironmentId && (
        <p className="m-0 border-b border-border px-5 py-2 text-xs text-warning">
          Select an Environment above to enable Run Selected.
        </p>
      )}

      {selectedEnvironment && !selectedEnvironment.allowRun && (
        <p className="m-0 border-b border-border px-5 py-2 text-xs text-warning">
          Allow Run is OFF for {selectedEnvironment.environmentName}. APIs can still be selected, but a Run will not be accepted until an Admin
          enables it for this Environment.
        </p>
      )}

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
                {batchSelectMode && (
                  <th className={thClass}>
                    <input
                      type="checkbox"
                      aria-label="Select all APIs on this page"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={projectInactive}
                      className="h-4 w-4 rounded border-border"
                    />
                  </th>
                )}
                <th className={thClass}>Method</th>
                <th className={thClass}>Path</th>
                <th className={thClass}>Name</th>
                <th className={thClass}>Configuration — Env</th>
                <th className={thClass}>Required Input</th>
                <th className={`${thClass} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apis.map((api) => {
                const readiness = readinessByApiId[api.apiId];
                const checked = selectedApiIds.has(api.apiId);
                return (
                  <tr key={api.apiId} className={trHoverClass}>
                    {batchSelectMode && (
                      <td className={tdClass}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${api.apiName}`}
                          checked={checked}
                          onChange={() => toggleApi(api.apiId)}
                          disabled={projectInactive || (!checked && selectedApiIds.size >= MAX_BATCH_EXECUTIONS)}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                    )}
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
                    <td className={tdClass}>{readinessBadge(readiness?.configurationStatus)}</td>
                    <td className={tdClass}>
                      {!selectedEnvironmentId ? (
                        <span className="text-xs text-muted">—</span>
                      ) : readiness ? (
                        readiness.requiredInputCount > 0 ? (
                          `${readiness.requiredInputCount} required`
                        ) : (
                          "None"
                        )
                      ) : (
                        <span className="text-xs text-muted">{readinessLoading ? "Checking…" : "—"}</span>
                      )}
                    </td>
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
                );
              })}
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
