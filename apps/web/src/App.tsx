import { useEffect, useRef, useState } from "react";
import { useAuth } from "./features/auth/useAuth";
import { ERROR_MESSAGES, type LoginErrorType } from "./features/auth/auth.types";
import { Header } from "./components/Header";
import { ProjectListScreen } from "./features/projects/ProjectListScreen";
import { ProjectDetailScreen } from "./features/projects/ProjectDetailScreen";
import { MembersScreen } from "./features/projects/MembersScreen";
import type { Member, Project, Role } from "./features/projects/projects.types";

// Post-authentication navigation only. Sign-in sub-states ("signin",
// "signin-loading", "signin-error") now live in useAuth's AuthScreen instead.
type Screen = "dashboard" | "no-project" | "project-detail" | "members" | "access-denied";

interface User {
  email: string;
  role: Role;
}

// Prototype-only demo identity — NOT an authenticated user. Used solely to
// populate the "Development Only - Demo Controls" bypass below, which is
// gated to import.meta.env.DEV and never used for the real auth path.
const DEMO_USER: User = {
  email: "user@example.com",
  role: "ADMIN",
};

const INITIAL_PROJECTS: Project[] = [
  { id: "p1", name: "Project A", description: "First demo project.", status: "ACTIVE", deletedAt: null },
  { id: "p2", name: "Project B", description: "Second demo project.", status: "ACTIVE", deletedAt: null },
  { id: "p3", name: "Project C", description: "Currently inactive demo project.", status: "INACTIVE", deletedAt: null },
  { id: "p4", name: "Project D", description: "Fourth demo project.", status: "ACTIVE", deletedAt: null },
];

const INITIAL_MEMBERS: Member[] = [
  { id: "m1", email: "admin@example.com", role: "ADMIN", status: "ACTIVE", addedAt: "2025-08-10" },
  { id: "m2", email: "user1@example.com", role: "USER", status: "ACTIVE", addedAt: "2025-08-14" },
  { id: "m3", email: "user2@example.com", role: "USER", status: "INVITED", addedAt: "2025-09-01" },
  { id: "m4", email: "user3@example.com", role: "USER", status: "ACTIVE", addedAt: "2025-07-22" },
  { id: "m5", email: "user4@example.com", role: "USER", status: "INACTIVE", addedAt: "2025-06-15" },
];

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

