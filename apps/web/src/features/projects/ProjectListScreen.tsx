import { useState } from "react";
import { Header } from "../../components/Header";
import { ApiError } from "../../services/api-client";
import { useProjectsList } from "./useProjectsList";
import type { Role } from "./projects.types";
import { StatusBadge } from "./StatusBadge";

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
  onNavigateAuditLogs,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  accessToken: string | null;
  onSelectProject: (id: string) => void;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onNavigateAuditLogs?: () => void;
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header
        user={user}
        onLogout={onLogout}
        title="Projects"
        onShowSessionExpired={onShowSessionExpired}
        onNavigateAuditLogs={isAdmin ? onNavigateAuditLogs : undefined}
      />
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2>Projects</h2>
          {isAdmin && (
            <button onClick={openCreateModal} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              + Create Project
            </button>
          )}
        </div>
        {loading && <p>Loading projects...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && !error && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #000" }}>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Name</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Description</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Status</th>
                <th style={{ padding: "10px", borderBottom: "1px solid #ccc", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.projectId} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ padding: "10px" }}>{p.projectName}</td>
                  <td style={{ padding: "10px", color: "#666" }}>{p.description || "—"}</td>
                  <td style={{ padding: "10px" }}>
                    <StatusBadge status={p.projectStatus} />
                  </td>
                  <td style={{ padding: "10px", textAlign: "center" }}>
                    <button onClick={() => onSelectProject(p.projectId)} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "400px" }}>
            <h3>Create Project</h3>
            {createState === "success" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p>Project created successfully</p>
                <button onClick={() => setShowCreateModal(false)} style={{ padding: "10px 20px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <label style={{ display: "block", marginBottom: "10px" }}>
                  <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Project Name *</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setCreateState("default"); }}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
                  />
                </label>
                <label style={{ display: "block", marginBottom: "10px" }}>
                  <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box", minHeight: "60px" }}
                  />
                </label>
                {createState === "invalid" && <p style={{ color: "red", fontSize: "12px" }}>Project Name is required</p>}
                {createState === "error" && <p style={{ color: "red", fontSize: "12px" }}>{createErrorMessage}</p>}
                {createState === "loading" && <p style={{ fontSize: "12px" }}>Creating project...</p>}
                <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                  <button onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={createState === "loading"}
                    style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", opacity: createState === "loading" ? 0.6 : 1 }}
                  >
                    Create
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
