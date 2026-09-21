import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { DashboardScreen } from "./DashboardScreen";

const PROJECTS_PAGE = {
  items: [
    { projectId: "p1", projectName: "Project A", description: "First project.", projectStatus: "ACTIVE" },
    { projectId: "p2", projectName: "Project B", description: null, projectStatus: "INACTIVE" },
  ],
  page: 1,
  pageSize: 100,
  totalItems: 2,
  totalPages: 1,
};

const EMPTY_PAGE = { items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 };

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const USER = { email: "user@example.com", role: "USER" as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen(user: typeof ADMIN | typeof USER) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <DashboardScreen user={user} accessToken="token-1" onLogout={vi.fn()} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("DashboardScreen", () => {
  it("shows the real project count and Your Projects list from the backend", async () => {
    stubFetch(mockJsonResponse(200, PROJECTS_PAGE));
    renderScreen(ADMIN);
    await screen.findByText("Project A");
    expect(screen.getByText("Project B")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the Audit Logs quick-access link for ADMIN", async () => {
    stubFetch(mockJsonResponse(200, PROJECTS_PAGE));
    renderScreen(ADMIN);
    await screen.findByText("Project A");
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
  });

  it("hides the Audit Logs quick-access link for USER", async () => {
    stubFetch(mockJsonResponse(200, PROJECTS_PAGE));
    renderScreen(USER);
    await screen.findByText("Project A");
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
  });

  it("shows a permission-gated empty state with no fake stats for ADMIN", async () => {
    stubFetch(mockJsonResponse(200, EMPTY_PAGE));
    renderScreen(ADMIN);
    await screen.findByText("You do not have any projects yet.");
    expect(screen.getByText("+ Create Project")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("hides the Create Project CTA in the empty state for USER", async () => {
    stubFetch(mockJsonResponse(200, EMPTY_PAGE));
    renderScreen(USER);
    await screen.findByText("You do not have any projects yet.");
    expect(screen.queryByText("+ Create Project")).not.toBeInTheDocument();
  });
});
