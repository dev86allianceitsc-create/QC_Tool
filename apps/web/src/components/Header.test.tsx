import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const ADMIN = { email: "admin@example.com", role: "ADMIN" };
const USER = { email: "user@example.com", role: "USER" };

// UI-SEC-07: nav item visibility is entirely caller-driven (Header just
// renders when a handler is passed) — App.tsx/ProjectListScreen decide
// whether to pass onNavigateAuditLogs based on the signed-in user's role.
describe("Header — Audit Logs nav item", () => {
  it("shows the Audit Logs button when onNavigateAuditLogs is supplied (ADMIN)", () => {
    render(<Header user={ADMIN} onLogout={vi.fn()} title="Projects" onNavigateAuditLogs={vi.fn()} />);
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
  });

  it("hides the Audit Logs button when onNavigateAuditLogs is omitted (USER)", () => {
    render(<Header user={USER} onLogout={vi.fn()} title="Projects" />);
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
  });
});
