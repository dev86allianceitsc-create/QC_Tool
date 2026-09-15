import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MembersScreen } from "./MembersScreen";
import type { Member } from "./projects.types";

const MEMBERS: Member[] = [
  { id: "m1", email: "active@example.com", role: "USER", status: "ACTIVE", addedAt: "2025-08-10" },
  { id: "m2", email: "invited@example.com", role: "USER", status: "INVITED", addedAt: "2025-09-01" },
];

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const USER = { email: "user@example.com", role: "USER" as const };

function renderScreen(user: typeof ADMIN | typeof USER, members = MEMBERS) {
  return render(
    <MembersScreen
      user={user}
      projectName="Project A"
      members={members}
      onBack={vi.fn()}
      onLogout={vi.fn()}
      onAddMember={vi.fn()}
      onEditMember={vi.fn()}
      onCancelMember={vi.fn()}
      onRemoveMember={vi.fn()}
    />,
  );
}

describe("MembersScreen", () => {
  it("shows Add Member and row actions for ADMIN", () => {
    renderScreen(ADMIN);
    expect(screen.getByText("+ Add Member")).toBeInTheDocument();
    expect(screen.getByText("Remove from Project")).toBeInTheDocument();
    expect(screen.getByText("Edit Invitation")).toBeInTheDocument();
    expect(screen.getByText("Cancel Invitation")).toBeInTheDocument();
  });

  it("hides Add Member and row actions for USER", () => {
    renderScreen(USER);
    expect(screen.queryByText("+ Add Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Remove from Project")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit Invitation")).not.toBeInTheDocument();
  });

  it("names the project and member in the Remove from Project confirmation", () => {
    renderScreen(ADMIN);
    fireEvent.click(screen.getByText("Remove from Project"));
    expect(
      screen.getByText((_, node) => node?.textContent === 'Remove active@example.com from "Project A"? This only removes their access to this Project — it does not delete their account, change their System Role, or remove them from other Projects.'),
    ).toBeInTheDocument();
  });

  it("calls onRemoveMember when the removal is confirmed", () => {
    const onRemoveMember = vi.fn();
    render(
      <MembersScreen
        user={ADMIN}
        projectName="Project A"
        members={MEMBERS}
        onBack={vi.fn()}
        onLogout={vi.fn()}
        onAddMember={vi.fn()}
        onEditMember={vi.fn()}
        onCancelMember={vi.fn()}
        onRemoveMember={onRemoveMember}
      />,
    );
    fireEvent.click(screen.getByText("Remove from Project"));
    fireEvent.click(screen.getByText("Remove"));
    expect(onRemoveMember).toHaveBeenCalledWith("m1");
  });
});
