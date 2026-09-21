import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { ProjectLayout } from "./ProjectLayout";

const PROJECT = { projectId: "p1", projectName: "Project A", description: "First project.", projectStatus: "ACTIVE", createdAt: "t", updatedAt: "t" };

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(project: typeof PROJECT = PROJECT) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes(`/projects/${project.projectId}`)) {
      return Promise.resolve(mockJsonResponse(200, project));
    }
    return Promise.resolve(mockJsonResponse(200, { items: [project], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/projects/:projectId"
          element={
            <ProjectLayout
              user={ADMIN}
              accessToken="token-1"
              onLogout={vi.fn()}
              onSessionExpired={vi.fn()}
              onAccessDenied={vi.fn()}
            />
          }
        >
          <Route index element={<div>Overview content</div>} />
          <Route path="apis" element={<div>APIs content</div>} />
          <Route path="environments" element={<div>Environments content</div>} />
          <Route path="members" element={<div>Members content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectLayout", () => {
  it("renders the persistent tabs and the active section content", async () => {
    stubFetch();
    renderAt("/projects/p1");
    await screen.findAllByText("Project A");

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("APIs")).toBeInTheDocument();
    expect(screen.getByText("Project Settings ▾")).toBeInTheDocument();
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });

  it("navigates to a nested route when a tab is clicked, keeping the tabs visible", async () => {
    stubFetch();
    renderAt("/projects/p1");
    await screen.findAllByText("Project A");

    fireEvent.click(screen.getByText("APIs"));

    expect(await screen.findByText("APIs content")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Project Settings ▾")).toBeInTheDocument();
  });

  it("navigates to a Project Settings sub-item (Members) via the flyout menu", async () => {
    stubFetch();
    renderAt("/projects/p1");
    await screen.findAllByText("Project A");

    fireEvent.click(screen.getByText("Project Settings ▾"));
    fireEvent.click(screen.getByText("Members"));

    expect(await screen.findByText("Members content")).toBeInTheDocument();
  });

  it("renders the correct section and highlights Project Settings on a direct URL", async () => {
    stubFetch();
    renderAt("/projects/p1/environments");
    await screen.findAllByText("Project A");

    expect(await screen.findByText("Environments content")).toBeInTheDocument();
    const settingsTab = screen.getByText("Project Settings ▾");
    expect(settingsTab.style.fontWeight).toBe("bold");
  });
});
