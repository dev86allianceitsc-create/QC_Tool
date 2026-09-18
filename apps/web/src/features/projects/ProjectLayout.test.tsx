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

function stubFetch(response: Response = mockJsonResponse(200, PROJECT)) {
  const fetchMock = vi.fn().mockResolvedValue(response);
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
    expect(screen.getByText("Environments")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });

  it("navigates to a nested route when a tab is clicked, keeping the tabs visible", async () => {
    stubFetch();
    renderAt("/projects/p1");
    await screen.findAllByText("Project A");

    fireEvent.click(screen.getByText("APIs"));

    expect(await screen.findByText("APIs content")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
  });

  it("renders the correct section and highlights the correct tab on a direct URL", async () => {
    stubFetch();
    renderAt("/projects/p1/environments");
    await screen.findAllByText("Project A");

    expect(await screen.findByText("Environments content")).toBeInTheDocument();
    const environmentsTab = screen.getByText("Environments");
    expect(environmentsTab.style.fontWeight).toBe("bold");
  });
});
