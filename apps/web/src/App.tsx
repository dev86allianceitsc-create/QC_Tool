import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "./features/auth/useAuth";
import { ERROR_MESSAGES, type LoginErrorType } from "./features/auth/auth.types";
import { Header } from "./components/Header";
import { AppShell } from "./components/AppShell";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { ProjectListScreen } from "./features/projects/ProjectListScreen";
import { ProjectDetailScreen } from "./features/projects/ProjectDetailScreen";
import { MembersScreen } from "./features/projects/MembersScreen";
import { ProjectLayout, type ProjectLayoutContext } from "./features/projects/ProjectLayout";
import type { Role } from "./features/projects/projects.types";
import { AuditLogScreen } from "./features/audit/AuditLogScreen";
import { ApiDetailScreen } from "./features/apiEnvironment/ApiDetailScreen";
import { ApiListScreen } from "./features/apiEnvironment/ApiListScreen";
import { EnvironmentListScreen } from "./features/apiEnvironment/EnvironmentListScreen";
import { BatchRunPreparationScreen, type BatchDraftSnapshot } from "./features/apiEnvironment/BatchRunPreparationScreen";
import { RunResultScreen } from "./features/apiEnvironment/RunResultScreen";
import { ExecutionDetailScreen } from "./features/apiEnvironment/ExecutionDetailScreen";
import { ProjectTestRunsScreen } from "./features/apiEnvironment/ProjectTestRunsScreen";
import { SnapshotHistoryScreen } from "./features/snapshot/SnapshotHistoryScreen";
import { SnapshotDetailScreen } from "./features/snapshot/SnapshotDetailScreen";

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

// Thin route-level adapters: pull Project chrome context (from ProjectLayout's
// <Outlet context={...}>) and URL params, then render the existing screens
// with the same props they always took — only the navigation wiring changes.

function ProjectOverviewRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const navigate = useNavigate();
  return (
    <ProjectDetailScreen
      user={ctx.user}
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onBack={() => navigate("/projects")}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function ApiListRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const navigate = useNavigate();
  return (
    <ApiListScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      accessToken={ctx.accessToken}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onSelectApi={(apiId) => navigate(`/projects/${ctx.projectId}/apis/${apiId}`)}
      onRunSelected={(apiIds, environmentId) =>
        navigate(`/projects/${ctx.projectId}/batch/prepare`, { state: { apiIds, environmentId } })
      }
    />
  );
}

function BatchRunPreparationRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { apiIds?: string[]; environmentId?: string; draft?: BatchDraftSnapshot } | null;
  const apiIds = state?.apiIds;
  const environmentId = state?.environmentId;

  if (!apiIds || apiIds.length === 0 || !environmentId) {
    return (
      <div className="p-6">
        <p className="m-0 mb-3 text-sm text-muted">
          No APIs were selected for this Batch Run, or the selection was lost (for example, after a page refresh).
        </p>
        <button
          onClick={() => navigate(`/projects/${ctx.projectId}/apis`)}
          className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline"
        >
          Back to API List
        </button>
      </div>
    );
  }

  return (
    <BatchRunPreparationScreen
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      apiIds={apiIds}
      environmentId={environmentId}
      accessToken={ctx.accessToken}
      initialDraft={state?.draft ?? null}
      onBack={() => navigate(`/projects/${ctx.projectId}/apis`)}
      onOpenConfiguration={(apiId, snapshot) =>
        navigate(`/projects/${ctx.projectId}/apis/${apiId}`, {
          state: {
            returnTo: {
              pathname: `/projects/${ctx.projectId}/batch/prepare`,
              state: { apiIds: snapshot.apiIds, environmentId: snapshot.environmentId, draft: snapshot },
            },
          },
        })
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onExecuted={(runId) => navigate(`/projects/${ctx.projectId}/runs/${runId}`)}
    />
  );
}

function ProjectTestRunsRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const navigate = useNavigate();
  return (
    <ProjectTestRunsScreen
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onViewRun={(runId) => navigate(`/projects/${ctx.projectId}/runs/${runId}`)}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function RunResultRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  if (!runId) return <Navigate to={`/projects/${ctx.projectId}/apis`} replace />;
  return (
    <RunResultScreen
      projectId={ctx.projectId}
      runId={runId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/apis`)}
      onViewAllRuns={() => navigate(`/projects/${ctx.projectId}/runs`)}
      onViewExecution={(executionId) => navigate(`/projects/${ctx.projectId}/runs/${runId}/executions/${executionId}`)}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function ExecutionDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const { runId, executionId } = useParams<{ runId: string; executionId: string }>();
  const navigate = useNavigate();
  if (!runId || !executionId) return <Navigate to={`/projects/${ctx.projectId}/apis`} replace />;
  return (
    <ExecutionDetailScreen
      projectId={ctx.projectId}
      runId={runId}
      executionId={executionId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/runs/${runId}`)}
      onViewSnapshot={(snapshotId) => navigate(`/projects/${ctx.projectId}/snapshots/${snapshotId}`)}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function SnapshotHistoryRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const navigate = useNavigate();
  return (
    <SnapshotHistoryScreen
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onViewSnapshot={(snapshotId) => navigate(`/projects/${ctx.projectId}/snapshots/${snapshotId}`)}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function SnapshotDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const { snapshotId } = useParams<{ snapshotId: string }>();
  const navigate = useNavigate();
  if (!snapshotId) return <Navigate to={`/projects/${ctx.projectId}/snapshots`} replace />;
  return (
    <SnapshotDetailScreen
      projectId={ctx.projectId}
      snapshotId={snapshotId}
      accessToken={ctx.accessToken}
      user={ctx.user}
      onBack={() => navigate(`/projects/${ctx.projectId}/snapshots`)}
      onViewSourceExecution={(runId, executionId) =>
        navigate(`/projects/${ctx.projectId}/runs/${runId}/executions/${executionId}`)
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function ApiDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  const { apiId } = useParams<{ apiId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: { pathname: string; state: unknown } } | null)?.returnTo ?? null;
  if (!apiId) return <Navigate to={`/projects/${ctx.projectId}/apis`} replace />;
  return (
    <ApiDetailScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      apiId={apiId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/apis`)}
      onViewExecution={(runId, executionId) => navigate(`/projects/${ctx.projectId}/runs/${runId}/executions/${executionId}`)}
      onViewAllRuns={() => navigate(`/projects/${ctx.projectId}/runs`)}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onBackToBatch={returnTo ? () => navigate(returnTo.pathname, { state: returnTo.state }) : undefined}
    />
  );
}

function EnvironmentListRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  return (
    <EnvironmentListScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      accessToken={ctx.accessToken}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function MembersRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>();
  return (
    <MembersScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectName={ctx.projectName}
      accessToken={ctx.accessToken}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  );
}

function AuthenticatedApp({
  activeUser,
  isAdmin,
  accessToken,
  onLogout,
  onShowSessionExpired,
  onSessionExpired,
  sessionExpired,
  onSignInAgain,
}: {
  activeUser: User;
  isAdmin: boolean;
  accessToken: string | null;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
  sessionExpired: boolean;
  onSignInAgain: () => void;
}) {
  return (
    <BrowserRouter>
      <AuthenticatedRoutes
        activeUser={activeUser}
        isAdmin={isAdmin}
        accessToken={accessToken}
        onLogout={onLogout}
        onShowSessionExpired={onShowSessionExpired}
        onSessionExpired={onSessionExpired}
      />
      {sessionExpired && <SessionExpiredModal onSignInAgain={onSignInAgain} />}
    </BrowserRouter>
  );
}

function AuthenticatedRoutes({
  activeUser,
  isAdmin,
  accessToken,
  onLogout,
  onShowSessionExpired,
  onSessionExpired,
}: {
  activeUser: User;
  isAdmin: boolean;
  accessToken: string | null;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
}) {
  const navigate = useNavigate();
  const onAccessDenied = () => navigate("/access-denied");

  return (
    <Routes>
      <Route element={<AppShell isAdmin={isAdmin} />}>
        <Route
          index
          element={
            <DashboardScreen
              user={activeUser}
              accessToken={accessToken}
              onLogout={onLogout}
              onShowSessionExpired={onShowSessionExpired}
              onSessionExpired={onSessionExpired}
              onAccessDenied={onAccessDenied}
            />
          }
        />

        <Route
          path="projects"
          element={
            <ProjectListScreen
              user={activeUser}
              accessToken={accessToken}
              onSelectProject={(id) => navigate(`/projects/${id}`)}
              onLogout={onLogout}
              onShowSessionExpired={onShowSessionExpired}
              onSessionExpired={onSessionExpired}
              onAccessDenied={onAccessDenied}
            />
          }
        />

        <Route
          path="audit-log"
          element={
            isAdmin ? (
              <AuditLogScreen
                user={activeUser}
                accessToken={accessToken}
                onBack={() => navigate("/")}
                onLogout={onLogout}
                onShowSessionExpired={onShowSessionExpired}
                onSessionExpired={onSessionExpired}
                onAccessDenied={onAccessDenied}
              />
            ) : (
              <AccessDeniedScreen onBack={() => navigate("/")} />
            )
          }
        />

        <Route
          path="projects/:projectId"
          element={
            <ProjectLayout
              user={activeUser}
              accessToken={accessToken}
              onLogout={onLogout}
              onShowSessionExpired={onShowSessionExpired}
              onSessionExpired={onSessionExpired}
              onAccessDenied={onAccessDenied}
            />
          }
        >
          <Route index element={<ProjectOverviewRoute />} />
          <Route path="apis" element={<ApiListRoute />} />
          <Route path="apis/:apiId" element={<ApiDetailRoute />} />
          <Route path="batch/prepare" element={<BatchRunPreparationRoute />} />
          <Route path="runs" element={<ProjectTestRunsRoute />} />
          <Route path="runs/:runId" element={<RunResultRoute />} />
          <Route path="runs/:runId/executions/:executionId" element={<ExecutionDetailRoute />} />
          <Route path="snapshots" element={<SnapshotHistoryRoute />} />
          <Route path="snapshots/:snapshotId" element={<SnapshotDetailRoute />} />
          <Route path="environments" element={<EnvironmentListRoute />} />
          <Route path="members" element={<MembersRoute />} />
        </Route>
      </Route>

      <Route path="/access-denied" element={<AccessDeniedScreen onBack={() => navigate("/")} />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const auth = useAuth();
  const [demoPhase, setDemoPhase] = useState<"idle" | "loading" | "error">("idle");
  const [demoError, setDemoError] = useState<LoginErrorType | null>(null);

  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (auth.user && !wasAuthenticated.current) {
      wasAuthenticated.current = true;
    }
    if (!auth.user) {
      wasAuthenticated.current = false;
    }
  }, [auth.user]);

  const activeUser: User | null = auth.user ? { email: auth.user.email, role: auth.user.systemRole } : null;

  function handleLogout() {
    setDemoPhase("idle");
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

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      <AuthenticatedApp
        activeUser={activeUser}
        isAdmin={isAdmin}
        accessToken={auth.accessToken}
        onLogout={handleLogout}
        onShowSessionExpired={onShowSessionExpired}
        onSessionExpired={auth.reportSessionExpired}
        sessionExpired={auth.sessionExpired}
        onSignInAgain={auth.dismissSessionExpired}
      />
    </div>
  );
}
