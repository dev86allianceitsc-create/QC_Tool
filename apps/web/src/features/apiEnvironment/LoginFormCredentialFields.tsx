import { useState } from "react";
import { ApiError } from "../../services/api-client";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import { validatePassword } from "./authentication.util";
import type { LoginFormDraft } from "./authentication.util";
import type { CredentialStatus } from "./authentication.types";

// UI-AUTH — non-secret Login Form config fields plus the Password secret
// action (Configure/Replace/Remove). The config fields (Login URL, Username,
// Username Field, Password Field, Token Response Path) are always editable
// once Login Form is selected — they must be, since validateLoginFormDraft
// requires them before the Authentication Type can be saved as LOGIN_FORM in
// the first place. The Password action stays gated on `typeSaved`: the
// credential endpoint requires an existing LOGIN_FORM row server-side
// (authentication.service.ts putCredential), so there is nothing to attach a
// password to until the type itself has been saved. Password is never
// pre-filled (REQ-SEC-002: a Secret Credential Value is never returned as
// plaintext) — configuring or replacing always starts from an empty field.
export function LoginFormCredentialFields({
  draft,
  onDraftChange,
  readOnly,
  typeSaved,
  credentialStatus,
  saving,
  onSaveCredential,
  onRemoveCredential,
}: {
  draft: LoginFormDraft;
  onDraftChange: (next: LoginFormDraft) => void;
  readOnly?: boolean;
  typeSaved: boolean;
  credentialStatus: CredentialStatus;
  saving?: boolean;
  onSaveCredential: (password: string) => Promise<void>;
  onRemoveCredential: () => Promise<void>;
}) {
  const [passwordDraft, setPasswordDraft] = useState("");
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [justSaved, setJustSaved] = useState<"saved" | "removed" | null>(null);

  function set<K extends keyof LoginFormDraft>(key: K, value: LoginFormDraft[K]) {
    onDraftChange({ ...draft, [key]: value });
  }

  async function handleSaveCredential() {
    const validationError = validatePassword(passwordDraft);
    if (validationError) {
      setCredentialError(validationError);
      return;
    }
    setCredentialError(null);
    try {
      await onSaveCredential(passwordDraft);
      setPasswordDraft("");
      setJustSaved("saved");
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : "Unable to save Password.");
    }
  }

  async function handleRemove() {
    setShowRemoveConfirm(false);
    setCredentialError(null);
    try {
      await onRemoveCredential();
      setJustSaved("removed");
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : "Unable to remove Password.");
    }
  }

  return (
    <Card>
      <h3 className="m-0 text-base font-semibold text-gray-900">Login Form</h3>
      <div className="mt-3 flex flex-col gap-3">
        <Input
          label="Login URL"
          value={draft.loginUrl}
          onChange={(e) => set("loginUrl", e.target.value)}
          disabled={readOnly}
          placeholder="https://target.example.com/login"
        />
        <Input label="Username" value={draft.username} onChange={(e) => set("username", e.target.value)} disabled={readOnly} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Username Field" value={draft.usernameField} onChange={(e) => set("usernameField", e.target.value)} disabled={readOnly} placeholder="username" />
          <Input label="Password Field" value={draft.passwordField} onChange={(e) => set("passwordField", e.target.value)} disabled={readOnly} placeholder="password" />
        </div>
        <Input
          label="Token Response Path"
          value={draft.tokenResponsePath}
          onChange={(e) => set("tokenResponsePath", e.target.value)}
          disabled={readOnly}
          placeholder="access_token"
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        {typeSaved ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h4 className="m-0 text-sm font-semibold text-gray-900">Password</h4>
              <Badge tone={credentialStatus === "CONFIGURED" ? "success" : "warning"} label={credentialStatus === "CONFIGURED" ? "Configured" : "Not Configured"} />
            </div>
            {!readOnly && (
              <div className="mt-3 flex flex-col gap-2.5">
                <PasswordInput
                  label={credentialStatus === "CONFIGURED" ? "New Password (replaces the current one)" : "Password"}
                  value={passwordDraft}
                  onChange={(e) => {
                    setPasswordDraft(e.target.value);
                    setJustSaved(null);
                  }}
                  autoComplete="new-password"
                />
                {credentialError && <p className="m-0 text-sm text-error">{credentialError}</p>}
                {!credentialError && justSaved === "saved" && <p className="m-0 text-sm text-success">Password saved.</p>}
                {!credentialError && justSaved === "removed" && <p className="m-0 text-sm text-success">Password removed.</p>}
                <div className="flex gap-2.5">
                  <Button variant="secondary" size="sm" onClick={() => void handleSaveCredential()} disabled={saving || !passwordDraft}>
                    {saving ? "Saving..." : credentialStatus === "CONFIGURED" ? "Replace" : "Configure"}
                  </Button>
                  {credentialStatus === "CONFIGURED" && (
                    <Button variant="danger" size="sm" onClick={() => setShowRemoveConfirm(true)} disabled={saving}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="m-0 text-sm text-muted">Save this Authentication Type before configuring its credential.</p>
        )}
      </div>

      {showRemoveConfirm && (
        <ConfirmDialog
          title="Remove Password"
          message="This removes the saved Password. It cannot be recovered automatically."
          confirmLabel="Remove"
          danger
          onConfirm={() => void handleRemove()}
          onCancel={() => setShowRemoveConfirm(false)}
        />
      )}
    </Card>
  );
}
