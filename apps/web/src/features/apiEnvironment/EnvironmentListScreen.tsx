import { useState } from "react";
import { ApiError } from "../../services/api-client";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import { StatusBadge } from "../projects/StatusBadge";
import type { Role } from "../projects/projects.types";
import { ClassificationBadge } from "./ClassificationBadge";
import { CreateEditEnvironmentModal } from "./CreateEditEnvironmentModal";
import { InactiveBanner } from "./InactiveBanner";
import { Toggle } from "./Toggle";
import type { EnvironmentClassification, EnvironmentListItem } from "./apiEnvironment.types";
import { useEnvironmentList } from "./useEnvironmentList";

// UI-ENV-01: Environment List. Allow Run mutation is Admin-only (REQ-ENV-003)
// and disabled entirely once the Environment is INACTIVE. Environment
// mutation is PATCH-only (REQ-ENV-003/006) — status and allowRun changes both
// go through updateEnvironment, never a dedicated activate/deactivate/allow-run
// endpoint. Project-level Header/Back/tabs live in ProjectLayout.
export function EnvironmentListScreen({
  user,
  projectId,
  projectStatus,
  accessToken,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  projectId: string;
  projectStatus: "ACTIVE" | "INACTIVE";
  accessToken: string | null;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const projectInactive = projectStatus === "INACTIVE";
  const { environments, loading, error, refetch, createEnvironment, updateEnvironment } = useEnvironmentList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );

  const [showModal, setShowModal] = useState<"create" | EnvironmentListItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<EnvironmentListItem | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleSaveEnvironment(input: { environmentName: string; classification: EnvironmentClassification; allowRun?: boolean }) {
    setSaving(true);
    setModalError(null);
    try {
      if (showModal === "create") {
        await createEnvironment(input);
      } else if (showModal) {
        await updateEnvironment(showModal.environmentId, input);
      }
      setShowModal(null);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Unable to save Environment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAllowRun(env: EnvironmentListItem, next: boolean) {
    try {
      await updateEnvironment(env.environmentId, { allowRun: next });
    } catch {
      // Refetch already runs inside updateEnvironment; the list simply
      // reflects whatever the server accepted.
    }
  }

  async function handleToggleStatus() {
    if (!statusTarget) return;
    setStatusError(null);
    try {
      await updateEnvironment(statusTarget.environmentId, {
        environmentStatus: statusTarget.environmentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      setStatusTarget(null);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : "Unable to update Environment status.");
    }
  }

  return (
    <div>
      {projectInactive && <InactiveBanner message="This Project is INACTIVE. Environments are view-only until the Project is reactivated." />}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        {isAdmin && !projectInactive && (
          <button onClick={() => { setModalError(null); setShowModal("create"); }} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            + Add Environment
          </button>
        )}
      </div>
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        {loading && <p>Loading Environments...</p>}
        {!loading && error && (
          <div>
            <p style={{ color: "red" }}>{error}</p>
            <button onClick={() => void refetch()} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && environments.length === 0 && <p style={{ color: "#666" }}>No Environments yet in this Project.</p>}
        {!loading && !error && environments.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #000" }}>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Name</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Classification</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Status</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Allow Run</th>
                {isAdmin && <th style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {environments.map((env) => {
                const envInactive = env.environmentStatus === "INACTIVE";
                return (
                  <tr key={env.environmentId} style={{ borderBottom: "1px solid #ccc" }}>
                    <td style={{ padding: "10px" }}>{env.environmentName}</td>
                    <td style={{ padding: "10px" }}>
                      <ClassificationBadge classification={env.classification} />
                    </td>
                    <td style={{ padding: "10px" }}>
                      <StatusBadge status={env.environmentStatus} />
                    </td>
                    <td style={{ padding: "10px" }}>
                      <Toggle
                        checked={env.allowRun}
                        disabled={!isAdmin || envInactive || projectInactive}
                        onChange={(v) => void handleToggleAllowRun(env, v)}
                        label="Allow Run"
                      />
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <button
                          onClick={() => { setModalError(null); setShowModal(env); }}
                          disabled={projectInactive}
                          style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: projectInactive ? "not-allowed" : "pointer", marginRight: "5px", opacity: projectInactive ? 0.5 : 1 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setStatusError(null); setStatusTarget(env); }}
                          disabled={projectInactive}
                          style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: projectInactive ? "not-allowed" : "pointer", opacity: projectInactive ? 0.5 : 1 }}
                        >
                          {envInactive ? "Reactivate" : "Deactivate"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CreateEditEnvironmentModal
          editing={showModal === "create" ? null : showModal}
          saving={saving}
          error={modalError}
          onSave={(input) => void handleSaveEnvironment(input)}
          onCancel={() => setShowModal(null)}
        />
      )}

      {statusTarget && (
        <ConfirmDialog
          title={statusTarget.environmentStatus === "ACTIVE" ? "Deactivate Environment" : "Reactivate Environment"}
          message={
            (statusTarget.environmentStatus === "ACTIVE"
              ? `Are you sure you want to deactivate "${statusTarget.environmentName}"? It will become read-only and Allow Run will be locked until reactivated.`
              : `Are you sure you want to reactivate "${statusTarget.environmentName}"?`) + (statusError ? `\n${statusError}` : "")
          }
          confirmLabel={statusTarget.environmentStatus === "ACTIVE" ? "Deactivate" : "Reactivate"}
          danger={statusTarget.environmentStatus === "ACTIVE"}
          onConfirm={() => void handleToggleStatus()}
          onCancel={() => setStatusTarget(null)}
        />
      )}
    </div>
  );
}
