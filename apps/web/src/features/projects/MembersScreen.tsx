import { useState } from "react";
import { Header } from "../../components/Header";
import { ApiError } from "../../services/api-client";
import { updateInvitedUserEmail } from "../users/users.api";
import { ConfirmDialog } from "./ConfirmDialog";
import type { MemberStatus, Role } from "./projects.types";
import { useProjectMembers } from "./useProjectMembers";

type AddModalState = "default" | "loading" | "success" | "invalid" | "duplicate" | "blocked" | "error";
type EditModalState = "default" | "loading" | "invalid" | "not-invited" | "duplicate" | "error";

// Add Member / Edit Invitation / Remove from Project are ADMIN-only, per
// PRJ-002/PRJ-003. Cancel Invitation has no sanctioned backend endpoint, so
// INVITED rows use the same "Remove from Project" action as every other row.
export function MembersScreen({
  user,
  projectId,
  projectName,
  accessToken,
  onBack,
  onLogout,
  onShowSessionExpired,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  projectId: string;
  projectName: string;
  accessToken: string | null;
  onBack: () => void;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");
  const { members, loading, error, refetch, addMember, removeMember } = useProjectMembers(
    projectId,
    accessToken,
    search,
    statusFilter === "ALL" ? undefined : statusFilter,
    onSessionExpired,
    onAccessDenied,
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalState, setAddModalState] = useState<AddModalState>("default");
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editModalState, setEditModalState] = useState<EditModalState>("default");
  const [showRemoveModal, setShowRemoveModal] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleAddMember() {
    if (!newEmail || !isValidEmail(newEmail)) {
      setAddModalState("invalid");
      return;
    }
    setAddModalState("loading");
    try {
      await addMember(newEmail);
      setAddModalState("success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAddModalState("duplicate");
      } else if (err instanceof ApiError && err.status === 422) {
        setAddModalState("blocked");
      } else {
        setAddModalState("error");
      }
    }
  }

  async function handleSaveEditInvitation() {
    if (!showEditModal) return;
    if (!editEmail || !isValidEmail(editEmail)) {
      setEditModalState("invalid");
      return;
    }
    setEditModalState("loading");
    try {
      if (!accessToken) return;
      await updateInvitedUserEmail(showEditModal, editEmail, accessToken);
      setShowEditModal(null);
      setEditModalState("default");
      await refetch();
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "ACCOUNT_NOT_INVITED") {
        setEditModalState("not-invited");
      } else if (err instanceof ApiError && err.errorCode === "EMAIL_ALREADY_EXISTS") {
        setEditModalState("duplicate");
      } else if (err instanceof ApiError && err.errorCode === "INVALID_EMAIL_FORMAT") {
        setEditModalState("invalid");
      } else {
        setEditModalState("error");
      }
    }
  }

  async function handleRemove() {
    if (!showRemoveModal) return;
    try {
      await removeMember(showRemoveModal);
      setShowRemoveModal(null);
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : "Unable to remove member.");
    }
  }

  const removeTarget = members.find((m) => m.userId === showRemoveModal);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title="Project Members" onShowSessionExpired={onShowSessionExpired} />
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc" }}>
        <button onClick={onBack} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", marginRight: "10px" }}>
          ← Back
        </button>
      </div>
      <div style={{ padding: "20px", borderBottom: "1px solid #ccc", display: "flex", gap: "10px", alignItems: "center" }}>
        <input type="text" placeholder="Search by email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "8px", border: "1px solid #ccc", width: "250px" }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | MemberStatus)} style={{ padding: "8px", border: "1px solid #ccc" }}>
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INVITED">INVITED</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
        </select>
        {isAdmin && (
          <button onClick={() => { setShowAddModal(true); setAddModalState("default"); setNewEmail(""); }} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", marginLeft: "auto" }}>
            + Add Member
          </button>
        )}
      </div>
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        {loading && <p>Loading members...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && !error && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #000" }}>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Email</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Role</th>
                <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Status</th>
                {isAdmin && <th style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ padding: "10px" }}>{m.email}</td>
                  <td style={{ padding: "10px" }}>{m.systemRole}</td>
                  <td style={{ padding: "10px" }}>{m.accountStatus}</td>
                  {isAdmin && (
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      {m.accountStatus === "INVITED" && (
                        <button onClick={() => { setShowEditModal(m.userId); setEditEmail(m.email); setEditModalState("default"); }} style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", marginRight: "5px" }}>
                          Edit Invitation
                        </button>
                      )}
                      <button onClick={() => { setRemoveError(null); setShowRemoveModal(m.userId); }} style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", color: "red" }}>
                        Remove from Project
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "400px" }}>
            <h3>Add Member</h3>
            {addModalState === "success" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p>Member added successfully</p>
                <button onClick={() => { setShowAddModal(false); setAddModalState("default"); setNewEmail(""); }} style={{ padding: "10px 20px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <label style={{ display: "block", marginBottom: "10px" }}>
                  <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Google Email *</span>
                  <input type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setAddModalState("default"); }} placeholder="user@example.com" style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                </label>
                {addModalState === "invalid" && <p style={{ color: "red", fontSize: "12px" }}>Invalid email address</p>}
                {addModalState === "duplicate" && <p style={{ color: "red", fontSize: "12px" }}>User already belongs to this project</p>}
                {addModalState === "blocked" && <p style={{ color: "red", fontSize: "12px" }}>This account is blocked or inactive and cannot be added as a member</p>}
                {addModalState === "error" && <p style={{ color: "red", fontSize: "12px" }}>Something went wrong while adding the member. Please try again.</p>}
                {addModalState === "loading" && <p style={{ fontSize: "12px" }}>Adding member...</p>}
                <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                  <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleAddMember} disabled={addModalState === "loading"} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", opacity: addModalState === "loading" ? 0.6 : 1 }}>
                    Add Member
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "400px" }}>
            <h3>Edit Invitation</h3>
            <label style={{ display: "block", marginBottom: "10px" }}>
              <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Google Email</span>
              <input type="email" value={editEmail} onChange={(e) => { setEditEmail(e.target.value); setEditModalState("default"); }} style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
            </label>
            {editModalState === "invalid" && <p style={{ color: "red", fontSize: "12px" }}>Invalid email address</p>}
            {editModalState === "not-invited" && <p style={{ color: "red", fontSize: "12px" }}>This invitation can no longer be edited</p>}
            {editModalState === "duplicate" && <p style={{ color: "red", fontSize: "12px" }}>That email is already in use</p>}
            {editModalState === "error" && <p style={{ color: "red", fontSize: "12px" }}>Something went wrong. Please try again.</p>}
            {editModalState === "loading" && <p style={{ fontSize: "12px" }}>Saving...</p>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowEditModal(null)} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSaveEditInvitation} disabled={editModalState === "loading"} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove from Project"
          message={
            `Remove ${removeTarget.email} from "${projectName}"? This only removes their access to this Project — it does not delete their account, change their System Role, or remove them from other Projects.` +
            (removeError ? `\n${removeError}` : "")
          }
          confirmLabel="Remove"
          danger
          onConfirm={handleRemove}
          onCancel={() => setShowRemoveModal(null)}
        />
      )}
    </div>
  );
}
