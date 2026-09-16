import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { ProjectListScreen } from "./ProjectListScreen";

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

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const USER = { email: "user@example.com", role: "USER" as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response = mockJsonResponse(200, PROJECTS_PAGE)) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen(user: typeof ADMIN | typeof USER) {
  return render(
    <ProjectListScreen
      user={user}
      accessToken="token-1"
      onSelectProject={vi.fn()}
      onLogout={vi.fn()}
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
    />,
  );
}

describe("ProjectListScreen", () => {
  it("shows the Create Project button for ADMIN", async () => {
    stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("Project A");
    expect(screen.getByText("+ Create Project")).toBeInTheDocument();
  });

  it("hides the Create Project button for USER", async () => {
    stubFetch();
    renderScreen(USER);
    await screen.findByText("Project A");
    expect(screen.queryByText("+ Create Project")).not.toBeInTheDocument();
  });

  it("renders projects fetched from the backend (already scoped/filtered server-side)", async () => {
    stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("Project A");
    expect(screen.getByText("Project B")).toBeInTheDocument();
  });

  it("requires a name before creating a project", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("Project A");

    fireEvent.click(screen.getByText("+ Create Project"));
    fireEvent.click(screen.getByText("Create"));
    expect(screen.getByText("Project Name is required")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates a project then refetches the list", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("Project A");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(201, { projectId: "p3", projectName: "New Project", description: null, projectStatus: "ACTIVE", createdAt: "t", updatedAt: "t" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...PROJECTS_PAGE, items: [...PROJECTS_PAGE.items, { projectId: "p3", projectName: "New Project", description: null, projectStatus: "ACTIVE" }] }));

    fireEvent.click(screen.getByText("+ Create Project"));
    fireEvent.change(screen.getByText("Project Name *").nextElementSibling!, { target: { value: "New Project" } });
    fireEvent.click(screen.getByText("Create"));

    await screen.findByText("Project created successfully");
    const [, createInit] = fetchMock.mock.calls[1];
    expect(createInit.method).toBe("POST");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("shows an inline error when creation fails", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("Project A");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(409, { errorCode: "CONFLICT", message: "Name already in use", details: [], requestId: "r1" }));

    fireEvent.click(screen.getByText("+ Create Project"));
    fireEvent.change(screen.getByText("Project Name *").nextElementSibling!, { target: { value: "Dup" } });
    fireEvent.click(screen.getByText("Create"));

    expect(await screen.findByText("Name already in use")).toBeInTheDocument();
  });
});
