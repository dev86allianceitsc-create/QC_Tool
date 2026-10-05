import { useState } from "react"

import { useNavigate } from "react-router-dom"

import { Header } from "../../components/Header"

import { Badge, type BadgeTone } from "../../components/ui/Badge"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

import {
  getProcessingStatusDisplay,
  getResultDisplay,
  getSourceKindLabel,
} from "../comparison/comparison-format.util"

import type { Role } from "../projects/projects.types"

import { StatusBadge } from "../projects/StatusBadge"

import { useProjectsList } from "../projects/useProjectsList"

import type { DashboardActivityItem, DashboardProjectStats } from "./useDashboardOverview"

import { useDashboardOverview } from "./useDashboardOverview"

const PROJECT_CARDS_LIMIT = 8
const RECENT_ACTIVITY_DISPLAY_LIMIT = 6

// No dedicated Run status-tone mapping exists elsewhere in this codebase
// (runStatus is an untyped string on the backend) — this is a best-effort,
// dashboard-local display mapping covering the known execution-status
// literals; anything unrecognized safely falls back to neutral.
const RUN_STATUS_TONE: Record<string, BadgeTone> = {
  COMPLETED: "success",
  RUNNING: "info",
  FAILED: "danger",
  INTERRUPTED: "danger",
  PENDING: "neutral",
  SKIPPED: "neutral",
  NOT_EXECUTED: "neutral",
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function SummaryCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card padding="lg">
      <p className="m-0 text-sm font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-3 text-4xl font-semibold text-gray-900">
        {value === null ? "—" : value}
      </p>
    </Card>
  )
}

function ActivityKindAvatar({ kind }: { kind: DashboardActivityItem["kind"] }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
      {kind === "run" ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <polygon points="7,4 20,12 7,20" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <circle cx="9" cy="12" r="6" />
          <circle cx="15" cy="12" r="6" />
        </svg>
      )}
    </span>
  )
}

// Neither RunListItem nor ComparisonSummaryDto carries a human-readable
// name (only a raw apiId) and resolving one would require an extra fetch
// per row, so the primary text instead uses real, already-fetched fields:
// the run's type, or the comparison's source-kind label.
function getActivityPrimaryText(item: DashboardActivityItem): string {
  if (item.kind === "run" && item.run) {
    return item.run.runType === "BATCH" ? "Batch Test Run" : "Single Test Run"
  }
  if (item.kind === "comparison" && item.comparison) {
    return `${getSourceKindLabel(item.comparison.sourceKind, item.comparison.pairOrdinal)} Comparison`
  }
  return "Activity"
}

// Deep-links straight to the specific run/comparison detail page (both ids
// are already present on the fetched item, no extra fetch needed) instead
// of just the project workspace.
function getActivityHref(item: DashboardActivityItem): string {
  if (item.kind === "run" && item.run) {
    return `/projects/${item.projectId}/runs/${item.run.runId}`
  }
  if (item.kind === "comparison" && item.comparison) {
    return `/projects/${item.projectId}/comparisons/${item.comparison.comparisonId}`
  }
  return `/projects/${item.projectId}`
}

function ActivityRow({
  item,
  onOpen,
}: {
  item: DashboardActivityItem
  onOpen: () => void
}) {
  const unknownBadge = { label: "Unknown", tone: "neutral" as BadgeTone }

  const badge =
    item.kind === "comparison" && item.comparison
      ? getResultDisplay(item.comparison.processingStatus, item.comparison.result) ??
        getProcessingStatusDisplay(item.comparison.processingStatus, item.comparison.reasonCode) ??
        unknownBadge
      : item.run
        ? { label: item.run.runStatus, tone: RUN_STATUS_TONE[item.run.runStatus] ?? "neutral" }
        : unknownBadge

  return (
    <Card
      className="flex cursor-pointer items-center gap-3 hover:bg-gray-50"
      onClick={onOpen}
    >
      <ActivityKindAvatar kind={item.kind} />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-semibold text-gray-900">
          {getActivityPrimaryText(item)}
        </p>
        <p className="m-0 mt-0.5 truncate text-xs text-muted">
          {item.projectName} · {formatDateTime(item.createdAt)}
        </p>
      </div>
      <Badge tone={badge.tone} label={badge.label} />
    </Card>
  )
}

function ProjectMiniStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="m-0 mt-0.5 text-base font-semibold text-gray-900">
        {value === null ? "—" : value}
      </p>
    </div>
  )
}

function ProjectOverviewCard({
  project,
  stats,
  statsLoading,
  onOpen,
}: {
  project: { projectId: string; projectName: string; projectStatus: "ACTIVE" | "INACTIVE" }
  stats: DashboardProjectStats | null
  statsLoading: boolean
  onOpen: () => void
}) {
  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-base font-semibold text-gray-900">
            {project.projectName}
          </p>
          <div className="mt-1.5">
            <StatusBadge status={project.projectStatus} />
          </div>
        </div>
        <Button variant="secondary" size="md" onClick={onOpen}>
          Open
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <ProjectMiniStat label="APIs" value={statsLoading ? null : stats?.apiCount ?? null} />
        <ProjectMiniStat label="Runs" value={statsLoading ? null : stats?.runCount ?? null} />
        <ProjectMiniStat
          label="Snapshots"
          value={statsLoading ? null : stats?.snapshotCount ?? null}
        />
        <ProjectMiniStat
          label="Comparisons"
          value={statsLoading ? null : stats?.comparisonCount ?? null}
        />
      </div>

      <p className="mt-4 text-xs text-muted">
        {statsLoading
          ? "Loading activity..."
          : stats?.lastActivityAt
            ? `Last activity: ${formatDateTime(stats.lastActivityAt)}`
            : "No activity yet"}
      </p>
    </Card>
  )
}

