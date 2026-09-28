import { useState } from "react"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Select } from "../../components/ui/Select"
import { TabBar, type TabBarItem } from "../../components/ui/TabBar"
import { useApiList } from "../apiEnvironment/useApiList"
import { useEnvironmentList } from "../apiEnvironment/useEnvironmentList"
import { getAvailabilityReasonMessage } from "./comparison-format.util"
import type {
  ComparisonAvailabilityResult,
  CreateComparisonResponse,
} from "./comparison.types"
import { SnapshotPickerField } from "./SnapshotPickerField"
import { useCreateComparison } from "./useCreateComparison"
import {
  useLatestAuthContext,
  type LatestAuthContextResult,
} from "./useLatestAuthContext"

type CreateComparisonTabKey = "BASELINE_LATEST" | "PAIR" | "CHAIN"

const TABS: TabBarItem[] = [
  { key: "BASELINE_LATEST", label: "Baseline vs latest" },
  { key: "PAIR", label: "Two Snapshots" },
  { key: "CHAIN", label: "Sequential chain" },
]

// Discriminates the create-comparison 201/200 union. Kept as a standalone
// guard (rather than inlined) because it's applied to both the
// BASELINE_LATEST and PAIR submit paths — PAIR's request never actually
// triggers the availability shape server-side, but the hook's return type is
// still the full union, so the narrow is needed either way.
function isAvailabilityResult(
  result: CreateComparisonResponse,
): result is ComparisonAvailabilityResult {
  return "availabilityReasonCode" in result
}

function AuthContextChip({ result }: { result: LatestAuthContextResult }) {
  if (result.status === "loading")
    return <p className="m-0 text-xs text-muted">Resolving auth context…</p>
  if (result.status === "error")
    return <p className="m-0 text-xs text-error">{result.message}</p>
  if (result.status === "no-snapshot") {
    return (
      <p className="m-0 text-xs text-muted">
        No Snapshot yet for this API + Environment.
      </p>
    )
  }
  return (
    <p
      className="m-0 truncate text-xs text-gray-900"
      title={result.label ?? result.key}
    >
      <span className="font-semibold">Auth context:</span>{" "}
      {result.label ?? result.key}
    </p>
  )
}

