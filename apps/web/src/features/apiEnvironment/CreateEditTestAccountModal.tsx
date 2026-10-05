import { useState } from "react"

import type { TestAccount } from "./authentication.types"

import { validatePassword } from "./authentication.util"

import { Button } from "../../components/ui/Button"

import { Input } from "../../components/ui/Input"

import { Modal } from "../../components/ui/Modal"

import { PasswordInput } from "../../components/ui/PasswordInput"

// REVISION 3C-R02 — Test Account create/edit, modeled on
// CreateEditEnvironmentModal.tsx. Password is required on Create and optional
// on Edit (omitted means "keep the current password" — it is never returned
// by the backend to pre-fill or compare against).

export function CreateEditTestAccountModal({
  editing,

  saving,

  error,

  onSave,

  onCancel,
}: {
  editing: TestAccount | null

  saving?: boolean

  error?: string | null

  onSave: (input: { label: string; username: string; password?: string }) => void

  onCancel: () => void
}) {
  const [label, setLabel] = useState(editing?.label ?? "")

  const [username, setUsername] = useState(editing?.username ?? "")

  const [password, setPassword] = useState("")

  const [localError, setLocalError] = useState<string | null>(null)

  function handleSave() {
    if (!label.trim()) {
      setLocalError("Label is required.")

      return
    }

    if (!username.trim()) {
      setLocalError("Username is required.")

      return
    }

    if (!editing || password) {
      const passwordError = validatePassword(password)

      if (passwordError) {
        setLocalError(passwordError)

        return
      }
    }

    setLocalError(null)

    onSave({
      label: label.trim(),
      username: username.trim(),
      ...(password ? { password } : {}),
    })
  }

  const displayError = localError ?? error ?? null

  return (
    <Modal title={editing ? "Edit Test Account" : "Add Test Account"}>
      <div className="mb-3">
        <Input
          label="Label *"
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value)

            setLocalError(null)
          }}
          placeholder="e.g. Standard User, Admin User"
        />
      </div>
      <div className="mb-3">
        <Input
          label="Username *"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)

            setLocalError(null)
          }}
          placeholder="username"
        />
      </div>
      <div className="mb-3">
        <PasswordInput
          label={editing ? "New Password (leave blank to keep current)" : "Password *"}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)

            setLocalError(null)
          }}
          autoComplete="off"
        />
      </div>
      {displayError && <p className="text-xs text-error">{displayError}</p>}
      <div className="flex gap-2.5">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  )
}
