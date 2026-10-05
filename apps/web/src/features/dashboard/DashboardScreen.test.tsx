import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { MemoryRouter } from "react-router-dom"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { DashboardScreen } from "./DashboardScreen"

const PROJECTS_PAGE = {
  items: [
    {
      projectId: "p1",
      projectName: "Project A",
      description: "First project.",
      projectStatus: "ACTIVE",
    },

    {
      projectId: "p2",
      projectName: "Project B",
      description: null,
      projectStatus: "INACTIVE",
    },
  ],

  page: 1,

  pageSize: 100,

  totalItems: 2,

  totalPages: 1,
}

const EMPTY_PAGE = {
  items: [],
  page: 1,
  pageSize: 100,
  totalItems: 0,
  totalPages: 1,
}

function runsPageFor(projectId: string) {
  return {
    items: [
      {
        runId: `run-${projectId}`,
        runType: "MANUAL",
        runStatus: "COMPLETED",
        apiId: "api-1",
        environmentId: "env-1",
        createdBy: "user-1",
        createdAt: "2026-01-05T10:00:00.000Z",
        startedAt: "2026-01-05T10:00:00.000Z",
      },
    ],
    page: 1,
    pageSize: 5,
    totalItems: 1,
    totalPages: 1,
  }
}

function comparisonsPageFor(projectId: string) {
  return {
    items: [
      {
        comparisonId: `cmp-${projectId}`,
        projectId,
        apiId: "api-1",
        environmentId: "env-1",
        baselineSnapshotId: "snap-1",
        targetSnapshotId: "snap-2",
        sourceKind: "AUTO_EXECUTION",
        sourceExecutionId: null,
        comparisonChainId: null,
        pairOrdinal: null,
        processingStatus: "COMPLETED",
        stoppedAtGate: null,
        reasonCode: null,
        reasonDetailSafe: null,
        inputCheckOutcome: "COMPATIBLE",
        result: "DIFFERENT",
        outputDifferenceCount: 2,
        classification: null,
        classificationRevision: null,
        classifiedBy: null,
        createdAt: "2026-01-05T11:00:00.000Z",
      },
    ],
    page: 1,
    pageSize: 5,
    totalItems: 1,
    hasMore: false,
  }
}

const SNAPSHOTS_PAGE = {
  items: [
    {
      snapshotId: "snap-2",
      apiId: "api-1",
      environmentId: "env-1",
      createdAt: "2026-01-05T09:00:00.000Z",
    },
  ],
  page: 1,
  pageSize: 1,
  totalItems: 3,
  totalPages: 3,
}

const APIS_PAGE = {
  items: [],
  page: 1,
  pageSize: 1,
  totalItems: 4,
  totalPages: 4,
}

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const }

const USER = { email: "user@example.com", role: "USER" as const }

afterEach(() => {
  vi.unstubAllGlobals()
})

function projectIdFromUrl(url: string): string {
  const match = url.match(/\/projects\/([^/]+)\//)
  return match ? match[1] : "unknown"
}

function routeResponse(url: string): unknown {
  const projectId = projectIdFromUrl(url)
  if (url.includes("/runs")) return runsPageFor(projectId)
  if (url.includes("/comparisons")) return comparisonsPageFor(projectId)
  if (url.includes("/snapshots")) return SNAPSHOTS_PAGE
  if (url.includes("/apis")) return APIS_PAGE
  return PROJECTS_PAGE
}

function stubFetch(projectsPage: unknown = PROJECTS_PAGE) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    const isBareProjectsList = /\/projects(\?|$)/.test(url)
    const body = isBareProjectsList ? projectsPage : routeResponse(url)
    return Promise.resolve(mockJsonResponse(200, body))
  })

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function renderScreen(user: typeof ADMIN | typeof USER) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <DashboardScreen
        user={user}
        accessToken="token-1"
        onLogout={vi.fn()}
        onSessionExpired={vi.fn()}
        onAccessDenied={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe("DashboardScreen", () => {
  it("shows the real project count and Your Projects list from the backend", async () => {
    stubFetch()

    renderScreen(ADMIN)

    await screen.findByText("Project A")

    expect(screen.getByText("Project B")).toBeInTheDocument()
  })

  it("shows real system-wide totals aggregated from the per-project fan-out", async () => {
    stubFetch()

    renderScreen(ADMIN)

    await screen.findByText("Project A")

    await screen.findByText("Recent Activity")

    // Two projects, each contributing totalItems:3 for Snapshots -> 6, a total
    // distinct from the Projects/Runs/Comparisons cards (which are all "2").
    expect(await screen.findByText("6")).toBeInTheDocument()
  })

  it("renders Recent Activity rows with real status badges, not a crash", async () => {
    stubFetch()

    renderScreen(ADMIN)

    await screen.findByText("Project A")

    expect(await screen.findAllByText("DIFFERENT")).not.toHaveLength(0)
    expect(await screen.findAllByText("COMPLETED")).not.toHaveLength(0)
  })

  it("shows a permission-gated empty state with no fake stats for ADMIN", async () => {
    stubFetch(EMPTY_PAGE)

    renderScreen(ADMIN)

    await screen.findByText("You do not have any projects yet.")

    expect(screen.getByText("+ Create Project")).toBeInTheDocument()

    expect(screen.getByText("No recent activity yet.")).toBeInTheDocument()
  })

  it("hides the Create Project CTA in the empty state for USER", async () => {
    stubFetch(EMPTY_PAGE)

    renderScreen(USER)

    await screen.findByText("You do not have any projects yet.")

    expect(screen.queryByText("+ Create Project")).not.toBeInTheDocument()
  })

  it("surfaces DIFFERENT comparisons in a Needs Attention section with a real count", async () => {
    stubFetch()

    renderScreen(ADMIN)

    const heading = await screen.findByText("Needs Attention")

    // Both stubbed projects contribute one DIFFERENT comparison each, so the
    // section's count badge should reflect that real number, not a guess.
    // (Scoped to the heading itself since "2" also appears as the Projects
    // summary card value elsewhere on the page.)
    await waitFor(() => {
      expect(heading.closest("h2")?.textContent).toContain("2")
    })

    expect(screen.queryByText("No issues in recent activity.")).not.toBeInTheDocument()
  })

  it("expands Recent Activity beyond the default limit via View all", async () => {
    const manyProjects = {
      items: Array.from({ length: 8 }, (_, i) => ({
        projectId: `p${i}`,
        projectName: `Project ${i}`,
        description: null,
        projectStatus: "ACTIVE" as const,
      })),
      page: 1,
      pageSize: 100,
      totalItems: 8,
      totalPages: 1,
    }

    stubFetch(manyProjects)

    renderScreen(ADMIN)

    await screen.findByText("Project 0")

    // 8 projects x 1 run each = 8 "Single Test Run" rows in the full pool,
    // but runs are COMPLETED (never Needs Attention) and sort behind the
    // DIFFERENT comparisons, so none should be visible before expanding.
    await screen.findByText("Recent Activity")
    expect(screen.queryByText("Single Test Run")).not.toBeInTheDocument()

    const viewAllButton = await screen.findByRole("button", { name: "View all" })
    fireEvent.click(viewAllButton)

    expect(await screen.findAllByText("Single Test Run")).toHaveLength(8)
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument()
  })
})
