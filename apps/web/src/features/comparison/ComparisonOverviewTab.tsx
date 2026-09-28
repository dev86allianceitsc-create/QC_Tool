import { ComparisonMetadataBlock } from "./ComparisonMetadataBlock"
import {
  getInputCheckOutcomeLabel,
  getSourceKindLabel,
} from "./comparison-format.util"
import type { ComparisonDetailDto } from "./comparison.types"

// Tab 1 of Comparison Detail (plan Flow 3). Deliberately does not repeat the
// Processing status / Result boxes — those live in ComparisonDetailScreen's
// header, visible regardless of active tab. `appliedRuleSummary` is
// null-safe rather than gated on `processingStatus` because the backend
// itself only ever populates it once terminal (comparison.types.ts).
export function ComparisonOverviewTab({
  comparison,
}: {
  comparison: ComparisonDetailDto
}) {
  const differenceCount = comparison.outputDifferenceCount

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h4 className="m-0 mb-1.5 text-xs font-semibold text-gray-900">
          Overview
        </h4>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-900 sm:grid-cols-4">
          <div>
            <dt className="text-muted">Source</dt>
            <dd className="m-0">
              {getSourceKindLabel(
                comparison.sourceKind,
                comparison.pairOrdinal,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Input check</dt>
            <dd className="m-0">
              {getInputCheckOutcomeLabel(comparison.inputCheckOutcome)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Output differences</dt>
            <dd className="m-0">
              {differenceCount !== null
                ? `${differenceCount} output difference${
                    differenceCount === 1 ? "" : "s"
                  }`
                : "Not yet determined"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Latest attempt</dt>
            <dd className="m-0">#{comparison.latestAttemptNumber}</dd>
          </div>
        </dl>
      </div>

      <ComparisonMetadataBlock comparison={comparison} />

      {comparison.appliedRuleSummary && (
        <div>
          <h4 className="m-0 mb-1.5 text-xs font-semibold text-gray-900">
            Applied rules
          </h4>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-900 sm:grid-cols-3">
            <div>
              <dt className="text-muted">Rule manifest version</dt>
              <dd className="m-0 font-mono">
                {comparison.appliedRuleSummary.ruleManifestVersion}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Representation boundary</dt>
              <dd className="m-0">
                {comparison.appliedRuleSummary.representationBoundary}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Exclusions applied</dt>
              <dd className="m-0">
                {comparison.appliedRuleSummary.exclusionCount}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
