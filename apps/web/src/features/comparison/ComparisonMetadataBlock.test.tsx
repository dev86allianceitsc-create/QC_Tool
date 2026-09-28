import { render, screen } from "@testing-library/react"

import { describe, expect, it } from "vitest"

import { ComparisonMetadataBlock } from "./ComparisonMetadataBlock"

import type {
  ComparisonSummaryDto,
  SnapshotSummaryDto,
} from "./comparison.types"

function makeSnapshotSummary(
  overrides: Partial<SnapshotSummaryDto> = {},
): SnapshotSummaryDto {
  return {
    projectId: "proj-1",
    apiId: "api-1",
    environmentId: "env-1",
    executionCompletedAt: "2026-09-01T00:00:00.000Z",
    latencyMs: 100,
    apiVersion: "1.0.0",
    databaseVersion: "db-1.0",
    isInvalidatedNow: false,
    ...overrides,
  }
}

function makeComparison(
  overrides: Partial<ComparisonSummaryDto> = {},
): ComparisonSummaryDto {
  return {
    comparisonId: "cmp-1",
    projectId: "proj-1",
    apiId: "api-1",
    environmentId: "env-1",
    baselineSnapshotId: "snap-a",
    targetSnapshotId: "snap-b",
    sourceKind: "AUTO_EXECUTION",
    sourceExecutionId: "exec-1",
    comparisonChainId: null,
    pairOrdinal: null,
    processingStatus: "COMPLETED",
    stoppedAtGate: null,
    reasonCode: null,
    reasonDetailSafe: null,
    inputCheckOutcome: "COMPATIBLE",
    result: "SAME",
    outputDifferenceCount: 0,
    classification: null,
    classificationRevision: null,
    classifiedBy: null,
    classifiedAt: null,
    baselineSnapshot: makeSnapshotSummary(),
    targetSnapshot: makeSnapshotSummary({ latencyMs: 150 }),
    latencyDeltaMs: 50,
    apiVersionChanged: false,
    databaseVersionChanged: false,
    createdAt: "2026-09-02T00:00:05.000Z",
    endedAt: "2026-09-02T00:00:10.000Z",
    ...overrides,
  }
}

describe("ComparisonMetadataBlock", () => {
  it("renders latency A/B/Δ and version rows for both snapshots", () => {
    render(<ComparisonMetadataBlock comparison={makeComparison()} />)

    expect(screen.getByText("100 ms")).toBeInTheDocument()
    expect(screen.getByText("150 ms")).toBeInTheDocument()
    expect(screen.getByText("+50 ms")).toBeInTheDocument()
    expect(screen.getAllByText("1.0.0")).toHaveLength(2)
    expect(screen.getAllByText("db-1.0")).toHaveLength(2)
  })

  it("shows a Version changed badge only when the flag is true", () => {
    render(
      <ComparisonMetadataBlock
        comparison={makeComparison({
          apiVersionChanged: true,
          databaseVersionChanged: false,
        })}
      />,
    )

    expect(screen.getByText("Version changed")).toBeInTheDocument()
    expect(screen.getByText("No change")).toBeInTheDocument()
  })

  // AC-04: this block takes no `result` prop at all, so rendering it with a
  // SAME-shaped vs DIFFERENT-shaped comparison (metadata held constant) must
  // produce identical output — proving metadata never gates on Result.
  it("renders identical metadata regardless of the comparison's result", () => {
    const shared = {
      baselineSnapshot: makeSnapshotSummary({ latencyMs: 80 }),
      targetSnapshot: makeSnapshotSummary({ latencyMs: 220 }),
      latencyDeltaMs: 140,
      apiVersionChanged: true,
      databaseVersionChanged: true,
    }

    const sameRender = render(
      <ComparisonMetadataBlock
        comparison={makeComparison({ ...shared, result: "SAME" })}
      />,
    )
    const sameHtml = sameRender.container.innerHTML
    sameRender.unmount()

    const differentRender = render(
      <ComparisonMetadataBlock
        comparison={makeComparison({ ...shared, result: "DIFFERENT" })}
      />,
    )
    const differentHtml = differentRender.container.innerHTML
    differentRender.unmount()

    expect(differentHtml).toBe(sameHtml)
  })

  // AC-08: a missing side and an unknown version-changed flag must never be
  // rendered as 0/false/"No change" — only the explicit fallback text.
  it("renders No data and Undetermined for null latency/version metadata, never 0/false", () => {
    const { container } = render(
      <ComparisonMetadataBlock
        comparison={makeComparison({
          baselineSnapshot: makeSnapshotSummary({ latencyMs: null }),
          targetSnapshot: makeSnapshotSummary({ latencyMs: null }),
          latencyDeltaMs: null,
          apiVersionChanged: null,
          databaseVersionChanged: null,
        })}
      />,
    )

    expect(screen.getAllByText("No data")).toHaveLength(2)
    expect(screen.getAllByText("Undetermined")).toHaveLength(2)
    expect(screen.queryByText("No change")).not.toBeInTheDocument()
    expect(screen.queryByText("Version changed")).not.toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
    expect(screen.queryByText("false")).not.toBeInTheDocument()

    const deltaCell = container
      .querySelectorAll("tbody tr")[0]
      ?.querySelectorAll("td")[3]
    expect(deltaCell?.textContent).toBe("")
  })
})
