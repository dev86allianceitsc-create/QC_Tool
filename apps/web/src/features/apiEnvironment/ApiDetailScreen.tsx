import { useEffect, useMemo, useState } from "react"

import { ApiError } from "../../services/api-client"

import { ConfirmDialog } from "../projects/ConfirmDialog"

import type { Role } from "../projects/projects.types"

import { AUTH_TYPE_LABELS } from "./authentication.util"

import { ConfigurationArea } from "./ConfigurationArea"

import { CreateEditApiModal } from "./CreateEditApiModal"

import { InactiveBanner } from "./InactiveBanner"

import { RunApiArea } from "./RunApiArea"

import { RunHistoryArea } from "./RunHistoryArea"

import { useApiDetail } from "./useApiDetail"

import { useApiEnvironmentConfigs } from "./useApiEnvironmentConfigs"

import { useAuthentication } from "./useAuthentication"

import { useEnvironmentList } from "./useEnvironmentList"

import { useRequestInput } from "./useRequestInput"

import { useTestAccounts } from "./useTestAccounts"

import type { RunRequestValues } from "./requestInput.types"

import { useSingleRunExecution } from "./useSingleRunExecution"

import { Button } from "../../components/ui/Button"

import { HttpMethodBadge } from "../../components/ui/HttpMethodBadge"

import type { StepReadiness } from "../../components/ui/StepSidebar"

import { TabBar } from "../../components/ui/TabBar"

type ApiWorkspaceArea = "configuration" | "run" | "history"

const WORKSPACE_TABS: { key: ApiWorkspaceArea; label: string }[] = [
  { key: "configuration", label: "Configuration" },

  { key: "run", label: "Run API" },

  { key: "history", label: "Run History" },
]

// UI correction — Configuration / Run API / Run History as 3 horizontal,

// same-level tabs below the API identity header (not a single toggle

// button, and Run History is its own tab, never nested under Execute).

// This screen stays a thin shell: header (breadcrumb, Method/Path,

// Environment selector, Edit/Delete) plus the TabBar plus whichever area is

// active. All data fetching and the unsaved-changes guard stay here so

// state survives switching between areas; ConfigurationArea/RunApiArea only

// render their own step content from props — the underlying

// hooks/components (useRequestInput, useApiEnvironmentConfigs,

// useAuthentication, RequestInputTab, AuthenticationTab) are unchanged.

