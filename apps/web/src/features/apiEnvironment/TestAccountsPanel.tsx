import { useState } from "react"

import { ApiError } from "../../services/api-client"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

import { thClass, thCenterClass, tdClass, trHoverClass } from "../../components/ui/table"

import { ConfirmDialog } from "../projects/ConfirmDialog"

import { CreateEditTestAccountModal } from "./CreateEditTestAccountModal"

import type { TestAccount } from "./authentication.types"

// REVISION 3C-R02 — Login Form Test Accounts for this Environment. Shown
// only while the saved Authentication Type is LOGIN_FORM (AuthenticationTab
// already gates the draft the same way for its own fields). Chosen per-Run,
// never edited here — this panel only manages the saved set.

export function TestAccountsPanel({
  testAccounts,

  loading,

  error,

  saving,

  readOnly,

  onRefetch,

  onCreate,

  onUpdate,

  onRemove,
}: {
  testAccounts: TestAccount[]

  loading: boolean

  error: string | null

  saving?: boolean

  readOnly?: boolean

  onRefetch: () => Promise<void>

  onCreate: (input: { label: string; username: string; password: string }) => Promise<void>

  onUpdate: (
    testAccountId: string,
    input: { label?: string; username?: string; password?: string },
  ) => Promise<void>

  onRemove: (testAccountId: string) => Promise<void>
}) {
  const [showModal, setShowModal] = useState<"create" | TestAccount | null>(
    null,
  )

  const [modalError, setModalError] = useState<string | null>(null)

  const [modalSaving, setModalSaving] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<TestAccount | null>(null)

  const [removeError, setRemoveError] = useState<string | null>(null)

  async function handleSave(input: {
    label: string
    username: string
    password?: string
  }) {
    setModalSaving(true)

    setModalError(null)

    try {
      if (showModal === "create") {
        if (!input.password) {
          setModalError("Password is required.")

          return
        }

        await onCreate({ ...input, password: input.password })
      } else if (showModal) {
        await onUpdate(showModal.testAccountId, input)
      }

      setShowModal(null)
    } catch (err) {
      setModalError(
        err instanceof ApiError ? err.message : "Unable to save Test Account.",
      )
    } finally {
      setModalSaving(false)
    }
  }

  async function handleRemove() {
    if (!removeTarget) return

    setRemoveError(null)

    try {
      await onRemove(removeTarget.testAccountId)

      setRemoveTarget(null)
    } catch (err) {
      setRemoveError(
        err instanceof ApiError
          ? err.message
          : "Unable to remove Test Account.",
      )
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h3 className="m-0 text-base font-semibold text-gray-900">
          Test Accounts
        </h3>
        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setModalError(null)

              setShowModal("create")
            }}
          >
            + Add Test Account
          </Button>
        )}
      </div>

      <div className="mt-3">
        {loading && <p className="text-sm text-muted">Loading Test Accounts...</p>}

        {!loading && error && (
          <div>
            <p className="text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void onRefetch()}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && testAccounts.length === 0 && (
          <p className="text-sm text-muted">
            No Test Accounts yet for this Environment.
          </p>
        )}

        {!loading && !error && testAccounts.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Label</th>
                <th className={thClass}>Username</th>
                {!readOnly && <th className={thCenterClass}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {testAccounts.map((account) => (
                <tr key={account.testAccountId} className={trHoverClass}>
                  <td className={`${tdClass} font-medium`}>{account.label}</td>
                  <td className={tdClass}>{account.username}</td>
                  {!readOnly && (
                    <td className={`${tdClass} text-center`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mr-1.5"
                        onClick={() => {
                          setModalError(null)

                          setShowModal(account)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRemoveError(null)

                          setRemoveTarget(account)
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CreateEditTestAccountModal
          editing={showModal === "create" ? null : showModal}
          saving={modalSaving || saving}
          error={modalError}
          onSave={(input) => void handleSave(input)}
          onCancel={() => setShowModal(null)}
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove Test Account"
          message={
            `This will remove "${removeTarget.label}" (${removeTarget.username}). It cannot be recovered automatically. Any Run History that already used it is unaffected.` +
            (removeError ? `\n${removeError}` : "")
          }
          confirmLabel="Remove"
          danger
          onConfirm={() => void handleRemove()}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </Card>
  )
}
