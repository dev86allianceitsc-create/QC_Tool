import { useEffect, useState } from "react";
import { Header } from "../../components/Header";
import { ApiError } from "../../services/api-client";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Role } from "./projects.types";
import { StatusBadge } from "./StatusBadge";
import { useProjectDetail } from "./useProjectDetail";

// UI-PRJ-03/04/05/06: display fields for both roles; Edit/Activate-Deactivate/
// Delete are ADMIN-only actions surfaced here (not on the List screen).
export function ProjectDetailScreen({
  user,
  projectId,
  accessToken,
  onBack,
  onLogout,
  onMembersClick,
  onShowSessionExpired,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  projectId: string;
  accessToken: string | null;
  onBack: () => void;
  onLogout: () => void;
  onMembersClick: (projectName: string) => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const { project, loading, error, update, remove } = useProjectDetail(projectId, accessToken, onSessionExpired, onAccessDenied);

  const [activeTab, setActiveTab] = useState<"overview" | "members">("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setEditName(project.projectName);
      setEditDescription(project.description ?? "");
    }
  }, [project]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
        <Header user={user} onLogout={onLogout} title="Loading..." onShowSessionExpired={onShowSessionExpired} />
        <div style={{ flex: 1, padding: "20px" }}>
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
        <Header user={user} onLogout={onLogout} title="Project" onShowSessionExpired={onShowSessionExpired} />
        <div style={{ flex: 1, padding: "20px" }}>
          <p style={{ color: "red" }}>{error ?? "Project not found."}</p>
          <button onClick={onBack} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  function openEditModal() {
    setEditName(project!.projectName);
    setEditDescription(project!.description ?? "");
    setEditError(null);
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) {
      setEditError("Project Name is required");
      return;
    }
    try {
      await update({ projectName: editName.trim(), description: editDescription.trim() || null });
      setShowEditModal(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Unable to save project.");
    }
  }

  async function handleToggleStatus() {
    try {
      await update({ projectStatus: isDeactivating ? "INACTIVE" : "ACTIVE" });
      setShowStatusConfirm(false);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : "Unable to update project status.");
    }
  }

  async function handleDelete() {
    try {
      await remove();
      setShowDeleteConfirm(false);
      onBack();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Unable to delete project.");
    }
  }

  const isDeactivating = project.projectStatus === "ACTIVE";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title={project.projectName} onShowSessionExpired={onShowSessionExpired} />
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          ← Back
        </button>
        {isAdmin && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={openEditModal} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              Edit
            </button>
            <button onClick={() => { setStatusError(null); setShowStatusConfirm(true); }} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              {isDeactivating ? "Deactivate" : "Activate"}
            </button>
            <button onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", color: "red" }}>
              Delete
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
        {["overview", "members"].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab as "overview" | "members");
              if (tab === "members") onMembersClick(project.projectName);
            }}
            style={{
              padding: "10px 20px",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #000" : "none",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontWeight: activeTab === tab ? "bold" : "normal",
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        {activeTab === "overview" && (
          <div style={{ border: "1px solid #ccc", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ margin: 0 }}>{project.projectName}</h3>
              <StatusBadge status={project.projectStatus} />
            </div>
            <p style={{ color: "#666", marginTop: "10px" }}>{project.description || "No description provided."}</p>
          </div>
        )}
      </div>

      {showEditModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "400px" }}>
            <h3>Edit Project</h3>
            <label style={{ display: "block", marginBottom: "10px" }}>
              <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Project Name *</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => { setEditName(e.target.value); setEditError(null); }}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "10px" }}>
              <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Description</span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box", minHeight: "60px" }}
              />
            </label>
            {editError && <p style={{ color: "red", fontSize: "12px" }}>{editError}</p>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusConfirm && (
        <ConfirmDialog
          title={isDeactivating ? "Deactivate Project" : "Activate Project"}
          message={
            (isDeactivating
              ? `Are you sure you want to deactivate "${project.projectName}"? The project will be marked INACTIVE.`
              : `Are you sure you want to activate "${project.projectName}"? The project will be marked ACTIVE.`) +
            (statusError ? `\n${statusError}` : "")
          }
          confirmLabel={isDeactivating ? "Deactivate" : "Activate"}
          onConfirm={handleToggleStatus}
          onCancel={() => setShowStatusConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Project"
          message={
            `This will delete "${project.projectName}". It will no longer appear in project lists, but its historical data will be retained.` +
            (deleteError ? `\n${deleteError}` : "")
          }
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