function SignInScreen({
  onSignIn,
  onError,
  onStartLoading,
  showDemoControls,
}: {
  onSignIn: (hasProjects: boolean) => void;
  onError: (errorType: LoginErrorType) => void;
  onStartLoading: () => void;
  showDemoControls: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#fff" }}>
      <div style={{ border: "1px solid #999", padding: "40px", width: "400px" }}>
        <h1>QC Tool</h1>
        <p>Sign in with your Google account</p>
        <button onClick={onStartLoading} style={{ width: "100%", padding: "12px", marginBottom: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Sign in with Google
        </button>
        {showDemoControls && (
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
        )}
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
  const auth = useAuth();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Demo-mode bypass state (dev only) — completely independent of `auth` so
  // demo controls can never be mistaken for evidence of real authentication.
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [demoPhase, setDemoPhase] = useState<"idle" | "loading" | "error">("idle");
  const [demoError, setDemoError] = useState<LoginErrorType | null>(null);

  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (auth.user && !wasAuthenticated.current) {
      // A fresh real sign-in always lands on the (mocked) project dashboard —
      // Project/Member data isn't wired to a real backend in this milestone.
      wasAuthenticated.current = true;
      setScreen("dashboard");
    }
    if (!auth.user) {
      wasAuthenticated.current = false;
    }
  }, [auth.user]);

  const activeUser: User | null = auth.user ? { email: auth.user.email, role: auth.user.systemRole } : demoUser;

  function handleLogout() {
    setDemoUser(null);
    setDemoPhase("idle");
    setScreen("dashboard");
    void auth.signOut();
  }

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

  function handleRemoveMember(id: string) {
    setMembers(members.filter((m) => m.id !== id));
  }

  function handleCreateProject(name: string, description: string) {
    const newProject: Project = {
      id: `p${Date.now()}`,
      name,
      description,
      status: "ACTIVE",
      deletedAt: null,
    };
    setProjects([...projects, newProject]);
  }

  function handleEditProject(id: string, name: string, description: string) {
    setProjects(projects.map((p) => (p.id === id ? { ...p, name, description } : p)));
  }

  function handleToggleProjectStatus(id: string) {
    setProjects(projects.map((p) => (p.id === id ? { ...p, status: p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : p)));
  }

  function handleDeleteProject(id: string) {
    setProjects(projects.map((p) => (p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p)));
  }

  if (!activeUser) {
    const showingDemoLoading = demoPhase === "loading";
    const showingDemoError = demoPhase === "error" && demoError;

    return (
      <div style={{ height: "100vh", overflow: "hidden" }}>
        {showingDemoLoading && <SigningInScreen />}

        {showingDemoError && <SignInErrorScreen errorType={demoError} onTryAgain={() => setDemoPhase("idle")} />}

        {!showingDemoLoading && !showingDemoError && auth.screen === "signin" && (
          <SignInScreen
            onSignIn={(has) => { setDemoUser({ ...DEMO_USER }); setScreen(has ? "dashboard" : "no-project"); }}
            onError={(err) => { setDemoError(err); setDemoPhase("error"); }}
            onStartLoading={auth.signInWithGoogle}
            showDemoControls={import.meta.env.DEV}
          />
        )}

        {!showingDemoLoading && !showingDemoError && auth.screen === "signin-loading" && <SigningInScreen />}

        {!showingDemoLoading && !showingDemoError && auth.screen === "signin-error" && auth.loginError && (
          <SignInErrorScreen errorType={auth.loginError} onTryAgain={auth.retryFromError} />
        )}

        {auth.sessionExpired && <SessionExpiredModal onSignInAgain={auth.dismissSessionExpired} />}
      </div>
    );
  }

  const onShowSessionExpired = import.meta.env.DEV ? auth.debugShowSessionExpired : undefined;
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      {screen === "dashboard" && (
        <ProjectListScreen
          user={activeUser}
          projects={projects}
          onSelectProject={(id) => { setSelectedProjectId(id); setScreen("project-detail"); }}
          onCreateProject={handleCreateProject}
          onLogout={handleLogout}
          onShowSessionExpired={onShowSessionExpired}
        />
      )}

      {screen === "no-project" && <NoProjectScreen user={activeUser} onLogout={handleLogout} onRefresh={() => {}} onShowSessionExpired={onShowSessionExpired} />}

      {screen === "project-detail" && selectedProject && (
        <ProjectDetailScreen
          user={activeUser}
          project={selectedProject}
          onBack={() => setScreen("dashboard")}
          onLogout={handleLogout}
          onMembersClick={() => setScreen("members")}
          onEditProject={handleEditProject}
          onToggleStatus={handleToggleProjectStatus}
          onDeleteProject={handleDeleteProject}
          onShowSessionExpired={onShowSessionExpired}
        />
      )}

      {screen === "members" && (
        <MembersScreen
          user={activeUser}
          projectName={selectedProject?.name ?? ""}
          members={members}
          onBack={() => setScreen("project-detail")}
          onLogout={handleLogout}
          onAddMember={handleAddMember}
          onEditMember={handleEditMember}
          onCancelMember={handleCancelMember}
          onRemoveMember={handleRemoveMember}
          onShowSessionExpired={onShowSessionExpired}
        />
      )}

      {screen === "access-denied" && <AccessDeniedScreen onBack={() => setScreen("dashboard")} />}

      {auth.sessionExpired && <SessionExpiredModal onSignInAgain={auth.dismissSessionExpired} />}
    </div>
  );
}
