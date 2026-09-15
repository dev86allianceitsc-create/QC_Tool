import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectListScreen } from "./ProjectListScreen";
import type { Project } from "./projects.types";

const PROJECTS: Project[] = [
  { id: "p1", name: "Project A", description: "First project.", status: "ACTIVE", deletedAt: null },
  { id: "p2", name: "Project B", description: "Deleted project.", status: "ACTIVE", deletedAt: "2026-01-01T00:00:00.000Z" },
];

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const USER = { email: "user@example.com", role: "USER" as const };

describe("ProjectListScreen", () => {
  it("shows the Create Project button for ADMIN", () => {
    render(
      <ProjectListScreen user={ADMIN} projects={PROJECTS} onSelectProject={vi.fn()} onCreateProject={vi.fn()} onLogout={vi.fn()} />,
    );
    expect(screen.getByText("+ Create Project")).toBeInTheDocument();
  });

  it("hides the Create Project button for USER", () => {
    render(
      <ProjectListScreen user={USER} projects={PROJECTS} onSelectProject={vi.fn()} onCreateProject={vi.fn()} onLogout={vi.fn()} />,
    );
    expect(screen.queryByText("+ Create Project")).not.toBeInTheDocument();
  });

  it("excludes soft-deleted projects from the list", () => {
    render(
      <ProjectListScreen user={ADMIN} projects={PROJECTS} onSelectProject={vi.fn()} onCreateProject={vi.fn()} onLogout={vi.fn()} />,
    );
    expect(screen.getByText("Project A")).toBeInTheDocument();
    expect(screen.queryByText("Project B")).not.toBeInTheDocument();
  });

  it("requires a name before creating a project", () => {
    const onCreateProject = vi.fn();
    render(
      <ProjectListScreen user={ADMIN} projects={PROJECTS} onSelectProject={vi.fn()} onCreateProject={onCreateProject} onLogout={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("+ Create Project"));
    fireEvent.click(screen.getByText("Create"));
    expect(screen.getByText("Project Name is required")).toBeInTheDocument();
    expect(onCreateProject).not.toHaveBeenCalled();
  });
});
