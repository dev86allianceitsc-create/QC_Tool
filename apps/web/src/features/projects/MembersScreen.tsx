import { useState } from "react";
import { Header } from "../../components/Header";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Member, MemberStatus, Role } from "./projects.types";

type AddModalState = "default" | "loading" | "success" | "invalid" | "duplicate" | "blocked" | "error";

// Moved from App.tsx and extended: Add Member button + row-level Edit/Cancel
// Invitation actions are ADMIN-only now, and a new "Remove from Project"
// action (also ADMIN-only) is added for non-INVITED rows, per PRJ-002/PRJ-003.
// Existing Add Member / Edit Invitation / Cancel Invitation modal behavior is
// preserved unchanged; only the "error"/"blocked" feedback states are new.
export function MembersScreen({
  user,
  projectName,
  members,
  onBack,
  onLogout,
  onAddMember,
  onEditMember,
  onCancelMember,
  onRemoveMember,
  onShowSessionExpired,
}: {
  user: { email: string; role: Role };
  projectName: string;
  members: Member[];
  onBack: () => void;
  onLogout: () => void;
  onAddMember: (email: string) => void;
  onEditMember: (id: string, email: string) => void;
  onCancelMember: (id: string) => void;
  onRemoveMember: (id: string) => void;
  onShowSessionExpired?: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalState, setAddModalState] = useState<AddModalState>("default");
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const filtered = members.filter((m) => {
    const matchSearch = m.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleAddMember = () => {
    if (!newEmail || !isValidEmail(newEmail)) {
      setAddModalState("invalid");
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === newEmail.toLowerCase())) {
      setAddModalState("duplicate");
      return;
    }
    setAddModalState("loading");
    setTimeout(() => {
      onAddMember(newEmail);
      setAddModalState("success");
    }, 800);
  };

  const removeTarget = members.find((m) => m.id === showRemoveModal);

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
            {filtered.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: "10px" }}>{m.email}</td>
                <td style={{ padding: "10px" }}>{m.role}</td>
                <td style={{ padding: "10px" }}>{m.status}</td>
                {isAdmin && (
                  <td style={{ padding: "10px", textAlign: "center" }}>
                    {m.status === "INVITED" ? (
                      <>
                        <button onClick={() => { setShowEditModal(m.id); setEditEmail(m.email); }} style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", marginRight: "5px" }}>
                          Edit Invitation
                        </button>
                        <button onClick={() => setShowCancelModal(m.id)} style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                          Cancel Invitation
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setShowRemoveModal(m.id)} style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", color: "red" }}>
                        Remove from Project
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
                {import.meta.env.DEV && (
                  <div style={{ marginTop: "15px", padding: "8px", border: "1px dashed #ccc", backgroundColor: "#f9f9f9" }}>
                    <p style={{ fontSize: "11px", color: "#666", margin: "0 0 5px" }}>*** Development Only - Demo Controls ***</p>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button onClick={() => setAddModalState("blocked")} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
                        Simulate: Blocked account
                      </button>
                      <button onClick={() => setAddModalState("error")} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
                        Simulate: Server error
                      </button>
                    </div>
                  </div>
                )}
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
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }} />
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowEditModal(null)} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => { onEditMember(showEditModal, editEmail); setShowEditModal(null); }} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Save
              </button>
            </div>
            <button onClick={() => { setShowCancelModal(showEditModal); setShowEditModal(null); }} style={{ width: "100%", padding: "8px", marginTop: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", color: "red" }}>
              Cancel Invitation
            </button>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "400px", textAlign: "center" }}>
            <h3>Cancel Invitation</h3>
            <p>Are you sure you want to cancel this invitation?</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowCancelModal(null)} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Keep
              </button>
              <button onClick={() => { onCancelMember(showCancelModal); setShowCancelModal(null); }} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove from Project"
          message={`Remove ${removeTarget.email} from "${projectName}"? This only removes their access to this Project — it does not delete their account, change their System Role, or remove them from other Projects.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => { onRemoveMember(removeTarget.id); setShowRemoveModal(null); }}
          onCancel={() => setShowRemoveModal(null)}
        />
      )}
    </div>
  );
}
