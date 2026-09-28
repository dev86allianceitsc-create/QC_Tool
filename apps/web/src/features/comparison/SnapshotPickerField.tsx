import { Input } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView"
import { formatSnapshotShortId } from "../snapshot/snapshot-id.util"
import { useSnapshotPicker } from "./useSnapshotPicker"

// Shared control behind Create Comparison's Pair-A/Pair-B and Chain
// start/end pickers (AnD UI §4 "UI lọc cùng scope để giảm lỗi", deviation #8
// in the plan): a recent-Snapshot dropdown scoped to the caller's chosen
// API+Environment (useSnapshotPicker, reusing listSnapshots — no new
// endpoint), plus a manual-ID text fallback for anything outside that recent
// window. The text input is the actual value passed to onChange; picking
// from the dropdown just fills it.
export function SnapshotPickerField({
  label,
  projectId,
  apiId,
  environmentId,
  accessToken,
  value,
  onChange,
}: {
  label: string
  projectId: string | null
  apiId: string | null
  environmentId: string | null
  accessToken: string | null
  value: string
  onChange: (snapshotId: string) => void
}) {
  const { items, loading, error } = useSnapshotPicker(
    projectId,
    apiId,
    environmentId,
    accessToken,
  )
  const scoped = !!apiId && !!environmentId

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        label={`${label} — recent Snapshots`}
        value={items.some((i) => i.snapshotId === value) ? value : ""}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        disabled={!scoped || loading}
      >
        <option value="">
          {!scoped
            ? "Choose API + Environment first"
            : loading
              ? "Loading…"
              : "— Select a recent Snapshot —"}
        </option>
        {items.map((item) => (
          <option key={item.snapshotId} value={item.snapshotId}>
            {formatSnapshotShortId(item.snapshotId)} ·{" "}
            {formatTimestamp(item.createdAt)}
            {item.snapshotStatus === "INVALIDATED" ? " (invalidated)" : ""}
          </option>
        ))}
      </Select>
      {error && <p className="m-0 text-xs text-error">{error}</p>}
      <Input
        label={`${label} — or enter Snapshot ID`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Snapshot UUID"
        className="font-mono"
      />
    </div>
  )
}
