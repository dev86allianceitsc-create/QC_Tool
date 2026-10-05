import { useEffect, useRef } from "react"

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom"

import { useAuth } from "./features/auth/useAuth"

import { ERROR_MESSAGES, type LoginErrorType } from "./features/auth/auth.types"

import { Header } from "./components/Header"

import { AppShell } from "./components/AppShell"

import { Button } from "./components/ui/Button"

import allianceLogo from "./assets/alliance-logo.png"

import { DashboardScreen } from "./features/dashboard/DashboardScreen"

import { ProjectListScreen } from "./features/projects/ProjectListScreen"

import { ProjectDetailScreen } from "./features/projects/ProjectDetailScreen"

import { IgnoreRulesScreen } from "./features/projects/IgnoreRulesScreen"

import { MembersScreen } from "./features/projects/MembersScreen"

import {
  ProjectLayout,
  type ProjectLayoutContext,
} from "./features/projects/ProjectLayout"

import type { Role } from "./features/projects/projects.types"

import { AuditLogScreen } from "./features/audit/AuditLogScreen"

import { ApiDetailScreen } from "./features/apiEnvironment/ApiDetailScreen"

import { ApiListScreen } from "./features/apiEnvironment/ApiListScreen"

import { EnvironmentListScreen } from "./features/apiEnvironment/EnvironmentListScreen"

import { EnvironmentAuthenticationScreen } from "./features/apiEnvironment/EnvironmentAuthenticationScreen"

import type { RunRequestValues } from "./features/apiEnvironment/requestInput.types"

import {
  BatchRunPreparationScreen,
  type BatchDraftSnapshot,
} from "./features/apiEnvironment/BatchRunPreparationScreen"

import { RunResultScreen } from "./features/apiEnvironment/RunResultScreen"

import { ExecutionDetailScreen } from "./features/apiEnvironment/ExecutionDetailScreen"

import { ProjectTestRunsScreen } from "./features/apiEnvironment/ProjectTestRunsScreen"

import { SnapshotHistoryScreen } from "./features/snapshot/SnapshotHistoryScreen"

import { SnapshotDetailScreen } from "./features/snapshot/SnapshotDetailScreen"

import { ComparisonHistoryScreen } from "./features/comparison/ComparisonHistoryScreen"

import { ComparisonDetailScreen } from "./features/comparison/ComparisonDetailScreen"

import { ChainDetailScreen } from "./features/comparison/ChainDetailScreen"

interface User {
  email: string

  role: Role
}

// Tiny hand-rolled inline SVGs for the pre-auth screens — same rationale as
// features/snapshot/snapshotIcons.tsx: no icon library dependency for a
// handful of glyphs. GoogleIcon keeps Google's real brand colors (not
// currentColor) since that's the standard, recognizable "Sign in with
// Google" mark.
function GoogleIcon({ className = "h-4.5 w-4.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.38a4.6 4.6 0 01-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.31z"
      />
      <path
        fill="#34A853"
        d="M10 20c2.7 0 4.96-.89 6.61-2.42l-3.23-2.5c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H1.08v2.59A10 10 0 0010 20z"
      />
      <path
        fill="#FBBC05"
        d="M4.41 11.92a6 6 0 010-3.84V5.49H1.08a10 10 0 000 9.02l3.33-2.59z"
      />
      <path
        fill="#EA4335"
        d="M10 3.96c1.47 0 2.79.5 3.82 1.49l2.86-2.86C14.95.99 12.7 0 10 0A10 10 0 001.08 5.49l3.33 2.59C5.2 5.72 7.4 3.96 10 3.96z"
      />
    </svg>
  )
}

function WarningIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 3l8.5 14.5h-17L10 3z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M10 8.5v3.5" strokeLinecap="round" />
      <circle cx="10" cy="14.75" r="0.1" fill="currentColor" />
    </svg>
  )
}

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden="true"
    >
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" strokeLinejoin="round" />
      <path d="M6.5 9V6a3.5 3.5 0 017 0v3" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6v4l2.75 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SigningInScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-white px-10 py-12 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
        <p className="m-0 text-sm text-muted">Signing you in...</p>
      </div>
    </div>
  )
}

function SignInErrorScreen({
  errorType,
  onTryAgain,
}: {
  errorType: LoginErrorType
  onTryAgain: () => void
}) {
  const error = ERROR_MESSAGES[errorType]

  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-error-light text-error">
          <WarningIcon />
        </div>
        <h2 className="m-0 mb-2 text-lg font-semibold text-gray-900">
          {error.title}
        </h2>
        <p className="m-0 mb-6 text-sm text-muted">{error.message}</p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={onTryAgain} className="flex-1">
            Try Again
          </Button>
          <Button variant="secondary" onClick={onTryAgain} className="flex-1">
            Back
          </Button>
        </div>
      </div>
    </div>
  )
}

function SignInScreen({
  onStartLoading,
}: {
  onStartLoading: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-surface px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-lg sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={allianceLogo}
            alt="Alliance"
            className="mb-6 h-8 w-auto"
          />
          <h1 className="m-0 text-2xl font-semibold text-gray-900">
            QC Tool
          </h1>
          <p className="m-0 mt-2 text-sm text-muted">
            API Quality &amp; Comparison Platform
          </p>
        </div>
        <button
          onClick={onStartLoading}
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-border bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <GoogleIcon className="h-5 w-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

function AccessDeniedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-error-light text-error">
          <LockIcon />
        </div>
        <h2 className="m-0 mb-2 text-lg font-semibold text-gray-900">
          Access Denied
        </h2>
        <p className="m-0 mb-6 text-sm text-muted">
          You do not have permission to access this resource.
        </p>
        <Button variant="primary" onClick={onBack} className="w-full">
          Go Back
        </Button>
      </div>
    </div>
  )
}

function SessionExpiredModal({ onSignInAgain }: { onSignInAgain: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-warning-light text-warning">
          <ClockIcon />
        </div>
        <h2 className="m-0 mb-2 text-lg font-semibold text-gray-900">
          Session Expired
        </h2>
        <p className="m-0 mb-6 text-sm text-muted">
          Your session has expired. Please sign in again.
        </p>
        <Button variant="primary" onClick={onSignInAgain} className="w-full">
          Sign in again
        </Button>
      </div>
    </div>
  )
}

// Thin route-level adapters: pull Project chrome context (from ProjectLayout's

// <Outlet context={...}>) and URL params, then render the existing screens

// with the same props they always took — only the navigation wiring changes.

function ProjectOverviewRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const navigate = useNavigate()

  return (
    <ProjectDetailScreen
      user={ctx.user}
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onBack={() => navigate("/projects")}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onNavigateToMembers={() =>
        navigate(`/projects/${ctx.projectId}/members`)
      }
      onNavigateToEnvironments={() =>
        navigate(`/projects/${ctx.projectId}/environments`)
      }
    />
  )
}

function ApiListRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const navigate = useNavigate()

  return (
    <ApiListScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      accessToken={ctx.accessToken}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onSelectApi={(apiId) =>
        navigate(`/projects/${ctx.projectId}/apis/${apiId}`)
      }
      onSelectApiForRun={(apiId, runValues) =>
        navigate(`/projects/${ctx.projectId}/apis/${apiId}`, {
          state: { initialArea: "run", initialRunValues: runValues },
        })
      }
      onRunSelected={(apiIds, environmentId) =>
        navigate(`/projects/${ctx.projectId}/batch/prepare`, {
          state: { apiIds, environmentId },
        })
      }
    />
  )
}

function BatchRunPreparationRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const navigate = useNavigate()

  const location = useLocation()

  const state = location.state as {
    apiIds?: string[]
    environmentId?: string
    draft?: BatchDraftSnapshot
  } | null

  const apiIds = state?.apiIds

  const environmentId = state?.environmentId

  if (!apiIds || apiIds.length === 0 || !environmentId) {
    return (
      <div className="p-6">
        <p className="m-0 mb-3 text-sm text-muted">
          No APIs were selected for this Batch Run, or the selection was lost
          (for example, after a page refresh).
        </p>
        <button
          onClick={() => navigate(`/projects/${ctx.projectId}/apis`)}
          className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline"
        >
          Back to API List
        </button>
      </div>
    )
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

              state: {
                apiIds: snapshot.apiIds,
                environmentId: snapshot.environmentId,
                draft: snapshot,
              },
            },
          },
        })
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onExecuted={(runId) =>
        navigate(`/projects/${ctx.projectId}/runs/${runId}`)
      }
    />
  )
}

function ProjectTestRunsRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const navigate = useNavigate()

  return (
    <ProjectTestRunsScreen
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onViewRun={(runId) =>
        navigate(`/projects/${ctx.projectId}/runs/${runId}`)
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function RunResultRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const { runId } = useParams<{ runId: string }>()

  const navigate = useNavigate()

  if (!runId) return <Navigate to={`/projects/${ctx.projectId}/apis`} replace />

  return (
    <RunResultScreen
      projectId={ctx.projectId}
      runId={runId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/apis`)}
      onViewAllRuns={() => navigate(`/projects/${ctx.projectId}/runs`)}
      onViewExecution={(executionId) =>
        navigate(
          `/projects/${ctx.projectId}/runs/${runId}/executions/${executionId}`,
        )
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function ExecutionDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const { runId, executionId } = useParams<{
    runId: string
    executionId: string
  }>()

  const navigate = useNavigate()

  const location = useLocation()

  // Reached from the API's Run History tab (Test Case card "Run Again"/"View
  // History"), the generic "/runs/:runId" Run Result screen is the wrong
  // place to land on Back — it's a screen the user never visited. Carry the
  // real origin through navigation state so Back returns there instead; any
  // route that doesn't set this keeps the previous runs/:runId fallback.
  const returnTo =
    (
      location.state as {
        returnTo?: { pathname: string; state?: unknown }
      } | null
    )?.returnTo ?? null

  if (!runId || !executionId)
    return <Navigate to={`/projects/${ctx.projectId}/apis`} replace />

  return (
    <ExecutionDetailScreen
      projectId={ctx.projectId}
      runId={runId}
      executionId={executionId}
      accessToken={ctx.accessToken}
      onBack={() =>
        returnTo
          ? navigate(returnTo.pathname, { state: returnTo.state })
          : navigate(`/projects/${ctx.projectId}/runs/${runId}`)
      }
      onViewSnapshot={(snapshotId) =>
        navigate(`/projects/${ctx.projectId}/snapshots/${snapshotId}`)
      }
      onViewComparison={(comparisonId) =>
        navigate(`/projects/${ctx.projectId}/comparisons/${comparisonId}`)
      }
      onRerunComplete={(newRunId, newExecutionId) =>
        navigate(
          `/projects/${ctx.projectId}/runs/${newRunId}/executions/${newExecutionId}`,
          returnTo ? { state: { returnTo } } : undefined,
        )
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function SnapshotHistoryRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const navigate = useNavigate()

  return (
    <SnapshotHistoryScreen
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onViewSnapshot={(snapshotId) =>
        navigate(`/projects/${ctx.projectId}/snapshots/${snapshotId}`)
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function SnapshotDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const { snapshotId } = useParams<{ snapshotId: string }>()

  const navigate = useNavigate()

  if (!snapshotId)
    return <Navigate to={`/projects/${ctx.projectId}/snapshots`} replace />

  return (
    <SnapshotDetailScreen
      projectId={ctx.projectId}
      snapshotId={snapshotId}
      accessToken={ctx.accessToken}
      user={ctx.user}
      onBack={() => navigate(`/projects/${ctx.projectId}/snapshots`)}
      onViewSourceExecution={(runId, executionId) =>
        navigate(
          `/projects/${ctx.projectId}/runs/${runId}/executions/${executionId}`,
        )
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function ComparisonHistoryRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const navigate = useNavigate()

  return (
    <ComparisonHistoryScreen
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onViewComparison={(comparisonId) =>
        navigate(`/projects/${ctx.projectId}/comparisons/${comparisonId}`)
      }
      onViewChain={(comparisonChainId) =>
        navigate(
          `/projects/${ctx.projectId}/comparison-chains/${comparisonChainId}`,
        )
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function ComparisonDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const { comparisonId } = useParams<{ comparisonId: string }>()

  const navigate = useNavigate()

  if (!comparisonId)
    return <Navigate to={`/projects/${ctx.projectId}/comparisons`} replace />

  return (
    <ComparisonDetailScreen
      projectId={ctx.projectId}
      comparisonId={comparisonId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/comparisons`)}
      onViewChain={(comparisonChainId) =>
        navigate(
          `/projects/${ctx.projectId}/comparison-chains/${comparisonChainId}`,
        )
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function ChainDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const { comparisonChainId } = useParams<{ comparisonChainId: string }>()

  const navigate = useNavigate()

  if (!comparisonChainId)
    return <Navigate to={`/projects/${ctx.projectId}/comparisons`} replace />

  return (
    <ChainDetailScreen
      projectId={ctx.projectId}
      comparisonChainId={comparisonChainId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/comparisons`)}
      onViewComparison={(comparisonId) =>
        navigate(`/projects/${ctx.projectId}/comparisons/${comparisonId}`)
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function ApiDetailRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const { apiId } = useParams<{ apiId: string }>()

  const navigate = useNavigate()

  const location = useLocation()

  const routeState = location.state as {
    returnTo?: { pathname: string; state: unknown }
    initialArea?: "run" | "history"
    initialRunValues?: RunRequestValues
  } | null

  const returnTo = routeState?.returnTo ?? null

  if (!apiId) return <Navigate to={`/projects/${ctx.projectId}/apis`} replace />

  return (
    <ApiDetailScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      apiId={apiId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/apis`)}
      onViewExecution={(runId, executionId) =>
        navigate(
          `/projects/${ctx.projectId}/runs/${runId}/executions/${executionId}`,
          {
            state: {
              returnTo: {
                pathname: `/projects/${ctx.projectId}/apis/${apiId}`,
                state: { initialArea: "history" },
              },
            },
          },
        )
      }
      onViewAllRuns={() => navigate(`/projects/${ctx.projectId}/runs`)}
      onViewSnapshot={(snapshotId) =>
        navigate(`/projects/${ctx.projectId}/snapshots/${snapshotId}`)
      }
      onViewComparison={(comparisonId) =>
        navigate(`/projects/${ctx.projectId}/comparisons/${comparisonId}`)
      }
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onBackToBatch={
        returnTo
          ? () => navigate(returnTo.pathname, { state: returnTo.state })
          : undefined
      }
      initialArea={routeState?.initialArea}
      initialRunValues={routeState?.initialRunValues}
    />
  )
}

function EnvironmentListRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const navigate = useNavigate()

  return (
    <EnvironmentListScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      accessToken={ctx.accessToken}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
      onOpenAuthentication={(environmentId) =>
        navigate(
          `/projects/${ctx.projectId}/environments/${environmentId}/authentication`,
        )
      }
    />
  )
}

function EnvironmentAuthenticationRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  const { environmentId } = useParams<{ environmentId: string }>()

  const navigate = useNavigate()

  if (!environmentId)
    return <Navigate to={`/projects/${ctx.projectId}/environments`} replace />

  return (
    <EnvironmentAuthenticationScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectStatus={ctx.projectStatus}
      environmentId={environmentId}
      accessToken={ctx.accessToken}
      onBack={() => navigate(`/projects/${ctx.projectId}/environments`)}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function MembersRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  return (
    <MembersScreen
      user={ctx.user}
      projectId={ctx.projectId}
      projectName={ctx.projectName}
      accessToken={ctx.accessToken}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
}

function IgnoreRulesRoute() {
  const ctx = useOutletContext<ProjectLayoutContext>()

  return (
    <IgnoreRulesScreen
      user={ctx.user}
      projectId={ctx.projectId}
      accessToken={ctx.accessToken}
      onSessionExpired={ctx.onSessionExpired}
      onAccessDenied={ctx.onAccessDenied}
    />
  )
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
  activeUser: User

  isAdmin: boolean

  accessToken: string | null

  onLogout: () => void

  onShowSessionExpired?: () => void

  onSessionExpired: () => void

  sessionExpired: boolean

  onSignInAgain: () => void
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
  )
}

