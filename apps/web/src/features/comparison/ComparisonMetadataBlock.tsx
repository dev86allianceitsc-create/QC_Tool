import { Badge } from "../../components/ui/Badge"
import { thClass, tdClass } from "../../components/ui/table"
import {
  formatLatencyDeltaMs,
  formatLatencyMs,
  getVersionChangedDisplay,
  type VersionChangedDisplay,
} from "./comparison-format.util"
import type { ComparisonSummaryDto } from "./comparison.types"

// Flow 5 (plan): Latency A/B/Δ + API/DB Version A/B, rendered identically
// regardless of `result` — this block is purely informational and never
// gates or influences the Result badge (AC-04). Null latency/version-changed
// values render as "No data"/"Undetermined" text, never 0/false (AC-08).
export function ComparisonMetadataBlock({
  comparison,
}: {
  comparison: ComparisonSummaryDto
}) {
  return (
    <div>
      <h4 className="m-0 mb-1.5 text-xs font-semibold text-gray-900">
        Metadata
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass}>Metric</th>
              <th className={thClass}>Snapshot A</th>
              <th className={thClass}>Snapshot B</th>
              <th className={thClass}>Δ / Change</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tdClass}>Latency</td>
              <td className={`${tdClass} font-mono`}>
                {formatLatencyMs(comparison.baselineSnapshot.latencyMs)}
              </td>
              <td className={`${tdClass} font-mono`}>
                {formatLatencyMs(comparison.targetSnapshot.latencyMs)}
              </td>
              <td className={`${tdClass} font-mono`}>
                {formatLatencyDeltaMs(comparison.latencyDeltaMs)}
              </td>
            </tr>
            <tr>
              <td className={tdClass}>API Version</td>
              <td className={`${tdClass} font-mono`}>
                {comparison.baselineSnapshot.apiVersion}
              </td>
              <td className={`${tdClass} font-mono`}>
                {comparison.targetSnapshot.apiVersion}
              </td>
              <td className={tdClass}>
                <VersionChangeCell
                  display={getVersionChangedDisplay(
                    comparison.apiVersionChanged,
                  )}
                />
              </td>
            </tr>
            <tr>
              <td className={tdClass}>Database Version</td>
              <td className={`${tdClass} font-mono`}>
                {comparison.baselineSnapshot.databaseVersion}
              </td>
              <td className={`${tdClass} font-mono`}>
                {comparison.targetSnapshot.databaseVersion}
              </td>
              <td className={tdClass}>
                <VersionChangeCell
                  display={getVersionChangedDisplay(
                    comparison.databaseVersionChanged,
                  )}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VersionChangeCell({ display }: { display: VersionChangedDisplay }) {
  if (display.kind === "changed")
    return <Badge tone="info" label="Version changed" />
  if (display.kind === "unchanged")
    return <span className="text-muted">No change</span>
  return <span className="text-muted">Undetermined</span>
}
