import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { ProjectDetailScreen } from "./ProjectDetailScreen";

const PROJECT = { projectId: "p1", projectName: "Project A", description: "First project.", projectStatus: "ACTIVE", createdAt: "t", updatedAt: "t" };

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const USER = { email: "user@example.com", role: "USER" as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response = mockJsonResponse(200, PROJECT)) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen(user: typeof ADMIN | typeof USER) {
  return render(
    <ProjectDetailScreen
      user={user}
      projectId="p1"
      accessToken="token-1"
      onBack={vi.fn()}
      onLogout={vi.fn()}
      onMembersClick={vi.fn()}
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
    />,
  );
}

describe("ProjectDetailScreen", () => {
  it("shows Edit/Activate-Deactivate/Delete actions for ADMIN", async () => {
    stubFetch();
    renderScreen(ADMIN);
    await screen.findAllByText("Project A");
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Deactivate")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("hides management actions for USER", async () => {
    stubFetch();
    renderScreen(USER);
    await screen.findAllByText("Project A");
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Deactivate")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("displays project name, description and status", async () => {
    stubFetch();
    renderScreen(USER);
    await screen.findAllByText("Project A");
    expect(screen.getByText("First project.")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("saves an edit via PATCH then refetches", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findAllByText("Project A");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...PROJECT, projectName: "Renamed" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...PROJECT, projectName: "Renamed" }));

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByText("Project Name *").nextElementSibling!, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByText("Save"));

    await screen.findAllByText("Renamed");
    const [, patchInit] = fetchMock.mock.calls[1];
    expect(patchInit.method).toBe("PATCH");
  });

  it("deactivates via the status confirm dialog", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findAllByText("Project A");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...PROJECT, projectStatus: "INACTIVE" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...PROJECT, projectStatus: "INACTIVE" }));

    fireEvent.click(screen.getByText("Deactivate"));
    const deactivateButtons = screen.getAllByText("Deactivate", { selector: "button" });
    fireEvent.click(deactivateButtons[deactivateButtons.length - 1]);

    const patchCall = await new Promise<[string, RequestInit]>((resolve) => {
      const check = () => {
        const call = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PATCH");
        if (call) resolve(call as [string, RequestInit]);
        else setTimeout(check, 10);
      };
      check();
    });
    expect(patchCall[1].body).toBe(JSON.stringify({ projectStatus: "INACTIVE" }));
  });

  it("deletes the project then calls onBack", async () => {
    const fetchMock = stubFetch();
    const onBack = vi.fn();
    render(
      <ProjectDetailScreen user={ADMIN} projectId="p1" accessToken="token-1" onBack={onBack} onLogout={vi.fn()} onMembersClick={vi.fn()} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />,
    );
    await screen.findAllByText("Project A");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));

    fireEvent.click(screen.getByText("Delete"));
    const deleteButtons = screen.getAllByText("Delete", { selector: "button" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onMembersClick with the project name when the Members tab is clicked", async () => {
    stubFetch();
    const onMembersClick = vi.fn();
    render(
      <ProjectDetailScreen user={ADMIN} projectId="p1" accessToken="token-1" onBack={vi.fn()} onLogout={vi.fn()} onMembersClick={onMembersClick} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />,
    );
    await screen.findAllByText("Project A");

    fireEvent.click(screen.getByText("Members"));
    expect(onMembersClick).toHaveBeenCalledWith("Project A");
  });
});
