import { useState } from "react";
import { Header } from "../../components/Header";
import { ApiError } from "../../services/api-client";
import { useProjectsList } from "./useProjectsList";
import type { Role } from "./projects.types";
import { StatusBadge } from "./StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";

type CreateModalState = "default" | "loading" | "success" | "invalid" | "error";

// UI-PRJ-01: display Name/Description/Status for both ADMIN and USER.
// Create Project (UI-PRJ-02) is ADMIN-only. The project list is fetched
// straight from the backend, which is authoritative for what this viewer
// is scoped to see; soft-deleted projects are excluded server-side.
export function ProjectListScreen({
  user,
  accessToken,
  onSelectProject,
  onLogout,
  onShowSessionExpired,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  accessToken: string | null;
  onSelectProject: (id: string) => void;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const { projects, loading, error, create } = useProjectsList(accessToken, onSessionExpired, onAccessDenied);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createState, setCreateState] = useState<CreateModalState>("default");
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function openCreateModal() {
    setShowCreateModal(true);
    setCreateState("default");
    setCreateErrorMessage(null);
    setName("");
    setDescription("");
  }

  async function handleCreate() {
    if (!name.trim()) {
      setCreateState("invalid");
      return;
    }
    setCreateState("loading");
    try {
      await create(name.trim(), description.trim());
      setCreateState("success");
    } catch (err) {
      setCreateErrorMessage(err instanceof ApiError ? err.message : "Something went wrong while creating the project. Please try again.");
      setCreateState("error");
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <Header user={user} onLogout={onLogout} title="Projects" onShowSessionExpired={onShowSessionExpired} />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="m-0 text-xl font-semibold text-gray-900">Projects</h1>
            <p className="mt-1 text-sm text-muted">Select a project to open its APIs, environments, and members.</p>
          </div>
          {isAdmin && (
            <Button variant="primary" onClick={openCreateModal}>
              + Create Project
            </Button>
          )}
        </div>
        {loading && <p className="text-sm text-muted">Loading projects...</p>}
        {error && <p className="text-sm text-error">{error}</p>}
        {!loading && !error && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Description</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-center`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.projectId} className={trHoverClass}>
                  <td className={`${tdClass} font-medium`}>{p.projectName}</td>
                  <td className={`${tdClass} text-muted`}>{p.description || "—"}</td>
                  <td className={tdClass}>
                    <StatusBadge status={p.projectStatus} />
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <Button variant="secondary" size="sm" onClick={() => onSelectProject(p.projectId)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <Modal title="Create Project">
          {createState === "success" ? (
            <div className="py-5 text-center">
              <p className="text-sm text-gray-900">Project created successfully</p>
              <Button variant="primary" className="mt-3" onClick={() => setShowCreateModal(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <Input
                  label="Project Name *"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setCreateState("default");
                  }}
                />
              </div>
              <div className="mb-3">
                <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {createState === "invalid" && <p className="text-xs text-error">Project Name is required</p>}
              {createState === "error" && <p className="text-xs text-error">{createErrorMessage}</p>}
              {createState === "loading" && <p className="text-xs text-muted">Creating project...</p>}
              <div className="mt-4 flex gap-2.5">
                <Button variant="secondary" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" className="flex-1" onClick={handleCreate} disabled={createState === "loading"}>
                  Create
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
