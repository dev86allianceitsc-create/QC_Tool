import { useState } from "react"

import { ApiError } from "../../services/api-client"

import { Badge } from "../../components/ui/Badge"

import { Button } from "../../components/ui/Button"

import { Input, Textarea } from "../../components/ui/Input"

import { Modal } from "../../components/ui/Modal"

import { Select } from "../../components/ui/Select"

import { thClass, thCenterClass, tdClass, trHoverClass } from "../../components/ui/table"

import { Toggle } from "../apiEnvironment/Toggle"

import { useApiList } from "../apiEnvironment/useApiList"

import { ConfirmDialog } from "./ConfirmDialog"

import type { IgnoreRuleResult, IgnoreRuleScope } from "./ignoreRules.types"

import type { Role } from "./projects.types"

import { useIgnoreRules } from "./useIgnoreRules"

// Output Ignore Rules — Project Settings tab. Affects OUTPUT comparison
// only (ComparisonEngineService's OUTPUT stage); raw Snapshots and Test
// Case identity are never touched. Create/enable/disable/remove are
// ADMIN-only (RolesGuard on the backend); list is readable by any member.

export function IgnoreRulesScreen({
  user,

  projectId,

  accessToken,

  onSessionExpired,

  onAccessDenied,
}: {
  user: { email: string; role: Role }

  projectId: string

  accessToken: string | null

  onSessionExpired: () => void

  onAccessDenied: () => void
}) {
  const isAdmin = user.role === "ADMIN"

  const { rules, loading, error, refetch, createRule, updateRule, removeRule } =
    useIgnoreRules(projectId, accessToken, onSessionExpired, onAccessDenied)

  const { apis } = useApiList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const [showAddModal, setShowAddModal] = useState(false)

  const [addScope, setAddScope] = useState<IgnoreRuleScope>("API")

  const [addApiId, setAddApiId] = useState("")

  const [addPath, setAddPath] = useState("")

  const [addNote, setAddNote] = useState("")

  const [addError, setAddError] = useState<string | null>(null)

  const [addSaving, setAddSaving] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<IgnoreRuleResult | null>(
    null,
  )

  const [removeError, setRemoveError] = useState<string | null>(null)

  const [toggleError, setToggleError] = useState<string | null>(null)

  function openAddModal() {
    setAddScope("API")

    setAddApiId(apis[0]?.apiId ?? "")

    setAddPath("")

    setAddNote("")

    setAddError(null)

    setShowAddModal(true)
  }

  async function handleAdd() {
    const path = addPath.trim()

    if (!path.startsWith("$")) {
      setAddError("Path must start with $.")

      return
    }

    if (addScope === "API" && !addApiId) {
      setAddError("Select an API for an API-scoped rule.")

      return
    }

    setAddSaving(true)

    setAddError(null)

    try {
      await createRule(
        addScope === "API"
          ? { scope: "API", apiId: addApiId, path, note: addNote.trim() || undefined }
          : { scope: "PROJECT", path, note: addNote.trim() || undefined },
      )

      setShowAddModal(false)
    } catch (err) {
      setAddError(
        err instanceof ApiError ? err.message : "Unable to create Ignore Rule.",
      )
    } finally {
      setAddSaving(false)
    }
  }

  async function handleToggle(rule: IgnoreRuleResult) {
    setToggleError(null)

    try {
      await updateRule(rule.ignoreRuleId, !rule.enabled)
    } catch (err) {
      setToggleError(
        err instanceof ApiError ? err.message : "Unable to update Ignore Rule.",
      )
    }
  }

  async function handleRemove() {
    if (!removeTarget) return

    setRemoveError(null)

    try {
      await removeRule(removeTarget.ignoreRuleId)

      setRemoveTarget(null)
    } catch (err) {
      setRemoveError(
        err instanceof ApiError ? err.message : "Unable to remove Ignore Rule.",
      )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2.5 border-b border-border p-5">
        <p className="m-0 text-sm text-muted">
          Fields matched by an enabled rule are excluded from OUTPUT
          comparison only. Raw Snapshots and comparison history are never
          changed.
        </p>
        {isAdmin && (
          <Button variant="primary" className="shrink-0" onClick={openAddModal}>
            + Add Ignore Rule
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading && <p className="text-sm text-muted">Loading Ignore Rules...</p>}

        {!loading && error && (
          <div>
            <p className="text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && rules.length === 0 && (
          <p className="text-sm text-muted">No Ignore Rules yet for this Project.</p>
        )}

        {!loading && !error && rules.length > 0 && (
          <>
            {toggleError && (
              <p className="mb-2.5 text-sm text-error">{toggleError}</p>
            )}
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Path</th>
                  <th className={thClass}>Scope</th>
                  <th className={thClass}>API</th>
                  <th className={thCenterClass}>Enabled</th>
                  {isAdmin && <th className={thCenterClass}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.ignoreRuleId} className={trHoverClass}>
                    <td className={`${tdClass} font-mono`}>{rule.path}</td>
                    <td className={tdClass}>
                      <Badge
                        tone={rule.scope === "PROJECT" ? "info" : "neutral"}
                        label={rule.scope === "PROJECT" ? "Project" : "API"}
                      />
                    </td>
                    <td className={tdClass}>
                      {rule.scope === "API"
                        ? `${rule.apiMethod} ${rule.apiPath}`
                        : "All APIs"}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <Toggle
                        checked={rule.enabled}
                        onChange={() => void handleToggle(rule)}
                        disabled={!isAdmin}
                        label={rule.enabled ? "Enabled" : "Disabled"}
                      />
                    </td>
                    {isAdmin && (
                      <td className={`${tdClass} text-center`}>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setRemoveError(null)

                            setRemoveTarget(rule)
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {showAddModal && (
        <Modal title="Add Ignore Rule" width="480px">
          <div className="mb-3">
            <Select
              label="Scope"
              value={addScope}
              onChange={(e) => setAddScope(e.target.value as IgnoreRuleScope)}
            >
              <option value="API">API (only this API)</option>
              <option value="PROJECT">Project (all APIs in this project)</option>
            </Select>
          </div>

          {addScope === "API" && (
            <div className="mb-3">
              <Select
                label="API"
                value={addApiId}
                onChange={(e) => setAddApiId(e.target.value)}
              >
                <option value="">Select an API...</option>
                {apis.map((api) => (
                  <option key={api.apiId} value={api.apiId}>
                    {api.httpMethod} {api.path}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="mb-3">
            <Input
              label="Path"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              placeholder="$.Data.Status"
            />
          </div>

          <div className="mb-3">
            <Textarea
              label="Note (optional)"
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              placeholder="Why this field is ignored"
            />
          </div>

          {addError && <p className="text-xs text-error">{addError}</p>}

          <div className="mt-4 flex gap-2.5">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => void handleAdd()}
              disabled={addSaving}
            >
              {addSaving ? "Adding..." : "Add Rule"}
            </Button>
          </div>
        </Modal>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Delete Ignore Rule"
          message={
            `This will stop ignoring "${removeTarget.path}" in future comparisons. Past comparison results are not changed.` +
            (removeError ? `\n${removeError}` : "")
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => void handleRemove()}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
