import { useState, useEffect, useRef } from "react";

type Screen =
  | "signin"
  | "signin-loading"
  | "signin-error"
  | "dashboard"
  | "no-project"
  | "project-detail"
  | "members"
  | "access-denied"
  | "session-expired";

type LoginErrorType =
  | "google-auth-failed"
  | "auth-cancelled"
  | "email-not-verified"
  | "user-not-registered"
  | "account-linking-conflict"
  | "account-unavailable"
  | "system-role-missing"
  | "service-unavailable";

type Role = "ADMIN" | "USER";
type MemberStatus = "ACTIVE" | "INVITED" | "INACTIVE" | "BLOCKED";

interface User {
  email: string;
  role: Role;
}

interface Project {
  id: string;
  name: string;
}

interface Member {
  id: string;
  email: string;
  role: Role;
  status: MemberStatus;
  addedAt: string;
}

const CURRENT_USER: User = {
  email: "user@example.com",
  role: "ADMIN",
};

const PROJECTS: Project[] = [
  { id: "p1", name: "Project A" },
  { id: "p2", name: "Project B" },
  { id: "p3", name: "Project C" },
  { id: "p4", name: "Project D" },
];

const INITIAL_MEMBERS: Member[] = [
  { id: "m1", email: "admin@example.com", role: "ADMIN", status: "ACTIVE", addedAt: "2025-08-10" },
  { id: "m2", email: "user1@example.com", role: "USER", status: "ACTIVE", addedAt: "2025-08-14" },
  { id: "m3", email: "user2@example.com", role: "USER", status: "INVITED", addedAt: "2025-09-01" },
  { id: "m4", email: "user3@example.com", role: "USER", status: "ACTIVE", addedAt: "2025-07-22" },
  { id: "m5", email: "user4@example.com", role: "USER", status: "INACTIVE", addedAt: "2025-06-15" },
];

const ERROR_MESSAGES: Record<LoginErrorType, { title: string; message: string }> = {
  "google-auth-failed": { title: "Google authentication failed", message: "Verify your credentials and try again" },
  "auth-cancelled": { title: "Sign in cancelled", message: "You cancelled the Google sign in process" },
  "email-not-verified": { title: "Email not verified", message: "Your Google account email must be verified" },
  "user-not-registered": { title: "Account not found", message: "Contact administrator to create an account" },
  "account-linking-conflict": { title: "Account conflict", message: "Multiple QC Tool accounts linked to this email" },
  "account-unavailable": { title: "Account unavailable", message: "Your account is suspended or unavailable" },
  "system-role-missing": { title: "Configuration error", message: "Your system role is not properly configured" },
  "service-unavailable": { title: "Service unavailable", message: "Authentication service temporarily down" },
};

function SigningInScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#fff", border: "1px solid #ccc" }}>
      <div style={{ textAlign: "center", border: "1px solid #999", padding: "40px", width: "300px" }}>
        <p>Signing you in...</p>
      </div>
    </div>
  );
}

