import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectDetailScreen } from "./ProjectDetailScreen";
import type { Project } from "./projects.types";

const PROJECT: Project = { id: "p1", name: "Project A", description: "First project.", status: "ACTIVE", deletedAt: null };

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const USER = { email: "user@example.com", role: "USER" as const };

function renderScreen(user: typeof ADMIN | typeof USER) {
  return render(
    <ProjectDetailScreen
      user={user}
      project={PROJECT}
      onBack={vi.fn()}
      onLogout={vi.fn()}
      onMembersClick={vi.fn()}
      onEditProject={vi.fn()}
      onToggleStatus={vi.fn()}
      onDeleteProject={vi.fn()}
    />,
  );
}

describe("ProjectDetailScreen", () => {
  it("shows Edit/Deactivate/Delete actions for ADMIN", () => {
    renderScreen(ADMIN);
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Deactivate")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("hides management actions for USER", () => {
    renderScreen(USER);
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Deactivate")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("displays project name, description and status", () => {
    renderScreen(USER);
    expect(screen.getAllByText("Project A").length).toBeGreaterThan(0);
    expect(screen.getByText("First project.")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });
});
