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
import { Button } from "../../components/ui/Button";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";

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
      <div className="flex items-center justify-end border-b border-border px-5 py-2.5">
        {isAdmin && !projectInactive && (
          <Button
            variant="primary"
            onClick={() => {
              setModalError(null);
              setShowModal("create");
            }}
          >
            + Add Environment
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading && <p className="text-sm text-muted">Loading Environments...</p>}
        {!loading && error && (
          <div>
            <p className="text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!loading && !error && environments.length === 0 && <p className="text-sm text-muted">No Environments yet in this Project.</p>}
        {!loading && !error && environments.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Classification</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Allow Run</th>
                {isAdmin && <th className={`${thClass} text-center`}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {environments.map((env) => {
                const envInactive = env.environmentStatus === "INACTIVE";
                return (
                  <tr key={env.environmentId} className={trHoverClass}>
                    <td className={`${tdClass} font-medium`}>{env.environmentName}</td>
                    <td className={tdClass}>
                      <ClassificationBadge classification={env.classification} />
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={env.environmentStatus} />
                    </td>
                    <td className={tdClass}>
                      <Toggle checked={env.allowRun} disabled={!isAdmin || envInactive || projectInactive} onChange={(v) => void handleToggleAllowRun(env, v)} label="Allow Run" />
                    </td>
                    {isAdmin && (
                      <td className={`${tdClass} text-center`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mr-1.5"
                          onClick={() => {
                            setModalError(null);
                            setShowModal(env);
                          }}
                          disabled={projectInactive}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setStatusError(null);
                            setStatusTarget(env);
                          }}
                          disabled={projectInactive}
                        >
                          {envInactive ? "Reactivate" : "Deactivate"}
                        </Button>
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
