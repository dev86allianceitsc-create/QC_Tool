import { useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import { BearerTokenCredentialFields } from "./BearerTokenCredentialFields";
import { LoginFormCredentialFields } from "./LoginFormCredentialFields";
import {
  AUTH_TYPE_LABELS,
  AUTH_TYPE_OPTIONS,
  buildConfigurationPayload,
  changeTypeConfirmMessage,
  isLoginFormDraftDirty,
  toLoginFormDraft,
  validateLoginFormDraft,
} from "./authentication.util";
import type { AuthenticationConfiguration, AuthType, PutAuthenticationConfigurationPayload, PutCredentialPayload } from "./authentication.types";

const CREDENTIAL_STATUS_BADGE: Record<AuthenticationConfiguration["credentialStatus"], { tone: "success" | "neutral" | "warning"; label: string }> = {
  NOT_REQUIRED: { tone: "neutral", label: "Not Required" },
  CONFIGURED: { tone: "success", label: "Configured" },
  NOT_CONFIGURED: { tone: "warning", label: "Not Configured" },
};

// Step 3 (Authentication) content, structured after RequestInputTab.tsx: a
// local draft + dirty flag reported via onDirtyChange so ApiDetailScreen's
// existing guardedNavigate can protect it the same way it protects Request
// Input. Changing Auth Type away from the saved value always goes through a
// confirm (CL-3C-02 / AC-UI-3C-03) before the PUT is sent — the backend
// wipes the old type's secret atomically in the same mutation, so the
// warning has to come before the request, not after it.
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
  config: AuthenticationConfiguration;
  environmentName?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
  saving?: boolean;
  onSaveConfiguration: (payload: PutAuthenticationConfigurationPayload) => Promise<AuthenticationConfiguration>;
  onSaveCredential: (payload: PutCredentialPayload) => Promise<AuthenticationConfiguration>;
  onRemoveCredential: () => Promise<AuthenticationConfiguration>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [authTypeDraft, setAuthTypeDraft] = useState<AuthType>(config.authType);
  const [loginFormDraft, setLoginFormDraft] = useState(toLoginFormDraft(config));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<PutAuthenticationConfigurationPayload | null>(null);

  const dirty = authTypeDraft !== config.authType || (authTypeDraft === "LOGIN_FORM" && isLoginFormDraftDirty(loginFormDraft, config));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function handleAuthTypeChange(next: AuthType) {
    setAuthTypeDraft(next);
    setFieldError(null);
    setSaveError(null);
  }

  function handleCancel() {
    setAuthTypeDraft(config.authType);
    setLoginFormDraft(toLoginFormDraft(config));
    setFieldError(null);
    setSaveError(null);
    setJustSaved(false);
  }

  async function commitSave(payload: PutAuthenticationConfigurationPayload) {
    setSaveError(null);
    try {
      const saved = await onSaveConfiguration(payload);
      // Re-baseline the draft on what the backend actually stored (it trims,
      // and nulls out the non-LOGIN_FORM fields), otherwise the dirty flag —
      // and with it the unsaved-changes guard — would stay on after a save
      // that succeeded.
      setAuthTypeDraft(saved.authType);
      setLoginFormDraft(toLoginFormDraft(saved));
      setJustSaved(true);
    } catch (err) {
      // CL-3C-02: a failed save leaves the stored type and credential
      // untouched, so the draft stays as it was for the Admin to retry or
      // cancel out of.
      setSaveError(err instanceof ApiError ? err.message : "Unable to save Authentication configuration.");
    }
  }

  async function handleSave() {
    setFieldError(null);
    if (authTypeDraft === "LOGIN_FORM") {
      const validationError = validateLoginFormDraft(loginFormDraft);
      if (validationError) {
        setFieldError(validationError);
        return;
      }
    }
    const payload = buildConfigurationPayload(authTypeDraft, loginFormDraft);
    if (authTypeDraft !== config.authType) {
      setPendingPayload(payload);
      return;
    }
    await commitSave(payload);
  }

  async function confirmTypeChange() {
    if (!pendingPayload) return;
    const payload = pendingPayload;
    setPendingPayload(null);
    await commitSave(payload);
  }

  const credentialBadge = CREDENTIAL_STATUS_BADGE[config.credentialStatus];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h3 className="m-0 text-base font-semibold text-gray-900">Authentication Type</h3>
            {/* UI-AUTH-01 context: this Authentication Configuration belongs
                to this API in this Environment only, never to another API or
                another Environment (REQ-SEC-002). */}
            {environmentName && <p className="m-0 mt-1 text-xs text-muted">Environment: {environmentName}</p>}
          </div>
          <Badge tone={credentialBadge.tone} label={credentialBadge.label} />
        </div>
        <div className="mt-3 max-w-xs">
          <Select label="Type" value={authTypeDraft} onChange={(e) => handleAuthTypeChange(e.target.value as AuthType)} disabled={readOnly}>
            {AUTH_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Safe metadata only (UI-AUTH-01): when the configuration last
            changed — never the Secret Credential Value itself. */}
        {config.updatedAt && <p className="mt-3 mb-0 text-xs text-muted">Last updated: {new Date(config.updatedAt).toLocaleString()}</p>}

        {readOnly
          ? readOnlyReason && <p className="mt-3 mb-0 text-xs text-muted">{readOnlyReason}</p>
          : (
            <div className="mt-4 flex flex-col gap-2.5">
              {fieldError && <p className="m-0 text-sm text-error">{fieldError}</p>}
              {saveError && <p className="m-0 text-sm text-error">{saveError}</p>}
              {!fieldError && !saveError && !dirty && justSaved && <p className="m-0 text-sm text-success">Saved.</p>}
              <div className="flex gap-2.5">
                <Button variant="secondary" onClick={handleCancel} disabled={!dirty}>
                  Cancel changes
                </Button>
                <Button variant="primary" onClick={() => void handleSave()} disabled={!dirty || saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
      </Card>

      {authTypeDraft === "NONE" && <p className="text-sm text-muted">No authentication is required for this API in this Environment.</p>}

      {authTypeDraft === "LOGIN_FORM" && (
        <LoginFormCredentialFields
          draft={loginFormDraft}
          onDraftChange={setLoginFormDraft}
          readOnly={readOnly}
          typeSaved={config.authType === "LOGIN_FORM"}
          credentialStatus={config.credentialStatus}
          saving={saving}
          onSaveCredential={(password) => onSaveCredential({ password }).then(() => undefined)}
          onRemoveCredential={() => onRemoveCredential().then(() => undefined)}
        />
      )}

      {authTypeDraft === "BEARER_TOKEN" &&
        (config.authType === "BEARER_TOKEN" ? (
          <BearerTokenCredentialFields
            readOnly={readOnly}
            credentialStatus={config.credentialStatus}
            saving={saving}
            onSaveCredential={(token) => onSaveCredential({ token }).then(() => undefined)}
            onRemoveCredential={() => onRemoveCredential().then(() => undefined)}
          />
        ) : (
          <p className="text-sm text-muted">Save this Authentication Type before configuring its credential.</p>
        ))}

      {pendingPayload && (
        <ConfirmDialog
          title="Change authentication type"
          message={changeTypeConfirmMessage(
            AUTH_TYPE_LABELS[config.authType],
            AUTH_TYPE_LABELS[pendingPayload.authType],
            config.credentialStatus === "CONFIGURED",
          )}
          confirmLabel="Change type"
          danger
          onConfirm={() => void confirmTypeChange()}
          onCancel={() => setPendingPayload(null)}
        />
      )}
    </div>
  );
}
