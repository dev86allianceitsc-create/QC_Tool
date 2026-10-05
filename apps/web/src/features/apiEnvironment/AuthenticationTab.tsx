import { useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { Badge } from "../../components/ui/Badge"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

import { Select } from "../../components/ui/Select"

import { ConfirmDialog } from "../projects/ConfirmDialog"

import { BearerTokenCredentialFields } from "./BearerTokenCredentialFields"

import { ImportLoginRequestFlow } from "./ImportLoginRequestFlow"

import { LoginFormCredentialFields } from "./LoginFormCredentialFields"

import {
  AUTH_TYPE_LABELS,
  AUTH_TYPE_OPTIONS,
  LOGIN_MODE_LABELS,
  LOGIN_MODE_OPTIONS,
  buildConfigurationPayload,
  changeLoginModeConfirmMessage,
  changeTypeConfirmMessage,
  isLoginFormDraftDirty,
  toLoginFormDraft,
  validateLoginFormDraft,
} from "./authentication.util"

import {
  buildImportedConfigurationPayload,
  isLoginImportDraftDirty,
  toLoginImportDraft,
  validateLoginImportDraft,
  type LoginImportDraft,
} from "./loginRequestImport.util"

import type {
  AuthenticationConfiguration,
  AuthType,
  LoginMode,
  PutAuthenticationConfigurationPayload,
  PutCredentialPayload,
} from "./authentication.types"

const CREDENTIAL_STATUS_BADGE: Record<AuthenticationConfiguration["credentialStatus"], {
  tone: "success" | "neutral" | "warning"
  label: string
}> = {
  NOT_REQUIRED: { tone: "neutral", label: "Not Required" },

  CONFIGURED: { tone: "success", label: "Configured" },

  NOT_CONFIGURED: { tone: "warning", label: "Not Configured" },
}

// Step 3 (Authentication) content, structured after RequestInputTab.tsx: a

// local draft + dirty flag reported via onDirtyChange so ApiDetailScreen's

// existing guardedNavigate can protect it the same way it protects Request

// Input. Changing Auth Type away from the saved value always goes through a

// confirm (AC-UI-3C-03) before the PUT is sent — the switch immediately

// changes what every Run against this Environment authenticates with, so

// it's still worth confirming, even though the backend now preserves every

// type's/mode's configuration rather than deleting it.

export function AuthenticationTab({
  config,

  environmentName,

  readOnly,

  readOnlyReason,

  saving,

  onSaveConfiguration,

  onSaveCredential,

  onRemoveCredential,

  onDirtyChange,
}: {
  config: AuthenticationConfiguration

  environmentName?: string

  readOnly?: boolean

  readOnlyReason?: string

  saving?: boolean

  onSaveConfiguration: (
    payload: PutAuthenticationConfigurationPayload,
  ) => Promise<AuthenticationConfiguration>

  onSaveCredential: (
    payload: PutCredentialPayload,
  ) => Promise<AuthenticationConfiguration>

  onRemoveCredential: () => Promise<AuthenticationConfiguration>

  onDirtyChange?: (dirty: boolean) => void
}) {
  const [authTypeDraft, setAuthTypeDraft] = useState<AuthType>(config.authType)

  const [loginModeDraft, setLoginModeDraft] = useState<LoginMode>(
    config.loginMode ?? "IMPORTED",
  )

  const [loginFormDraft, setLoginFormDraft] = useState(toLoginFormDraft(config))

  const [loginImportDraft, setLoginImportDraft] = useState<LoginImportDraft>(
    toLoginImportDraft(config),
  )

  const [fieldError, setFieldError] = useState<string | null>(null)

  const [saveError, setSaveError] = useState<string | null>(null)

  const [justSaved, setJustSaved] = useState(false)

  const [pendingPayload, setPendingPayload] =
    useState<PutAuthenticationConfigurationPayload | null>(null)

  const savedLoginMode = config.loginMode ?? "IMPORTED"

  const dirty =
    authTypeDraft !== config.authType ||
    (authTypeDraft === "LOGIN_FORM" &&
      (loginModeDraft !== savedLoginMode ||
        (loginModeDraft === "MANUAL" &&
          isLoginFormDraftDirty(loginFormDraft, config)) ||
        (loginModeDraft === "IMPORTED" &&
          isLoginImportDraftDirty(loginImportDraft, config))))

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  function handleAuthTypeChange(next: AuthType) {
    setAuthTypeDraft(next)

    setFieldError(null)

    setSaveError(null)
  }

  function handleCancel() {
    setAuthTypeDraft(config.authType)

    setLoginModeDraft(savedLoginMode)

    setLoginFormDraft(toLoginFormDraft(config))

    setLoginImportDraft(toLoginImportDraft(config))

    setFieldError(null)

    setSaveError(null)

    setJustSaved(false)
  }

  async function commitSave(payload: PutAuthenticationConfigurationPayload) {
    setSaveError(null)

    try {
      const saved = await onSaveConfiguration(payload)

      // Re-baseline the draft on what the backend actually stored (it trims

      // the active mode's fields and preserves the inactive mode's), otherwise

      // the dirty flag — and with it the unsaved-changes guard — would stay on

      // after a save that succeeded.

      setAuthTypeDraft(saved.authType)

      setLoginModeDraft(saved.loginMode ?? "IMPORTED")

      setLoginFormDraft(toLoginFormDraft(saved))

      setLoginImportDraft(toLoginImportDraft(saved))

      setJustSaved(true)
    } catch (err) {
      // A failed save leaves the stored type and credential untouched, so

      // the draft stays as it was for the Admin to retry or cancel out of.

      setSaveError(
        err instanceof ApiError
          ? err.message
          : "Unable to save Authentication configuration.",
      )
    }
  }

  async function handleSave() {
    setFieldError(null)

    let payload: PutAuthenticationConfigurationPayload

    if (authTypeDraft === "LOGIN_FORM") {
      if (loginModeDraft === "MANUAL") {
        const validationError = validateLoginFormDraft(loginFormDraft)

        if (validationError) {
          setFieldError(validationError)

          return
        }

        payload = buildConfigurationPayload(
          authTypeDraft,
          loginModeDraft,
          loginFormDraft,
        )
      } else {
        const validationError = validateLoginImportDraft(loginImportDraft)

        if (validationError) {
          setFieldError(validationError)

          return
        }

        payload = buildImportedConfigurationPayload(loginImportDraft)
      }
    } else {
      payload = buildConfigurationPayload(
        authTypeDraft,
        loginModeDraft,
        loginFormDraft,
      )
    }

    const typeOrModeChanged =
      authTypeDraft !== config.authType ||
      (authTypeDraft === "LOGIN_FORM" && loginModeDraft !== savedLoginMode)

    if (typeOrModeChanged) {
      setPendingPayload(payload)

      return
    }

    await commitSave(payload)
  }

  async function confirmTypeChange() {
    if (!pendingPayload) return

    const payload = pendingPayload

    setPendingPayload(null)

    await commitSave(payload)
  }

  const credentialBadge = CREDENTIAL_STATUS_BADGE[config.credentialStatus]

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h3 className="m-0 text-base font-semibold text-gray-900">
              Authentication Type
            </h3>
            {/* UI-AUTH-01 context: this Authentication Configuration belongs
                to this Environment only (REVISION 3C-R02), shared by every
                API in it, never to another Environment (REQ-SEC-002). */}
            {environmentName && (
              <p className="m-0 mt-1 text-xs text-muted">
                Environment: {environmentName}
              </p>
            )}
          </div>
          <Badge tone={credentialBadge.tone} label={credentialBadge.label} />
        </div>
        <div className="mt-3 max-w-xs">
          <Select
            label="Type"
            value={authTypeDraft}
            onChange={(e) => handleAuthTypeChange(e.target.value as AuthType)}
            disabled={readOnly}
          >
            {AUTH_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Safe metadata only (UI-AUTH-01): when the configuration last
            changed — never the Secret Credential Value itself. */}
        {config.updatedAt && (
          <p className="mt-3 mb-0 text-xs text-muted">
            Last updated: {new Date(config.updatedAt).toLocaleString()}
          </p>
        )}

        {readOnly ? (
          readOnlyReason && (
            <p className="mt-3 mb-0 text-xs text-muted">{readOnlyReason}</p>
          )
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {fieldError && (
              <p className="m-0 text-sm text-error">{fieldError}</p>
            )}
            {saveError && <p className="m-0 text-sm text-error">{saveError}</p>}
            {!fieldError && !saveError && !dirty && justSaved && (
              <p className="m-0 text-sm text-success">Saved.</p>
            )}
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={!dirty}
              >
                Cancel changes
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                disabled={!dirty || saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {authTypeDraft === "NONE" && (
        <p className="text-sm text-muted">
          No authentication is required for this Environment.
        </p>
      )}

      {authTypeDraft === "LOGIN_FORM" && (
        <Card>
          <div className="max-w-xs">
            <Select
              label="Login Form Mode"
              value={loginModeDraft}
              onChange={(e) => {
                setLoginModeDraft(e.target.value as LoginMode)

                setFieldError(null)

                setSaveError(null)
              }}
              disabled={readOnly}
            >
              {LOGIN_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      )}

      {authTypeDraft === "LOGIN_FORM" &&
        (loginModeDraft === "IMPORTED" ? (
          <ImportLoginRequestFlow
            initialDraft={loginImportDraft}
            onSave={setLoginImportDraft}
            onCancel={() => setLoginImportDraft(toLoginImportDraft(config))}
            readOnly={readOnly}
          />
        ) : (
          <LoginFormCredentialFields
            draft={loginFormDraft}
            onDraftChange={setLoginFormDraft}
            readOnly={readOnly}
          />
        ))}

      {authTypeDraft === "BEARER_TOKEN" &&
        (config.authType === "BEARER_TOKEN" ? (
          <BearerTokenCredentialFields
            readOnly={readOnly}
            credentialStatus={config.credentialStatus}
            saving={saving}
            onSaveCredential={(token) =>
              onSaveCredential({ token }).then(() => undefined)
            }
            onRemoveCredential={() =>
              onRemoveCredential().then(() => undefined)
            }
          />
        ) : (
          <p className="text-sm text-muted">
            Save this Authentication Type before configuring its credential.
          </p>
        ))}

      {pendingPayload &&
        (authTypeDraft !== config.authType ? (
          <ConfirmDialog
            title="Change authentication type"
            message={changeTypeConfirmMessage(
              AUTH_TYPE_LABELS[config.authType],

              AUTH_TYPE_LABELS[pendingPayload.authType],
            )}
            confirmLabel="Change type"
            onConfirm={() => void confirmTypeChange()}
            onCancel={() => setPendingPayload(null)}
          />
        ) : (
          <ConfirmDialog
            title="Change Login Form mode"
            message={changeLoginModeConfirmMessage(
              LOGIN_MODE_LABELS[savedLoginMode],

              LOGIN_MODE_LABELS[loginModeDraft],
            )}
            confirmLabel="Change mode"
            onConfirm={() => void confirmTypeChange()}
            onCancel={() => setPendingPayload(null)}
          />
        ))}
    </div>
  )
}
