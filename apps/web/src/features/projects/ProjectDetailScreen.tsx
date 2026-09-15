import { useState } from "react";
import { Header } from "../../components/Header";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Project, Role } from "./projects.types";
import { StatusBadge } from "./StatusBadge";

// UI-PRJ-03/04/05/06: display fields for both roles; Edit/Activate-Deactivate/
// Delete are ADMIN-only actions surfaced here (not on the List screen).
export function ProjectDetailScreen({
  user,
  project,
  onBack,
  onLogout,
  onMembersClick,
  onEditProject,
  onToggleStatus,
  onDeleteProject,
  onShowSessionExpired,
}: {
  user: { email: string; role: Role };
  project: Project;
  onBack: () => void;
  onLogout: () => void;
  onMembersClick: () => void;
  onEditProject: (id: string, name: string, description: string) => void;
  onToggleStatus: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onShowSessionExpired?: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<"overview" | "members">("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description);
  const [editError, setEditError] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function openEditModal() {
    setEditName(project.name);
    setEditDescription(project.description);
    setEditError(false);
    setShowEditModal(true);
  }

  function handleSaveEdit() {
    if (!editName.trim()) {
      setEditError(true);
      return;
    }
    onEditProject(project.id, editName.trim(), editDescription.trim());
    setShowEditModal(false);
  }

  const isDeactivating = project.status === "ACTIVE";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title={project.name} onShowSessionExpired={onShowSessionExpired} />
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          ← Back
        </button>
        {isAdmin && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={openEditModal} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              Edit
            </button>
            <button onClick={() => setShowStatusConfirm(true)} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              {isDeactivating ? "Deactivate" : "Activate"}
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", color: "red" }}>
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
              if (tab === "members") onMembersClick();
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
              <h3 style={{ margin: 0 }}>{project.name}</h3>
              <StatusBadge status={project.status} />
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
                onChange={(e) => { setEditName(e.target.value); setEditError(false); }}
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
            {editError && <p style={{ color: "red", fontSize: "12px" }}>Project Name is required</p>}
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
            isDeactivating
              ? `Are you sure you want to deactivate "${project.name}"? The project will be marked INACTIVE.`
              : `Are you sure you want to activate "${project.name}"? The project will be marked ACTIVE.`
          }
          confirmLabel={isDeactivating ? "Deactivate" : "Activate"}
          onConfirm={() => { onToggleStatus(project.id); setShowStatusConfirm(false); }}
          onCancel={() => setShowStatusConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Project"
          message={`This will delete "${project.name}". It will no longer appear in project lists, but its historical data will be retained.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { onDeleteProject(project.id); setShowDeleteConfirm(false); onBack(); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
