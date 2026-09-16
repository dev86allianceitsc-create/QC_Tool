import { useEffect, useRef, useState } from "react";
import { useAuth } from "./features/auth/useAuth";
import { ERROR_MESSAGES, type LoginErrorType } from "./features/auth/auth.types";
import { Header } from "./components/Header";
import { ProjectListScreen } from "./features/projects/ProjectListScreen";
import { ProjectDetailScreen } from "./features/projects/ProjectDetailScreen";
import { MembersScreen } from "./features/projects/MembersScreen";
import type { Role } from "./features/projects/projects.types";
import { AuditLogScreen } from "./features/audit/AuditLogScreen";

// Post-authentication navigation only. Sign-in sub-states ("signin",
// "signin-loading", "signin-error") now live in useAuth's AuthScreen instead.
type Screen = "dashboard" | "project-detail" | "members" | "access-denied" | "audit-log";

interface User {
  email: string;
  role: Role;
}

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
  onError,
  onStartLoading,
  showDemoControls,
}: {
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState("");

  // Demo-mode bypass state (dev only) — completely independent of `auth` so
  // demo controls can never be mistaken for evidence of real authentication.
  const [demoPhase, setDemoPhase] = useState<"idle" | "loading" | "error">("idle");
  const [demoError, setDemoError] = useState<LoginErrorType | null>(null);

  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (auth.user && !wasAuthenticated.current) {
      wasAuthenticated.current = true;
      setScreen("dashboard");
    }
    if (!auth.user) {
      wasAuthenticated.current = false;
    }
  }, [auth.user]);

  const activeUser: User | null = auth.user ? { email: auth.user.email, role: auth.user.systemRole } : null;

  function handleLogout() {
    setDemoPhase("idle");
    setScreen("dashboard");
    void auth.signOut();
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
  const isAdmin = activeUser.role === "ADMIN";
  const onSessionExpired = auth.reportSessionExpired;
  const onAccessDenied = () => setScreen("access-denied");

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      {screen === "dashboard" && (
        <ProjectListScreen
          user={activeUser}
          accessToken={auth.accessToken}
          onSelectProject={(id) => { setSelectedProjectId(id); setScreen("project-detail"); }}
          onLogout={handleLogout}
          onShowSessionExpired={onShowSessionExpired}
          onNavigateAuditLogs={() => setScreen("audit-log")}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
        />
      )}

      {screen === "project-detail" && selectedProjectId && (
        <ProjectDetailScreen
          user={activeUser}
          projectId={selectedProjectId}
          accessToken={auth.accessToken}
          onBack={() => setScreen("dashboard")}
          onLogout={handleLogout}
          onMembersClick={(projectName) => { setSelectedProjectName(projectName); setScreen("members"); }}
          onShowSessionExpired={onShowSessionExpired}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
        />
      )}

      {screen === "members" && selectedProjectId && (
        <MembersScreen
          user={activeUser}
          projectId={selectedProjectId}
          projectName={selectedProjectName}
          accessToken={auth.accessToken}
          onBack={() => setScreen("project-detail")}
          onLogout={handleLogout}
          onShowSessionExpired={onShowSessionExpired}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
        />
      )}

      {screen === "audit-log" && (isAdmin ? (
        <AuditLogScreen
          user={activeUser}
          accessToken={auth.accessToken}
          onBack={() => setScreen("dashboard")}
          onLogout={handleLogout}
          onShowSessionExpired={onShowSessionExpired}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
        />
      ) : (
        <AccessDeniedScreen onBack={() => setScreen("dashboard")} />
      ))}

      {screen === "access-denied" && <AccessDeniedScreen onBack={() => setScreen("dashboard")} />}

      {auth.sessionExpired && <SessionExpiredModal onSignInAgain={auth.dismissSessionExpired} />}
    </div>
  );
}