// UI-CMP-02 (plan Flow 2). API + Environment are chosen once and shared
// across all 3 tabs: BASELINE_LATEST needs them for the request itself,
// PAIR/CHAIN only use them to scope their SnapshotPickerFields (deviation
// #8) — one scope selection keeps A/B/start/end pickers from silently
// drifting to mismatched APIs or Environments.
export function CreateComparisonModal({
  projectId,
  accessToken,
  onSessionExpired,
  onAccessDenied,
  onCreated,
  onChainCreated,
  onCancel,
}: {
  projectId: string
  accessToken: string | null
  onSessionExpired: () => void
  onAccessDenied: () => void
  onCreated: (comparisonId: string) => void
  onChainCreated: (comparisonChainId: string) => void
  onCancel: () => void
}) {
  const [tab, setTab] = useState<CreateComparisonTabKey>("BASELINE_LATEST")
  const [apiId, setApiId] = useState("")
  const [environmentId, setEnvironmentId] = useState("")
  const [snapshotA, setSnapshotA] = useState("")
  const [snapshotB, setSnapshotB] = useState("")
  const [chainStart, setChainStart] = useState("")
  const [chainEnd, setChainEnd] = useState("")
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(
    null,
  )

  const { apis } = useApiList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )
  const { environments } = useEnvironmentList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )
  const authContext = useLatestAuthContext(
    projectId,
    apiId || null,
    environmentId || null,
    accessToken,
  )
  const {
    state,
    error,
    submitPair,
    submitBaselineLatest,
    submitChain,
    resetError,
  } = useCreateComparison(projectId, accessToken)

  function handleTabChange(key: string) {
    setTab(key as CreateComparisonTabKey)
    setAvailabilityMessage(null)
    resetError()
  }

  async function handleSubmit() {
    setAvailabilityMessage(null)
    if (tab === "BASELINE_LATEST") {
      if (!apiId || !environmentId) return
      const authContextRef =
        authContext.status === "resolved" ? authContext.key : undefined
      const result = await submitBaselineLatest(
        apiId,
        environmentId,
        authContextRef,
      )
      if (!result) return
      if (isAvailabilityResult(result)) {
        setAvailabilityMessage(
          getAvailabilityReasonMessage(result.availabilityReasonCode),
        )
        return
      }
      onCreated(result.comparisonId)
    } else if (tab === "PAIR") {
      if (!snapshotA.trim() || !snapshotB.trim()) return
      const result = await submitPair(snapshotA.trim(), snapshotB.trim())
      if (!result) return
      if (isAvailabilityResult(result)) {
        setAvailabilityMessage(
          getAvailabilityReasonMessage(result.availabilityReasonCode),
        )
        return
      }
      onCreated(result.comparisonId)
    } else {
      if (!chainStart.trim() || !chainEnd.trim()) return
      const result = await submitChain(chainStart.trim(), chainEnd.trim())
      if (!result) return
      onChainCreated(result.comparisonChainId)
    }
  }

  const canSubmit =
    tab === "BASELINE_LATEST"
      ? !!apiId && !!environmentId
      : tab === "PAIR"
        ? !!snapshotA.trim() && !!snapshotB.trim()
        : !!chainStart.trim() && !!chainEnd.trim()

  return (
    <Modal title="Create Comparison" width="640px">
      <TabBar
        items={TABS}
        activeKey={tab}
        onSelect={handleTabChange}
        ariaLabel="Create Comparison mode"
      />
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex gap-2.5">
          <div className="flex-1">
            <Select
              label="API *"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
            >
              <option value="">— Select an API —</option>
              {apis.map((a) => (
                <option key={a.apiId} value={a.apiId}>
                  {a.apiName}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Select
              label="Environment *"
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
            >
              <option value="">— Select an Environment —</option>
              {environments.map((e) => (
                <option key={e.environmentId} value={e.environmentId}>
                  {e.environmentName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {tab === "BASELINE_LATEST" && (
          <div className="rounded-md border border-border bg-gray-50 p-2.5">
            <AuthContextChip result={authContext} />
          </div>
        )}

        {tab === "PAIR" && (
          <div className="flex flex-col gap-3">
            <SnapshotPickerField
              label="Snapshot A"
              projectId={projectId}
              apiId={apiId || null}
              environmentId={environmentId || null}
              accessToken={accessToken}
              value={snapshotA}
              onChange={setSnapshotA}
            />
            <SnapshotPickerField
              label="Snapshot B"
              projectId={projectId}
              apiId={apiId || null}
              environmentId={environmentId || null}
              accessToken={accessToken}
              value={snapshotB}
              onChange={setSnapshotB}
            />
          </div>
        )}

        {tab === "CHAIN" && (
          <div className="flex flex-col gap-3">
            <SnapshotPickerField
              label="Chain start"
              projectId={projectId}
              apiId={apiId || null}
              environmentId={environmentId || null}
              accessToken={accessToken}
              value={chainStart}
              onChange={setChainStart}
            />
            <SnapshotPickerField
              label="Chain end"
              projectId={projectId}
              apiId={apiId || null}
              environmentId={environmentId || null}
              accessToken={accessToken}
              value={chainEnd}
              onChange={setChainEnd}
            />
          </div>
        )}

        {availabilityMessage && (
          <p className="m-0 text-xs text-warning">{availabilityMessage}</p>
        )}
        {error && <p className="m-0 text-xs text-error">{error}</p>}

        <div className="flex gap-2.5 border-t border-border pt-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSubmit}
            disabled={state === "submitting" || !canSubmit}
          >
            {state === "submitting" ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