// Landing page after login. Every number shown here is real: Projects comes
// from useProjectsList directly, and Test Runs/Snapshots/Comparisons totals +
// Recent Activity + per-project stats come from useDashboardOverview's
// per-project fan-out (see that file's header comment) — no metric is
// invented to fill space.
export function DashboardScreen({
  user,

  accessToken,

  onLogout,

  onShowSessionExpired,

  onSessionExpired,

  onAccessDenied,
}: {
  user: { email: string; role: Role }

  accessToken: string | null

  onLogout: () => void

  onShowSessionExpired?: () => void

  onSessionExpired: () => void

  onAccessDenied: () => void
}) {
  const isAdmin = user.role === "ADMIN"

  const navigate = useNavigate()

  const [showAllActivity, setShowAllActivity] = useState(false)

  const { projects, loading, error } = useProjectsList(
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const {
    totals,
    recentActivity,
    needsAttention,
    projectStats,
    loading: overviewLoading,
  } = useDashboardOverview(projects, accessToken, onSessionExpired, onAccessDenied)

  const visibleActivity = showAllActivity
    ? recentActivity
    : recentActivity.slice(0, RECENT_ACTIVITY_DISPLAY_LIMIT)

  const displayedProjects = [...projects]
    .sort((a, b) => {
      const aTime = projectStats.get(a.projectId)?.lastActivityAt ?? null
      const bTime = projectStats.get(b.projectId)?.lastActivityAt ?? null
      if (aTime && bTime) return aTime > bTime ? -1 : 1
      if (aTime) return -1
      if (bTime) return 1
      return 0
    })
    .slice(0, PROJECT_CARDS_LIMIT)

  return (
    <div className="flex h-full flex-col bg-white">
      <Header
        user={user}
        onLogout={onLogout}
        title="Dashboard"
        onShowSessionExpired={onShowSessionExpired}
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1480px] p-8">
          <div className="mb-8">
            <h1 className="m-0 text-3xl font-semibold text-gray-900">
              Dashboard
            </h1>
            <p className="mt-1.5 text-base text-muted">
              Overview of your API quality checks and recent activity.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <SummaryCard label="Projects" value={loading ? null : projects.length} />
            <SummaryCard label="Test Runs" value={overviewLoading ? null : totals?.runs ?? 0} />
            <SummaryCard label="Snapshots" value={overviewLoading ? null : totals?.snapshots ?? 0} />
            <SummaryCard label="Comparisons" value={overviewLoading ? null : totals?.comparisons ?? 0} />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[65fr_35fr]">
            <div className="flex flex-col gap-8">
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  Needs Attention
                  {needsAttention.length > 0 && (
                    <span className="rounded-full bg-error-light px-2 py-0.5 text-xs font-semibold text-error">
                      {needsAttention.length}
                    </span>
                  )}
                </h2>

                {overviewLoading && (
                  <p className="text-sm text-muted">Checking recent activity...</p>
                )}

                {!overviewLoading && needsAttention.length === 0 && (
                  <p className="text-sm text-muted">No issues in recent activity.</p>
                )}

                {!overviewLoading && needsAttention.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {needsAttention.map((item) => (
                      <ActivityRow
                        key={item.key}
                        item={item}
                        onOpen={() => navigate(getActivityHref(item))}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Recent Activity
                </h2>

                {overviewLoading && (
                  <p className="text-sm text-muted">Loading recent activity...</p>
                )}

                {!overviewLoading && recentActivity.length === 0 && (
                  <p className="text-sm text-muted">No recent activity yet.</p>
                )}

                {!overviewLoading && recentActivity.length > 0 && (
                  <>
                    <div className="flex flex-col gap-3">
                      {visibleActivity.map((item) => (
                        <ActivityRow
                          key={item.key}
                          item={item}
                          onOpen={() => navigate(getActivityHref(item))}
                        />
                      ))}
                    </div>

                    {recentActivity.length > RECENT_ACTIVITY_DISPLAY_LIMIT && (
                      <div className="mt-3 flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllActivity((prev) => !prev)}
                        >
                          {showAllActivity ? "Show less" : "View all"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="m-0 text-lg font-semibold text-gray-900">
                  Your Projects
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/projects")}
                >
                  View all → Projects
                </Button>
              </div>

              {loading && <p className="text-sm text-muted">Loading projects...</p>}
              {error && <p className="text-sm text-error">{error}</p>}

              {!loading && !error && projects.length === 0 && (
                <Card padding="lg" className="text-center">
                  <p className="text-sm text-gray-900">
                    You do not have any projects yet.
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {isAdmin
                      ? "Create a project to get started."
                      : "Ask an admin to add you to a project."}
                  </p>
                  {isAdmin && (
                    <Button
                      variant="primary"
                      className="mt-3"
                      onClick={() => navigate("/projects")}
                    >
                      + Create Project
                    </Button>
                  )}
                </Card>
              )}

              {!loading && !error && displayedProjects.length > 0 && (
                <div className="flex flex-col gap-4">
                  {displayedProjects.map((p) => (
                    <ProjectOverviewCard
                      key={p.projectId}
                      project={p}
                      stats={projectStats.get(p.projectId) ?? null}
                      statsLoading={overviewLoading}
                      onOpen={() => navigate(`/projects/${p.projectId}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
