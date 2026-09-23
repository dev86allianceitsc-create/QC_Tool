import { useState } from "react";
import { ApiError } from "../../services/api-client";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import { validateToken } from "./authentication.util";
import type { CredentialStatus } from "./authentication.types";

// UI-AUTH — Bearer Token has no non-secret config, only the secret action
// (Configure/Replace/Remove). A leading "Bearer " prefix is stripped
// server-side, so it is accepted here too without being treated as an error.
export function BearerTokenCredentialFields({
  readOnly,
  credentialStatus,
  saving,
  onSaveCredential,
  onRemoveCredential,
}: {
  readOnly?: boolean;
  credentialStatus: CredentialStatus;
  saving?: boolean;
  onSaveCredential: (token: string) => Promise<void>;
  onRemoveCredential: () => Promise<void>;
}) {
  const [tokenDraft, setTokenDraft] = useState("");
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [justSaved, setJustSaved] = useState<"saved" | "removed" | null>(null);

  async function handleSaveCredential() {
    const validationError = validateToken(tokenDraft);
    if (validationError) {
      setCredentialError(validationError);
      return;
    }
    setCredentialError(null);
    try {
      await onSaveCredential(tokenDraft);
      setTokenDraft("");
      setJustSaved("saved");
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : "Unable to save Token.");
    }
  }

  async function handleRemove() {
    setShowRemoveConfirm(false);
    setCredentialError(null);
    try {
      await onRemoveCredential();
      setJustSaved("removed");
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : "Unable to remove Token.");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h3 className="m-0 text-base font-semibold text-gray-900">Bearer Token</h3>
        <Badge tone={credentialStatus === "CONFIGURED" ? "success" : "warning"} label={credentialStatus === "CONFIGURED" ? "Configured" : "Not Configured"} />
      </div>
      {!readOnly && (
        <div className="mt-3 flex flex-col gap-2.5">
          <PasswordInput
            label={credentialStatus === "CONFIGURED" ? "New Token (replaces the current one)" : "Token"}
            value={tokenDraft}
            onChange={(e) => {
              setTokenDraft(e.target.value);
              setJustSaved(null);
            }}
            placeholder="Bearer eyJhbGciOi..."
            autoComplete="off"
          />
          {credentialError && <p className="m-0 text-sm text-error">{credentialError}</p>}
          {!credentialError && justSaved === "saved" && <p className="m-0 text-sm text-success">Token saved.</p>}
          {!credentialError && justSaved === "removed" && <p className="m-0 text-sm text-success">Token removed.</p>}
          <div className="flex gap-2.5">
            <Button variant="secondary" size="sm" onClick={() => void handleSaveCredential()} disabled={saving || !tokenDraft}>
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

      {showRemoveConfirm && (
        <ConfirmDialog
          title="Remove Token"
          message="This removes the saved Token. It cannot be recovered automatically."
          confirmLabel="Remove"
          danger
          onConfirm={() => void handleRemove()}
          onCancel={() => setShowRemoveConfirm(false)}
        />
      )}
    </Card>
  );
}
