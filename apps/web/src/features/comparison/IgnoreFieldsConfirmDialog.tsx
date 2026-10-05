import { useState } from "react"

import { Button } from "../../components/ui/Button"

import { Modal } from "../../components/ui/Modal"

import { bulkCreateIgnoreRules } from "../projects/ignoreRules.api"

import type { BulkCreateIgnoreRulesResult, IgnoreRuleScope } from "../projects/ignoreRules.types"

import { ApiError } from "../../services/api-client"

// Single confirmation for the whole selection — never one dialog per field
// (Output Ignore Rules spec §5). Created rules only ever affect future
// OUTPUT comparisons; this dialog never touches the comparison being viewed.
export function IgnoreFieldsConfirmDialog({
  paths,

  projectId,

  apiId,

  accessToken,

  onCancel,

  onSuccess,
}: {
  paths: string[]

  projectId: string

  apiId: string

  accessToken: string | null

  onCancel: () => void

  onSuccess: (result: BulkCreateIgnoreRulesResult) => void
}) {
  const [scope, setScope] = useState<IgnoreRuleScope>("API")

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!accessToken) return

    setSaving(true)

    setError(null)

    try {
      const result = await bulkCreateIgnoreRules(
        projectId,
        scope === "API" ? { scope: "API", apiId, paths } : { scope: "PROJECT", paths },
        accessToken,
      )

      onSuccess(result)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to create Ignore Rules.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Ignore ${paths.length} field${paths.length === 1 ? "" : "s"}`} width="440px">
      <ul className="m-0 mb-3 max-h-32 list-none overflow-auto rounded-md border border-border bg-gray-50 p-2">
        {paths.map((path) => (
          <li key={path} className="font-mono text-xs text-gray-900">
            {path}
          </li>
        ))}
      </ul>

      <p className="m-0 mb-2 text-xs font-semibold text-gray-900">
        Apply these Ignore Rules to:
      </p>
      <div role="radiogroup" aria-label="Ignore rule scope" className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-sm text-gray-900">
          <input
            type="radio"
            name="ignoreRuleScope"
            value="API"
            checked={scope === "API"}
            onChange={() => setScope("API")}
          />
          This API (Only this API)
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-900">
          <input
            type="radio"
            name="ignoreRuleScope"
            value="PROJECT"
            checked={scope === "PROJECT"}
            onChange={() => setScope("PROJECT")}
          />
          Entire Project (All APIs in this project)
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-error">{error}</p>}

      <div className="mt-4 flex gap-2.5">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => void handleConfirm()}
          disabled={saving}
        >
          {saving ? "Confirming..." : "Confirm"}
        </Button>
      </div>
    </Modal>
  )
}
