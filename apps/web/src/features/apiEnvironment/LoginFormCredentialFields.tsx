import { Card } from "../../components/ui/Card"

import { Input } from "../../components/ui/Input"

import type { LoginFormDraft } from "./authentication.util"

// UI-AUTH — non-secret Login Form structural config fields (Login URL,
// Username Field, Password Field), shared by every Test Account saved for
// this Environment. These are always editable once Login Form is selected —
// they must be, since validateLoginFormDraft requires them before the
// Authentication Type can be saved as LOGIN_FORM in the first place.
// REVISION 3C-R02: the actual username/password now live on per-Environment
// Test Accounts (see TestAccountsPanel.tsx), not here. The access token is
// no longer a configured path — it is auto-detected from the login
// response body (findAccessToken in run-dispatch.util.ts).

export function LoginFormCredentialFields({
  draft,

  onDraftChange,

  readOnly,
}: {
  draft: LoginFormDraft

  onDraftChange: (next: LoginFormDraft) => void

  readOnly?: boolean
}) {
  function set<K extends keyof LoginFormDraft>(
    key: K,
    value: LoginFormDraft[K],
  ) {
    onDraftChange({ ...draft, [key]: value })
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Username Field"
            value={draft.usernameField}
            onChange={(e) => set("usernameField", e.target.value)}
            disabled={readOnly}
            placeholder="username"
          />
          <Input
            label="Password Field"
            value={draft.passwordField}
            onChange={(e) => set("passwordField", e.target.value)}
            disabled={readOnly}
            placeholder="password"
          />
        </div>
      </div>
    </Card>
  )
}
