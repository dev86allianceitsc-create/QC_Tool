import { useEffect, useMemo, useState } from "react"

import { ApiError } from "../../services/api-client"

import { listApis } from "../apiEnvironment/apiEnvironment.api"
import { listRuns } from "../apiEnvironment/run.api"
import type { RunListItem } from "../apiEnvironment/run.types"
import { listComparisons } from "../comparison/comparison.api"
import type { ComparisonSummaryDto } from "../comparison/comparison.types"
import type { ProjectListItem } from "../projects/projects.types"
import { listSnapshots } from "../snapshot/snapshot.api"
import { useApiErrorHandler } from "../shared/useApiErrorHandler"

// No cross-project aggregate endpoint exists anywhere in this codebase (every
// Runs/Snapshots/Comparisons/APIs list is scoped to one projectId). Dashboard
// system-wide totals and "recent activity" are therefore built here via a
// bounded per-project fan-out (4 lightweight paged calls/project, all in
// parallel) rather than inventing numbers or waiting on a backend change.
const PER_PROJECT_PAGE_SIZE = 5
const ACTIVITY_POOL_LIMIT = 20
const NEEDS_ATTENTION_LIMIT = 6

export interface DashboardActivityItem {
  key: string
  kind: "run" | "comparison"
  projectId: string
  projectName: string
  createdAt: string
  run?: RunListItem
  comparison?: ComparisonSummaryDto
}

export interface DashboardProjectStats {
  apiCount: number | null
  runCount: number | null
  snapshotCount: number | null
  comparisonCount: number | null
  lastActivityAt: string | null
}

export interface DashboardTotals {
  runs: number
  snapshots: number
  comparisons: number
}

interface ProjectOverviewResult {
  projectId: string
  activity: DashboardActivityItem[]
  stats: DashboardProjectStats
}

function latestOf(...timestamps: (string | null | undefined)[]): string | null {
  const real = timestamps.filter((t): t is string => Boolean(t))
  if (real.length === 0) return null
  return real.reduce((a, b) => (a > b ? a : b))
}

// Flags items already known (from data already fetched for the activity
// feed) to be a problem worth surfacing, without any extra population-level
// query: a run that failed/was interrupted, or a comparison that came back
// DIFFERENT or got stuck FAILED/BLOCKED.
function isNeedsAttention(item: DashboardActivityItem): boolean {
  if (item.kind === "run" && item.run) {
    return item.run.runStatus === "FAILED" || item.run.runStatus === "INTERRUPTED"
  }
  if (item.kind === "comparison" && item.comparison) {
    return (
      item.comparison.result === "DIFFERENT" ||
      item.comparison.processingStatus === "FAILED" ||
      item.comparison.processingStatus === "BLOCKED"
    )
  }
  return false
}

export function useDashboardOverview(
  projects: ProjectListItem[],
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [totals, setTotals] = useState<DashboardTotals | null>(null)
  const [recentActivity, setRecentActivity] = useState<DashboardActivityItem[]>([])
  const [projectStats, setProjectStats] = useState<Map<string, DashboardProjectStats>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  useEffect(() => {
    if (!accessToken || projects.length === 0) {
      setTotals(projects.length === 0 ? { runs: 0, snapshots: 0, comparisons: 0 } : null)
      setRecentActivity([])
      setProjectStats(new Map())
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function loadOne(project: ProjectListItem): Promise<ProjectOverviewResult> {
      const token = accessToken as string
      const [runsResult, comparisonsResult, snapshotsResult, apisResult] = await Promise.allSettled([
        listRuns(
          project.projectId,
          { page: 1, pageSize: PER_PROJECT_PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" },
          token,
        ),
        listComparisons(project.projectId, { page: 1, pageSize: PER_PROJECT_PAGE_SIZE }, token),
        listSnapshots(
          project.projectId,
          { page: 1, pageSize: 1, sortBy: "createdAt", sortOrder: "desc" },
          token,
        ),
        listApis(project.projectId, { page: 1, pageSize: 1 }, token),
      ])

      for (const settled of [runsResult, comparisonsResult, snapshotsResult, apisResult]) {
        if (settled.status === "rejected") handleApiError(settled.reason)
      }

      const runs = runsResult.status === "fulfilled" ? runsResult.value : null
      const comparisons = comparisonsResult.status === "fulfilled" ? comparisonsResult.value : null
      const snapshots = snapshotsResult.status === "fulfilled" ? snapshotsResult.value : null
      const apis = apisResult.status === "fulfilled" ? apisResult.value : null

      const activity: DashboardActivityItem[] = []
      runs?.items.forEach((run) =>
        activity.push({
          key: `run:${run.runId}`,
          kind: "run",
          projectId: project.projectId,
          projectName: project.projectName,
          createdAt: run.createdAt,
          run,
        }),
      )
      comparisons?.items.forEach((comparison) =>
        activity.push({
          key: `comparison:${comparison.comparisonId}`,
          kind: "comparison",
          projectId: project.projectId,
          projectName: project.projectName,
          createdAt: comparison.createdAt,
          comparison,
        }),
      )

      return {
        projectId: project.projectId,
        activity,
        stats: {
          apiCount: apis?.totalItems ?? null,
          runCount: runs?.totalItems ?? null,
          snapshotCount: snapshots?.totalItems ?? null,
          comparisonCount: comparisons?.totalItems ?? null,
          lastActivityAt: latestOf(runs?.items[0]?.createdAt, comparisons?.items[0]?.createdAt, snapshots?.items[0]?.createdAt),
        },
      }
    }

    Promise.all(projects.map(loadOne))
      .then((results) => {
        if (cancelled) return

        const nextStats = new Map<string, DashboardProjectStats>()
        let runsTotal = 0
        let snapshotsTotal = 0
        let comparisonsTotal = 0
        const allActivity: DashboardActivityItem[] = []

        for (const result of results) {
          nextStats.set(result.projectId, result.stats)
          runsTotal += result.stats.runCount ?? 0
          snapshotsTotal += result.stats.snapshotCount ?? 0
          comparisonsTotal += result.stats.comparisonCount ?? 0
          allActivity.push(...result.activity)
        }

        allActivity.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))

        setProjectStats(nextStats)
        setTotals({ runs: runsTotal, snapshots: snapshotsTotal, comparisons: comparisonsTotal })
        setRecentActivity(allActivity.slice(0, ACTIVITY_POOL_LIMIT))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : "Unable to load dashboard overview.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projects, accessToken, handleApiError])

  const needsAttention = useMemo(
    () => recentActivity.filter(isNeedsAttention).slice(0, NEEDS_ATTENTION_LIMIT),
    [recentActivity],
  )

  return { totals, recentActivity, needsAttention, projectStats, loading, error }
}
