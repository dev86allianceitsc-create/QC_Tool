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
  AUTH_TYPE_OPTIONS,
  buildConfigurationPayload,
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
// Input. Changing Auth Type away from the saved value while a credential is
// CONFIGURED goes through a confirm (CL-3C-02: the backend wipes the old
// secret atomically on type change) before the PUT is sent.
export function AuthenticationTab({
  config,
  readOnly,
  saving,
  onSaveConfiguration,
  onSaveCredential,
  onRemoveCredential,
  onDirtyChange,
}: {
  config: AuthenticationConfiguration;
  readOnly?: boolean;
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
  }

  async function commitSave(payload: PutAuthenticationConfigurationPayload) {
    setSaveError(null);
    try {
      await onSaveConfiguration(payload);
    } catch (err) {
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
    const willClearCredential = authTypeDraft !== config.authType && config.credentialStatus === "CONFIGURED";
    if (willClearCredential) {
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
          <h3 className="m-0 text-base font-semibold text-gray-900">Authentication Type</h3>
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

        {!readOnly && (
          <div className="mt-4 flex flex-col gap-2.5">
            {fieldError && <p className="m-0 text-sm text-error">{fieldError}</p>}
            {saveError && <p className="m-0 text-sm text-error">{saveError}</p>}
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

      {authTypeDraft === "LOGIN_FORM" &&
        (config.authType === "LOGIN_FORM" ? (
          <LoginFormCredentialFields
            draft={loginFormDraft}
            onDraftChange={setLoginFormDraft}
            readOnly={readOnly}
            credentialStatus={config.credentialStatus}
            saving={saving}
            onSaveCredential={(password) => onSaveCredential({ password }).then(() => undefined)}
            onRemoveCredential={() => onRemoveCredential().then(() => undefined)}
          />
        ) : (
          <p className="text-sm text-muted">Save this Authentication Type before configuring its credential.</p>
        ))}

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
          message="Changing the authentication type will remove the credential saved for the current type. The old credential cannot be recovered automatically. Continue?"
          confirmLabel="Change type"
          danger
          onConfirm={() => void confirmTypeChange()}
          onCancel={() => setPendingPayload(null)}
        />
      )}
    </div>
  );
}