function SignInErrorScreen({ errorType, onTryAgain }: { errorType: LoginErrorType; onTryAgain: () => void }) {
  const error = ERROR_MESSAGES[errorType];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#fff" }}>
      <div style={{ border: "1px solid #999", padding: "40px", width: "400px" }}>
        <h2>{error.title}</h2>
        <p>{error.message}</p>
        <button onClick={onTryAgain} style={{ padding: "10px 20px", marginRight: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Try Again
        </button>
        <button onClick={onTryAgain} style={{ padding: "10px 20px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Back
        </button>
      </div>
    </div>
  );
}

function SignInScreen({ onSignIn, onError, onStartLoading }: { onSignIn: (hasProjects: boolean) => void; onError: (errorType: LoginErrorType) => void; onStartLoading: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#fff" }}>
      <div style={{ border: "1px solid #999", padding: "40px", width: "400px" }}>
        <h1>QC Tool</h1>
        <p>Sign in with your Google account</p>
        <button onClick={onStartLoading} style={{ width: "100%", padding: "12px", marginBottom: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Sign in with Google
        </button>
        <div style={{ marginTop: "20px", padding: "10px", border: "1px dashed #ccc", backgroundColor: "#f9f9f9" }}>
          <p style={{ fontSize: "11px", color: "#666", margin: "5px 0" }}>*** Development Only - Demo Controls ***</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
            <button onClick={() => onSignIn(true)} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
              Dashboard
            </button>
            <button onClick={() => onSignIn(false)} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
              No Project
            </button>
            <button onClick={() => { onStartLoading(); setTimeout(() => onError("user-not-registered"), 2000); }} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
              Not Registered
            </button>
            <button onClick={() => onError("google-auth-failed")} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
              Auth Failed
            </button>
            <button onClick={() => onError("email-not-verified")} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
              Email Not Verified
            </button>
            <button onClick={() => onError("account-unavailable")} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
              Account Unavailable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ user, onLogout, title, onShowSessionExpired }: { user: User; onLogout: () => void; title: string; onShowSessionExpired?: () => void }) {
  return (
    <div style={{ height: "60px", borderBottom: "1px solid #ccc", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f9f9f9" }}>
      <h2 style={{ margin: 0, fontSize: "18px" }}>{title}</h2>
      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        <span>{user.email} ({user.role})</span>
        {onShowSessionExpired && (
          <button onClick={onShowSessionExpired} style={{ fontSize: "10px", padding: "4px 8px", border: "1px solid #ccc", backgroundColor: "#fff", cursor: "pointer", color: "#666" }}>
            [Test Session Expired]
          </button>
        )}
        <button onClick={onLogout} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Logout
        </button>
      </div>
    </div>
  );
}

function NoProjectScreen({ user, onLogout, onRefresh, onShowSessionExpired }: { user: User; onLogout: () => void; onRefresh: () => void; onShowSessionExpired?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title="QC Tool" onShowSessionExpired={onShowSessionExpired} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", border: "1px solid #ccc", padding: "40px", width: "400px" }}>
          <h2>No Projects Assigned</h2>
          <p>Your account is active but you have not been assigned to any project.</p>
          <p>Contact your administrator to request access to a project.</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button onClick={onRefresh} style={{ flex: 1, padding: "10px 20px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectListScreen({ user, projects, onSelectProject, onLogout, onShowSessionExpired }: { user: User; projects: Project[]; onSelectProject: (id: string) => void; onLogout: () => void; onShowSessionExpired?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title="Projects" onShowSessionExpired={onShowSessionExpired} />
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        <h2>Projects</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #000" }}>
              <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Name</th>
              <th style={{ padding: "10px", borderBottom: "1px solid #ccc", textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: "10px" }}>{p.name}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>
                  <button onClick={() => onSelectProject(p.id)} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectDetailScreen({ user, project, onBack, onLogout, onMembersClick, onShowSessionExpired }: { user: User; project: Project; onBack: () => void; onLogout: () => void; onMembersClick: () => void; onShowSessionExpired?: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "members">("overview");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title={project.name} onShowSessionExpired={onShowSessionExpired} />
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc" }}>
        <button onClick={onBack} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", marginRight: "10px" }}>
          ← Back
        </button>
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
            <h3>{project.name}</h3>
            <p style={{ color: "#666", fontSize: "12px" }}>[Project details to be confirmed]</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MembersScreen({ user, members, onBack, onLogout, onAddMember, onEditMember, onCancelMember, onShowSessionExpired }: { user: User; members: Member[]; onBack: () => void; onLogout: () => void; onAddMember: (email: string) => void; onEditMember: (id: string, email: string) => void; onCancelMember: (id: string) => void; onShowSessionExpired?: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalState, setAddModalState] = useState<"default" | "loading" | "success" | "invalid" | "duplicate" | "error">("default");
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
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
        <button onClick={() => { setShowAddModal(true); setAddModalState("default"); setNewEmail(""); }} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", marginLeft: "auto" }}>
          + Add Member
        </button>
      </div>
      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #000" }}>
              <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Email</th>
              <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Role</th>
              <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Status</th>
              <th style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: "10px" }}>{m.email}</td>
                <td style={{ padding: "10px" }}>{m.role}</td>
                <td style={{ padding: "10px" }}>{m.status}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>
                  {m.status === "INVITED" && (
                    <>
                      <button onClick={() => { setShowEditModal(m.id); setEditEmail(m.email); }} style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", marginRight: "5px" }}>
                        Edit
                      </button>
                      <button onClick={() => setShowCancelModal(m.id)} style={{ padding: "4px 8px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
                        Cancel
                      </button>
                    </>
                  )}
                </td>
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
    </div>
  );
}

function AccessDeniedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#fff" }}>
      <div style={{ border: "1px solid #999", padding: "40px", width: "400px", textAlign: "center" }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to access this resource.</p>
        <button onClick={onBack} style={{ padding: "10px 20px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Go Back
        </button>
      </div>
    </div>
  );
}

function SessionExpiredModal({ onSignInAgain }: { onSignInAgain: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999 }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "30px", width: "400px", textAlign: "center" }}>
        <h2>Session Expired</h2>
        <p>Your session has expired. Please sign in again.</p>
        <button onClick={onSignInAgain} style={{ width: "100%", padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Sign in again
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("signin");
  const [loginError, setLoginError] = useState<LoginErrorType | null>(null);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  function handleAddMember(email: string) {
    const newMember: Member = {
      id: `m${Date.now()}`,
      email: email.toLowerCase(),
      role: "USER",
      status: "INVITED",
      addedAt: new Date().toISOString().split("T")[0],
    };
    setMembers([...members, newMember]);
  }

  function handleEditMember(id: string, email: string) {
    setMembers(members.map((m) => (m.id === id ? { ...m, email } : m)));
  }

  function handleCancelMember(id: string) {
    setMembers(members.filter((m) => m.id !== id));
  }

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      {screen === "signin" && <SignInScreen onSignIn={(has) => setScreen(has ? "dashboard" : "no-project")} onError={(err) => { setLoginError(err); setScreen("signin-error"); }} onStartLoading={() => setScreen("signin-loading")} />}

      {screen === "signin-loading" && <SigningInScreen />}

      {screen === "signin-error" && loginError && <SignInErrorScreen errorType={loginError} onTryAgain={() => setScreen("signin")} />}

      {screen === "dashboard" && <ProjectListScreen user={CURRENT_USER} projects={PROJECTS} onSelectProject={() => setScreen("project-detail")} onLogout={() => setScreen("signin")} onShowSessionExpired={() => setShowSessionExpired(true)} />}

      {screen === "no-project" && <NoProjectScreen user={CURRENT_USER} onLogout={() => setScreen("signin")} onRefresh={() => {}} onShowSessionExpired={() => setShowSessionExpired(true)} />}

      {screen === "project-detail" && <ProjectDetailScreen user={CURRENT_USER} project={PROJECTS[0]} onBack={() => setScreen("dashboard")} onLogout={() => setScreen("signin")} onMembersClick={() => setScreen("members")} onShowSessionExpired={() => setShowSessionExpired(true)} />}

      {screen === "members" && <MembersScreen user={CURRENT_USER} members={members} onBack={() => setScreen("project-detail")} onLogout={() => setScreen("signin")} onAddMember={handleAddMember} onEditMember={handleEditMember} onCancelMember={handleCancelMember} onShowSessionExpired={() => setShowSessionExpired(true)} />}

      {screen === "access-denied" && <AccessDeniedScreen onBack={() => setScreen("dashboard")} />}

      {showSessionExpired && <SessionExpiredModal onSignInAgain={() => { setShowSessionExpired(false); setScreen("signin"); }} />}
    </div>
  );
}