function AuthenticatedRoutes({
  activeUser,

  isAdmin,

  accessToken,

  onLogout,

  onShowSessionExpired,

  onSessionExpired,
}: {
  activeUser: User

  isAdmin: boolean

  accessToken: string | null

  onLogout: () => void

  onShowSessionExpired?: () => void

  onSessionExpired: () => void
}) {
  const navigate = useNavigate()

  const onAccessDenied = () => navigate("/access-denied")

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
          <Route
            path="runs/:runId/executions/:executionId"
            element={<ExecutionDetailRoute />}
          />
          <Route path="snapshots" element={<SnapshotHistoryRoute />} />
          <Route
            path="snapshots/:snapshotId"
            element={<SnapshotDetailRoute />}
          />
          <Route path="comparisons" element={<ComparisonHistoryRoute />} />
          <Route
            path="comparisons/:comparisonId"
            element={<ComparisonDetailRoute />}
          />
          <Route
            path="comparison-chains/:comparisonChainId"
            element={<ChainDetailRoute />}
          />
          <Route path="environments" element={<EnvironmentListRoute />} />
          <Route
            path="environments/:environmentId/authentication"
            element={<EnvironmentAuthenticationRoute />}
          />
          <Route path="members" element={<MembersRoute />} />
          <Route path="ignore-rules" element={<IgnoreRulesRoute />} />
        </Route>
      </Route>

      <Route
        path="/access-denied"
        element={<AccessDeniedScreen onBack={() => navigate("/")} />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const auth = useAuth()

  const wasAuthenticated = useRef(false)

  useEffect(() => {
    if (auth.user && !wasAuthenticated.current) {
      wasAuthenticated.current = true
    }

    if (!auth.user) {
      wasAuthenticated.current = false
    }
  }, [auth.user])

  const activeUser: User | null = auth.user
    ? { email: auth.user.email, role: auth.user.systemRole }
    : null

  function handleLogout() {
    void auth.signOut()
  }

  if (!activeUser) {
    return (
      <div style={{ height: "100vh", overflow: "hidden" }}>
        {auth.screen === "signin" && (
          <SignInScreen onStartLoading={auth.signInWithGoogle} />
        )}

        {auth.screen === "signin-loading" && <SigningInScreen />}

        {auth.screen === "signin-error" && auth.loginError && (
          <SignInErrorScreen
            errorType={auth.loginError}
            onTryAgain={auth.retryFromError}
          />
        )}

        {auth.sessionExpired && (
          <SessionExpiredModal onSignInAgain={auth.dismissSessionExpired} />
        )}
      </div>
    )
  }

  const onShowSessionExpired = import.meta.env.DEV
    ? auth.debugShowSessionExpired
    : undefined

  const isAdmin = activeUser.role === "ADMIN"

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
  )
}
