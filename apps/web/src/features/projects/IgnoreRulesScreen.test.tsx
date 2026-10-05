import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { IgnoreRulesScreen } from "./IgnoreRulesScreen"

const API_RULE = {
  ignoreRuleId: "r1",
  projectId: "p1",
  apiId: "a1",
  apiName: "Get Order",
  apiMethod: "GET",
  apiPath: "/orders/:id",
  scope: "API",
  path: "$.StartTime",
  enabled: true,
  note: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const PROJECT_RULE = {
  ignoreRuleId: "r2",
  projectId: "p1",
  apiId: null,
  apiName: null,
  apiMethod: null,
  apiPath: null,
  scope: "PROJECT",
  path: "$.Data.timestamp",
  enabled: false,
  note: "noisy field",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
}

const APIS_PAGE = {
  items: [
    { apiId: "a1", apiName: "Get Order", httpMethod: "GET", path: "/orders/:id" },
  ],
  page: 1,
  pageSize: 100,
  totalItems: 1,
  totalPages: 1,
}

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const }
const USER = { email: "user@example.com", role: "USER" as const }

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(rules: unknown[] = [API_RULE, PROJECT_RULE]) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const s = String(url)
    if (s.includes("/ignore-rules")) {
      return Promise.resolve(mockJsonResponse(200, rules))
    }
    if (s.includes("/apis")) {
      return Promise.resolve(mockJsonResponse(200, APIS_PAGE))
    }
    return Promise.resolve(mockJsonResponse(404, {}))
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderScreen(user: typeof ADMIN | typeof USER) {
  return render(
    <IgnoreRulesScreen
      user={user}
      projectId="p1"
      accessToken="token-1"
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
    />,
  )
}

describe("IgnoreRulesScreen", () => {
  it("lists Path/Scope/API/Enabled for each rule", async () => {
    stubFetch()

    renderScreen(ADMIN)

    const apiRow = (await screen.findByText("$.StartTime")).closest("tr")
    expect(apiRow).not.toBeNull()
    expect(
      within(apiRow as HTMLElement).getByText("GET /orders/:id"),
    ).toBeInTheDocument()
    expect(within(apiRow as HTMLElement).getByText("API")).toBeInTheDocument()

    const projectRow = screen.getByText("$.Data.timestamp").closest("tr")
    expect(projectRow).not.toBeNull()
    expect(
      within(projectRow as HTMLElement).getByText("All APIs"),
    ).toBeInTheDocument()
    expect(
      within(projectRow as HTMLElement).getByText("Project"),
    ).toBeInTheDocument()
  })

  it("shows + Add Ignore Rule and Delete for ADMIN only", async () => {
    stubFetch()

    renderScreen(ADMIN)

    await screen.findByText("$.StartTime")

    expect(screen.getByText("+ Add Ignore Rule")).toBeInTheDocument()
    expect(screen.getAllByText("Delete").length).toBe(2)
  })

  it("hides + Add Ignore Rule and Delete for non-ADMIN, and disables the toggle", async () => {
    stubFetch()

    renderScreen(USER)

    await screen.findByText("$.StartTime")

    expect(screen.queryByText("+ Add Ignore Rule")).not.toBeInTheDocument()
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
  })

  it("creates an API-scoped rule via POST then refetches", async () => {
    const fetchMock = stubFetch([])

    renderScreen(ADMIN)

    await waitFor(() => expect(screen.queryByText("Loading Ignore Rules...")).not.toBeInTheDocument())

    fireEvent.click(screen.getByText("+ Add Ignore Rule"))

    await waitFor(() =>
      expect(screen.getByLabelText("API")).not.toHaveValue(""),
    )

    fireEvent.change(screen.getByLabelText("API"), {
      target: { value: "a1" },
    })

    fireEvent.change(screen.getByPlaceholderText("$.Data.Status"), {
      target: { value: "$.Data.Status" },
    })

    fetchMock.mockResolvedValueOnce(mockJsonResponse(201, API_RULE))
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, [API_RULE]))

    fireEvent.click(screen.getByText("Add Rule"))

    expect(await screen.findByText("$.StartTime")).toBeInTheDocument()

    const createCall = fetchMock.mock.calls.find(
      (c) => String(c[1]?.method) === "POST",
    )
    expect(createCall).toBeDefined()
    expect(String(createCall?.[0])).toContain("/projects/p1/ignore-rules")
  })

  it("rejects a path that does not start with $", async () => {
    stubFetch([])

    renderScreen(ADMIN)

    await waitFor(() => expect(screen.queryByText("Loading Ignore Rules...")).not.toBeInTheDocument())

    fireEvent.click(screen.getByText("+ Add Ignore Rule"))

    fireEvent.change(screen.getByPlaceholderText("$.Data.Status"), {
      target: { value: "StartTime" },
    })

    fireEvent.click(screen.getByText("Add Rule"))

    expect(await screen.findByText("Path must start with $.")).toBeInTheDocument()
  })

  it("toggles enabled via PATCH then refetches", async () => {
    const fetchMock = stubFetch([API_RULE])

    renderScreen(ADMIN)

    await screen.findByText("$.StartTime")

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(200, { ...API_RULE, enabled: false }),
    )
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(200, [{ ...API_RULE, enabled: false }]),
    )

    fireEvent.click(screen.getByRole("switch"))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        (c) => String(c[1]?.method) === "PATCH",
      )
      expect(patchCall).toBeDefined()
    })
  })

  it("deletes a rule via Confirm then refetches", async () => {
    const fetchMock = stubFetch([API_RULE])

    renderScreen(ADMIN)

    await screen.findByText("$.StartTime")

    fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined))
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, []))

    fireEvent.click(screen.getByText("Delete"))

    expect(
      await screen.findByText(/This will stop ignoring "\$\.StartTime"/),
    ).toBeInTheDocument()

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() =>
      expect(screen.queryByText("$.StartTime")).not.toBeInTheDocument(),
    )
  })
})
