import { useState } from "react";
import { ApiError } from "../../services/api-client";
import { updateInvitedUserEmail } from "../users/users.api";
import { ConfirmDialog } from "./ConfirmDialog";
import type { MemberStatus, Role } from "./projects.types";
import { useProjectMembers } from "./useProjectMembers";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { thClass, tdClass, trHoverClass } from "../../components/ui/table";

type AddModalState = "default" | "loading" | "success" | "invalid" | "duplicate" | "blocked" | "error";
type EditModalState = "default" | "loading" | "invalid" | "not-invited" | "duplicate" | "error";

// Add Member / Edit Invitation / Remove from Project are ADMIN-only, per
// PRJ-002/PRJ-003. Cancel Invitation has no sanctioned backend endpoint, so
// INVITED rows use the same "Remove from Project" action as every other row.
// Project-level Header/Back/tabs live in ProjectLayout.
export function MembersScreen({
  user,
  projectId,
  projectName,
  accessToken,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  projectId: string;
  projectName: string;
  accessToken: string | null;
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
    <div>
      <div className="flex items-center gap-2.5 border-b border-border p-5">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[250px] rounded-md border border-border px-3 py-2 text-sm text-gray-900 placeholder:text-muted focus:border-gray-400 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | MemberStatus)}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INVITED">INVITED</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
        </select>
        {isAdmin && (
          <Button
            variant="primary"
            className="ml-auto"
            onClick={() => {
              setShowAddModal(true);
              setAddModalState("default");
              setNewEmail("");
            }}
          >
            + Add Member
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading && <p className="text-sm text-muted">Loading members...</p>}
        {error && <p className="text-sm text-error">{error}</p>}
        {!loading && !error && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Email</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Status</th>
                {isAdmin && <th className={`${thClass} text-center`}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className={trHoverClass}>
                  <td className={tdClass}>{m.email}</td>
                  <td className={tdClass}>{m.systemRole}</td>
                  <td className={tdClass}>{m.accountStatus}</td>
                  {isAdmin && (
                    <td className={`${tdClass} text-center`}>
                      {m.accountStatus === "INVITED" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mr-1.5"
                          onClick={() => {
                            setShowEditModal(m.userId);
                            setEditEmail(m.email);
                            setEditModalState("default");
                          }}
                        >
                          Edit Invitation
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRemoveError(null);
                          setShowRemoveModal(m.userId);
                        }}
                      >
                        Remove from Project
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <Modal title="Add Member">
          {addModalState === "success" ? (
            <div className="py-5 text-center">
              <p className="text-sm text-gray-900">Member added successfully</p>
              <Button
                variant="primary"
                className="mt-3"
                onClick={() => {
                  setShowAddModal(false);
                  setAddModalState("default");
                  setNewEmail("");
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <Input
                  label="Google Email *"
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setAddModalState("default");
                  }}
                  placeholder="user@example.com"
                />
              </div>
              {addModalState === "invalid" && <p className="text-xs text-error">Invalid email address</p>}
              {addModalState === "duplicate" && <p className="text-xs text-error">User already belongs to this project</p>}
              {addModalState === "blocked" && <p className="text-xs text-error">This account is blocked or inactive and cannot be added as a member</p>}
              {addModalState === "error" && <p className="text-xs text-error">Something went wrong while adding the member. Please try again.</p>}
              {addModalState === "loading" && <p className="text-xs text-muted">Adding member...</p>}
              <div className="mt-4 flex gap-2.5">
                <Button variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" className="flex-1" onClick={handleAddMember} disabled={addModalState === "loading"}>
                  Add Member
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {showEditModal && (
        <Modal title="Edit Invitation">
          <div className="mb-3">
            <Input
              label="Google Email"
              type="email"
              value={editEmail}
              onChange={(e) => {
                setEditEmail(e.target.value);
                setEditModalState("default");
              }}
            />
          </div>
          {editModalState === "invalid" && <p className="text-xs text-error">Invalid email address</p>}
          {editModalState === "not-invited" && <p className="text-xs text-error">This invitation can no longer be edited</p>}
          {editModalState === "duplicate" && <p className="text-xs text-error">That email is already in use</p>}
          {editModalState === "error" && <p className="text-xs text-error">Something went wrong. Please try again.</p>}
          {editModalState === "loading" && <p className="text-xs text-muted">Saving...</p>}
          <div className="mt-4 flex gap-2.5">
            <Button variant="secondary" className="flex-1" onClick={() => setShowEditModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSaveEditInvitation} disabled={editModalState === "loading"}>
              Save
            </Button>
          </div>
        </Modal>
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
