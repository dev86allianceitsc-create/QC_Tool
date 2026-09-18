import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestInputTab } from "./RequestInputTab";
import { derivePathParameters } from "./requestInput.util";
import type { RequestInputDefinition } from "./requestInput.types";

function baseDefinition(path: string): RequestInputDefinition {
  return {
    apiId: "a1",
    httpMethod: "GET",
    path,
    pathParameters: derivePathParameters(path),
    queryParameters: [],
    headerParameters: [],
    requestBody: null,
  };
}

describe("RequestInputTab — Path Parameters", () => {
  it("renders a single Path parameter, read-only, derived from the API path", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets/{id}")} onSave={vi.fn()} />);
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getAllByText("Auto-detected").length).toBe(1);
  });

  it("renders multiple Path parameters", () => {
    render(<RequestInputTab definition={baseDefinition("/orgs/{orgId}/widgets/{id}")} onSave={vi.fn()} />);
    expect(screen.getByText("orgId")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
  });

  it("shows the empty state when the API path has no placeholders", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={vi.fn()} />);
    expect(screen.getByText("No path parameters detected.")).toBeInTheDocument();
  });
});

describe("RequestInputTab — Query Parameters", () => {
  it("adds, edits, and removes a Query parameter", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={vi.fn()} />);

    fireEvent.click(screen.getByText("+ Add Query"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "status" } });
    fireEvent.click(screen.getByText("Add Parameter"));
    expect(screen.getByText("status")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "state" } });
    fireEvent.click(screen.getByText("Save Changes"));
    expect(screen.getByText("state")).toBeInTheDocument();
    expect(screen.queryByText("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Remove"));
    const confirmCard = screen.getByText("Remove Query Parameter").parentElement!;
    fireEvent.click(within(confirmCard).getByText("Remove"));
    expect(screen.queryByText("state")).not.toBeInTheDocument();
  });
});

describe("RequestInputTab — Header Parameters", () => {
  it("adds, edits, and removes a Header parameter", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={vi.fn()} />);

    fireEvent.click(screen.getByText("+ Add Header"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "X-Client-ID" } });
    fireEvent.click(screen.getByText("Add Parameter"));
    expect(screen.getByText("X-Client-ID")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "X-Trace-ID" } });
    fireEvent.click(screen.getByText("Save Changes"));
    expect(screen.getByText("X-Trace-ID")).toBeInTheDocument();
  });

  it("rejects Authorization and Content-Type as normal Header parameters", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={vi.fn()} />);

    fireEvent.click(screen.getByText("+ Add Header"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Authorization" } });
    fireEvent.click(screen.getByText("Add Parameter"));
    expect(screen.getByText(/is reserved/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Content-Type" } });
    fireEvent.click(screen.getByText("Add Parameter"));
    expect(screen.getByText(/is reserved/)).toBeInTheDocument();
  });
});

describe("RequestInputTab — Request Body", () => {
  it("exposes JSON as the only Body Type when enabled", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Use request body"));
    expect(screen.getByDisplayValue("JSON")).toBeDisabled();
  });

  it("supports a no-body state", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={vi.fn()} />);
    expect(screen.queryByDisplayValue("JSON")).not.toBeInTheDocument();
  });
});

describe("RequestInputTab — Save/Cancel", () => {
  it("Save commits the pending Definition via onSave (PUT payload only) and re-baselines the draft on success", async () => {
    const saved = { ...baseDefinition("/widgets"), queryParameters: [{ name: "status", required: false }] };
    const onSave = vi.fn().mockResolvedValue(saved);
    const definition = baseDefinition("/widgets");
    const { rerender } = render(<RequestInputTab definition={definition} onSave={onSave} />);

    fireEvent.click(screen.getByText("+ Add Query"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "status" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith({
      queryParameters: [{ name: "status", required: false }],
      headerParameters: [],
      requestBody: null,
    });

    await screen.findByText("status");
    // Mirrors ApiDetailScreen: after a successful save, the parent re-renders
    // RequestInputTab with the hook's new canonical `definition` (the same
    // object save() resolved to), which is what lets the dirty check clear.
    rerender(<RequestInputTab definition={saved} onSave={onSave} />);
    expect(screen.getByText("Cancel changes")).toBeDisabled();
  });

  it("shows inline feedback and preserves the dirty draft when onSave rejects", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Conflict"));
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={onSave} />);

    fireEvent.click(screen.getByText("+ Add Query"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "status" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    fireEvent.click(screen.getByText("Save"));

    expect(await screen.findByText("Failed to save changes.")).toBeInTheDocument();
    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText("Save")).not.toBeDisabled();
  });

  it("does not render Save/Cancel actions when readOnly", () => {
    render(<RequestInputTab definition={baseDefinition("/widgets")} onSave={vi.fn()} readOnly />);
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel changes")).not.toBeInTheDocument();
  });
});