export function ApiDetailScreen({
  user,

  projectId,

  projectStatus,

  apiId,

  accessToken,

  onBack,

  onViewExecution,

  onViewAllRuns,

  onViewSnapshot,

  onViewComparison,

  onSessionExpired,

  onAccessDenied,

  onBackToBatch,

  initialArea,

  initialRunValues,
}: {
  user: { email: string; role: Role }

  projectId: string

  projectStatus: "ACTIVE" | "INACTIVE"

  apiId: string

  accessToken: string | null

  onBack: () => void

  onViewExecution: (runId: string, executionId: string) => void

  onViewAllRuns: () => void

  onViewSnapshot?: (snapshotId: string) => void

  onViewComparison?: (comparisonId: string) => void

  onSessionExpired: () => void

  onAccessDenied: () => void

  onBackToBatch?: () => void

  initialArea?: "run" | "history"

  initialRunValues?: RunRequestValues
}) {
  const isAdmin = user.role === "ADMIN"

  const projectInactive = projectStatus === "INACTIVE"

  const { api, loading, error, refetch, updateApi, deleteApi } = useApiDetail(
    projectId,
    apiId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const { environments } = useEnvironmentList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const { configs, loading: configsLoading } = useApiEnvironmentConfigs(
    projectId,
    apiId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const requestInput = useRequestInput(
    projectId,
    apiId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const [area, setArea] = useState<ApiWorkspaceArea>(initialArea ?? "configuration")

  const [showEditModal, setShowEditModal] = useState(false)

  const [editError, setEditError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<string | null>(null)

  const [requestInputDirty, setRequestInputDirty] = useState(false)

  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null)

  const authentication = useAuthentication(
    projectId,
    selectedEnvironmentId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const runExecution = useSingleRunExecution(
    projectId,
    apiId,
    selectedEnvironmentId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const testAccounts = useTestAccounts(
    projectId,
    authentication.config?.authType === "LOGIN_FORM"
      ? selectedEnvironmentId
      : null,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  // INACTIVE Environments are not a valid Execution Target: an Admin

  // reactivates them from the Environments list, not from this per-API

  // screen, so here they must be neither shown nor selectable. Everything

  // in this screen that picks or lists "the Environments for this API"

  // reads activeEnvironments, never the raw fetch result.

  const activeEnvironments = useMemo(
    () => environments.filter((e) => e.environmentStatus === "ACTIVE"),
    [environments],
  )

  useEffect(() => {
    if (activeEnvironments.length === 0) return

    const stillActive = activeEnvironments.some(
      (e) => e.environmentId === selectedEnvironmentId,
    )

    if (!stillActive) {
      setSelectedEnvironmentId(activeEnvironments[0].environmentId)
    }
  }, [activeEnvironments, selectedEnvironmentId])

  if (loading) {
    return (
      <div className="p-5">
        <p>Loading API...</p>
      </div>
    )
  }

  if (error || !api) {
    return (
      <div className="p-5">
        <p className="text-error">{error ?? "API not found."}</p>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button variant="secondary" onClick={onBack}>
            ← APIs
          </Button>
        </div>
      </div>
    )
  }

  const currentApi = api

  const selectedEnvironment =
    activeEnvironments.find((e) => e.environmentId === selectedEnvironmentId) ??
    null

  const config = selectedEnvironment
    ? (configs.find(
        (c) => c.environmentId === selectedEnvironment.environmentId,
      ) ?? null)
    : null

  const environmentInactive =
    selectedEnvironment?.environmentStatus === "INACTIVE"

  const readOnlyConfig = projectInactive || environmentInactive

  // UX-01: switching area/step (or, for Authentication, switching

  // Environment) away from an unsaved draft would silently drop it. No

  // reusable "unsaved changes" mechanism exists elsewhere in the app yet,

  // so this guard is scoped to this screen's own internal navigation only.

  function guardedNavigate(action: () => void) {
    if (requestInputDirty) {
      setPendingNav(() => action)
    } else {
      action()
    }
  }

  function confirmPendingNav() {
    pendingNav?.()

    setPendingNav(null)
  }

  async function handleSaveEdit(input: {
    apiName: string
    httpMethod: string
    path: string
    description: string | null
  }) {
    setSaving(true)

    setEditError(null)

    try {
      await updateApi(input)

      setShowEditModal(false)
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : "Unable to save API.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteError(null)

    try {
      await deleteApi()

      setShowDeleteConfirm(false)

      onBack()
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Unable to delete API.",
      )
    }
  }

  const requestInputHasData =
    !!requestInput.definition &&
    (requestInput.definition.pathParameters.length > 0 ||
      requestInput.definition.queryParameters.length > 0 ||
      requestInput.definition.headerParameters.length > 0 ||
      requestInput.definition.requestBody !== null)

  // "not_configured" (not "not required") — an empty Request Input has no

  // backing business rule saying the API needs no input; it may simply not

  // be filled in yet, so the badge must not claim more than that fact.

  const requestInputReadiness: StepReadiness | undefined =
    requestInput.definition
      ? requestInputHasData
        ? "configured"
        : "not_configured"
      : undefined

  const executionTargetReadiness: StepReadiness =
    activeEnvironments.length === 0
      ? "not_available"
      : config?.effectiveUrl
        ? "configured"
        : "needs_attention"

  // Both the Authentication step (per-Environment fetch) and the Environment

  // config list carry credentialStatus. Once the step has loaded the live

  // configuration for the selected Environment it is the fresher of the

  // two, so readiness and the Execution Target card prefer it.

  const liveAuthConfig =
    authentication.config &&
    authentication.config.environmentId === selectedEnvironmentId
      ? authentication.config
      : null

  const credentialStatus =
    liveAuthConfig?.credentialStatus ?? config?.credentialStatus ?? null

  const authTypeLabel = liveAuthConfig
    ? AUTH_TYPE_LABELS[liveAuthConfig.authType]
    : null

  // UI-RUN-01: the concrete reasons a Run could not be started for the

  // selected Environment. Run execution itself is out of 3C scope — this

  // only reports readiness, it never attempts a request.

  const runBlockers: string[] = selectedEnvironment
    ? [
        projectInactive ? "The Project is INACTIVE." : null,

        environmentInactive ? "The Environment is INACTIVE." : null,

        !selectedEnvironment.allowRun
          ? "Allow Run is OFF for this Environment."
          : null,

        !config?.effectiveUrl
          ? "The Full URL is not configured for this Environment."
          : null,

        credentialStatus === "NOT_CONFIGURED"
          ? "The credential for the selected Authentication Type is not configured."
          : null,

        liveAuthConfig?.authType === "LOGIN_FORM" &&
        !testAccounts.loading &&
        testAccounts.testAccounts.length === 0
          ? "No Test Accounts are configured for this Environment's Login Form Authentication."
          : null,
      ].filter((reason): reason is string => reason !== null)
    : []

  return (
    <div>
      {projectInactive && (
        <InactiveBanner message="This Project is INACTIVE. This API is view-only until the Project is reactivated." />
      )}

      {onBackToBatch && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-blue-50 px-6 py-2.5">
          <span className="text-xs text-gray-700">
            You're configuring this API for a Batch Run. Make all the changes
            you need, then head back whenever you're ready.
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => guardedNavigate(onBackToBatch)}
          >
            ← Back to Batch Run Preparation
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          {!onBackToBatch && (
            <div className="text-xs text-muted">
              <button
                onClick={onBack}
                className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline"
              >
                APIs
              </button>
              <span className="mx-1.5">/</span>
              <span className="text-gray-900">{currentApi.apiName}</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <HttpMethodBadge method={currentApi.httpMethod} />
            <span className="font-mono text-sm text-gray-900">
              {currentApi.path}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeEnvironments.length > 0 && (
            <select
              aria-label="Environment"
              value={selectedEnvironmentId ?? ""}
              onChange={(e) => {
                const nextEnvironmentId = e.target.value

                guardedNavigate(() =>
                  setSelectedEnvironmentId(nextEnvironmentId),
                )
              }}
              className="rounded-md border border-border px-2.5 py-1.5 text-sm text-gray-900"
            >
              {activeEnvironments.map((env) => (
                <option key={env.environmentId} value={env.environmentId}>
                  {env.environmentName}
                </option>
              ))}
            </select>
          )}
          {!projectInactive && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditError(null)

                  setShowEditModal(true)
                }}
              >
                Edit
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeleteError(null)

                    setShowDeleteConfirm(true)
                  }}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <TabBar
        items={WORKSPACE_TABS}
        activeKey={area}
        onSelect={(key) =>
          guardedNavigate(() => setArea(key as ApiWorkspaceArea))
        }
        ariaLabel="API Detail sections"
      />

      {area === "configuration" && (
        <ConfigurationArea
          currentApi={currentApi}
          environments={activeEnvironments}
          selectedEnvironment={selectedEnvironment}
          environmentInactive={environmentInactive}
          readOnlyConfig={readOnlyConfig}
          requestInput={requestInput}
          projectInactive={projectInactive}
          requestInputReadiness={requestInputReadiness}
          onRequestInputDirtyChange={setRequestInputDirty}
          apiId={apiId}
          guardedNavigate={guardedNavigate}
          onFinish={() => setArea("run")}
        />
      )}

      {area === "run" && (
        <RunApiArea
          apiId={apiId}
          httpMethod={currentApi.httpMethod}
          environments={activeEnvironments}
          selectedEnvironmentId={selectedEnvironmentId}
          onSelectEnvironment={(environmentId) =>
            guardedNavigate(() => setSelectedEnvironmentId(environmentId))
          }
          config={config}
          configsLoading={configsLoading}
          executionTargetReadiness={executionTargetReadiness}
          requestInputDefinition={requestInput.definition}
          initialValues={initialRunValues}
          authTypeLabel={authTypeLabel}
          authType={liveAuthConfig?.authType ?? null}
          credentialStatus={credentialStatus}
          testAccounts={testAccounts.testAccounts}
          testAccountsLoading={testAccounts.loading}
          runBlockers={runBlockers}
          runExecution={runExecution}
          onViewSnapshot={onViewSnapshot}
          onViewComparison={onViewComparison}
        />
      )}

      {area === "history" && (
        <RunHistoryArea
          projectId={projectId}
          apiId={apiId}
          accessToken={accessToken}
          onViewExecution={onViewExecution}
          onViewComparison={onViewComparison}
          onViewAllRuns={onViewAllRuns}
          onSessionExpired={onSessionExpired}
          onAccessDenied={onAccessDenied}
        />
      )}

      {showEditModal && (
        <CreateEditApiModal
          editing={currentApi}
          saving={saving}
          error={editError}
          onSave={(input) => void handleSaveEdit(input)}
          onCancel={() => setShowEditModal(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete API"
          message={
            `This will delete "${currentApi.apiName}" (${currentApi.httpMethod} ${currentApi.path}). It will no longer appear in the API list, but its historical Run/Snapshot/Comparison data will be retained.` +
            (deleteError ? `\n${deleteError}` : "")
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {pendingNav && (
        <ConfirmDialog
          title="Unsaved changes"
          message="You have unsaved changes on this step. Leave and discard them?"
          confirmLabel="Leave"
          danger
          onConfirm={confirmPendingNav}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  )
}
