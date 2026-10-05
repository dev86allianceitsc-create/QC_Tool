import { useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { useApiErrorHandler } from "../shared/useApiErrorHandler"

import type { Role } from "../projects/projects.types"

import { getEnvironment } from "./apiEnvironment.api"

import type { EnvironmentDetail } from "./apiEnvironment.types"

import { AuthenticationTab } from "./AuthenticationTab"

import { ConfirmDialog } from "../projects/ConfirmDialog"

import { InactiveBanner } from "./InactiveBanner"

import { StatusBadge } from "../projects/StatusBadge"

import { TestAccountsPanel } from "./TestAccountsPanel"

import { useAuthentication } from "./useAuthentication"

import { useTestAccounts } from "./useTestAccounts"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

// REVISION 3C-R02 — Authentication moved out of the API's Configuration area
// into Project Settings, scoped per-Environment only (shared by every API in
// it). This screen reuses AuthenticationTab.tsx as-is (already reworded to
// "this Environment") plus TestAccountsPanel.tsx, shown only once the saved
// Authentication Type is LOGIN_FORM — Bearer Token stays a single
// Environment-level secret with no accounts to manage.

export function EnvironmentAuthenticationScreen({
  user,

  projectId,

  projectStatus,

  environmentId,

  accessToken,

  onBack,

  onSessionExpired,

  onAccessDenied,
}: {
  user: { email: string; role: Role }

  projectId: string

  projectStatus: "ACTIVE" | "INACTIVE"

  environmentId: string

  accessToken: string | null

  onBack: () => void

  onSessionExpired: () => void

  onAccessDenied: () => void
}) {
  const isAdmin = user.role === "ADMIN"

  const projectInactive = projectStatus === "INACTIVE"

  const [environment, setEnvironment] = useState<EnvironmentDetail | null>(
    null,
  )

  const [envLoading, setEnvLoading] = useState(true)

  const [envError, setEnvError] = useState<string | null>(null)

  // Mirrors ApiDetailScreen.tsx's guardedNavigate for Request Input: no
  // reusable "unsaved changes" mechanism exists app-wide, so this is scoped
  // to this screen's own internal navigation only. Without it, clicking
  // "Use this request" on the Login Request import (which only captures the
  // edit locally — see ImportLoginRequestFlow.tsx) followed by "Environments"
  // silently discards the edit with no warning, before the Admin ever
  // reaches the page-level Save button.
  const [authDirty, setAuthDirty] = useState(false)

  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null)

  function guardedNavigate(action: () => void) {
    if (authDirty) {
      setPendingNav(() => action)
    } else {
      action()
    }
  }

  function confirmPendingNav() {
    pendingNav?.()

    setPendingNav(null)
  }

  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  async function loadEnvironment() {
    if (!accessToken) return

    setEnvLoading(true)

    setEnvError(null)

    try {
      const result = await getEnvironment(projectId, environmentId, accessToken)

      setEnvironment(result)
    } catch (err) {
      if (!handleApiError(err)) {
        setEnvError(
          err instanceof ApiError ? err.message : "Unable to load Environment.",
        )
      }
    } finally {
      setEnvLoading(false)
    }
  }

  useEffect(() => {
    void loadEnvironment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, environmentId, accessToken])

  const authentication = useAuthentication(
    projectId,
    environmentId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const testAccounts = useTestAccounts(
    projectId,
    environmentId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const environmentInactive = environment?.environmentStatus === "INACTIVE"

  const readOnlyReason = !isAdmin
    ? "Only Admins can manage Authentication."
    : projectInactive
      ? "This Project is INACTIVE. Authentication is view-only until the Project is reactivated."
      : environmentInactive
        ? "This Environment is INACTIVE. Authentication is view-only until the Environment is reactivated."
        : undefined

  const readOnly = !!readOnlyReason

  return (
    <div>
      {projectInactive && (
        <InactiveBanner message="This Project is INACTIVE. Authentication is view-only until the Project is reactivated." />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <button
            onClick={() => guardedNavigate(onBack)}
            className="cursor-pointer border-none bg-transparent p-0 text-xs text-gray-700 underline"
          >
            Environments
          </button>
          <div className="mt-1.5 flex items-center gap-2">
            <h2 className="m-0 text-base font-semibold text-gray-900">
              {environment?.environmentName ?? "Authentication"}
            </h2>
            {environment && <StatusBadge status={environment.environmentStatus} />}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {envLoading && (
          <Card>
            <p className="m-0">Loading Environment...</p>
          </Card>
        )}

        {!envLoading && envError && (
          <Card>
            <p className="text-error">{envError}</p>
            <Button variant="secondary" onClick={() => void loadEnvironment()}>
              Retry
            </Button>
          </Card>
        )}

        {!envLoading && !envError && (
          <>
            {authentication.loading && (
              <Card>
                <p className="m-0">Loading Authentication...</p>
              </Card>
            )}

            {!authentication.loading && authentication.error && (
              <Card>
                <p className="text-error">{authentication.error}</p>
                <Button
                  variant="secondary"
                  onClick={() => void authentication.refetch()}
                >
                  Retry
                </Button>
              </Card>
            )}

            {!authentication.loading &&
              !authentication.error &&
              authentication.config && (
                <>
                  <AuthenticationTab
                    config={authentication.config}
                    environmentName={environment?.environmentName}
                    readOnly={readOnly}
                    readOnlyReason={readOnlyReason}
                    saving={authentication.saving}
                    onSaveConfiguration={authentication.saveConfiguration}
                    onSaveCredential={authentication.saveCredential}
                    onRemoveCredential={authentication.removeCredential}
                    onDirtyChange={setAuthDirty}
                  />

                  {authentication.config.authType === "LOGIN_FORM" && (
                    <TestAccountsPanel
                      testAccounts={testAccounts.testAccounts}
                      loading={testAccounts.loading}
                      error={testAccounts.error}
                      readOnly={readOnly}
                      onRefetch={testAccounts.refetch}
                      onCreate={testAccounts.createTestAccount}
                      onUpdate={testAccounts.updateTestAccount}
                      onRemove={testAccounts.removeTestAccount}
                    />
                  )}
                </>
              )}
          </>
        )}
      </div>

      {pendingNav && (
        <ConfirmDialog
          title="Unsaved changes"
          message="You have unsaved changes on this Authentication Configuration. Leave and discard them?"
          confirmLabel="Leave"
          danger
          onConfirm={confirmPendingNav}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  )
}
