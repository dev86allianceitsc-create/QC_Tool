import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunRequestPanel } from "./RunRequestPanel";
import type { RequestInputDefinition } from "./requestInput.types";
import type { EnvironmentListItem } from "./apiEnvironment.types";

const ENVIRONMENTS: EnvironmentListItem[] = [
  { environmentId: "e1", environmentName: "Dev", classification: "NON_PRODUCTION", allowRun: true, environmentStatus: "ACTIVE", createdAt: "t", updatedAt: "t" },
];

function definitionWith(overrides: Partial<RequestInputDefinition>): RequestInputDefinition {
  return {
    apiId: "a1",
    httpMethod: "GET",
    path: "/widgets/{id}",
    pathParameters: [],
    queryParameters: [],
    headerParameters: [],
    requestBody: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RunRequestPanel", () => {
  it("renders as an open dialog and closes via the Close button", () => {
    const onClose = vi.fn();
    render(
      <RunRequestPanel
        definition={definitionWith({})}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Run Preparation" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <RunRequestPanel
        definition={definitionWith({})}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders manual value fields for configured Path, Query, and Header parameters", () => {
    render(
      <RunRequestPanel
        definition={definitionWith({
          pathParameters: [{ name: "id", required: true, source: "AUTO_DETECTED" }],
          queryParameters: [{ name: "status", required: false }],
          headerParameters: [{ name: "X-Client-ID", required: true }],
        })}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/^id/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^status/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^X-Client-ID/)).toBeInTheDocument();
  });

  it("shows a 'no configurable inputs' empty state when the Definition has nothing to enter", () => {
    render(
      <RunRequestPanel
        definition={definitionWith({})}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("No manual request values required.")).toBeInTheDocument();
  });

  it("accepts a valid JSON object payload", () => {
    render(
      <RunRequestPanel
        definition={definitionWith({ requestBody: { bodyType: "JSON" } })}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: '{"a":1}' } });
    expect(screen.getByText("Valid JSON")).toBeInTheDocument();
  });

  it("accepts a valid non-object JSON root (array/number/string/boolean/null)", () => {
    render(
      <RunRequestPanel
        definition={definitionWith({ requestBody: { bodyType: "JSON" } })}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const textarea = screen.getByLabelText("JSON Payload");
    for (const root of ['[1,2,3]', "42", '"hello"', "true", "null"]) {
      fireEvent.change(textarea, { target: { value: root } });
      expect(screen.getByText("Valid JSON")).toBeInTheDocument();
    }
  });

  it("shows feedback for malformed JSON", () => {
    render(
      <RunRequestPanel
        definition={definitionWith({ requestBody: { bodyType: "JSON" } })}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: "{not valid" } });
    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it("never calls fetch during any interaction — no Run request is executed", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RunRequestPanel
        definition={definitionWith({
          queryParameters: [{ name: "status", required: false }],
          requestBody: { bodyType: "JSON" },
        })}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^status/), { target: { value: "active" } });
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: "{}" } });
    fireEvent.click(screen.getByText("Run"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the Run button disabled", () => {
    render(
      <RunRequestPanel
        definition={definitionWith({})}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Run")).toBeDisabled();
  });
});

describe("RunRequestPanel — inline variant", () => {
  it("renders embedded content with no dialog role, no backdrop, and no Close button", () => {
    render(
      <RunRequestPanel
        variant="inline"
        definition={definitionWith({ queryParameters: [{ name: "status", required: false }] })}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
    expect(screen.getByText("Run Preparation")).toBeInTheDocument();
    expect(screen.getByLabelText(/^status/)).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeDisabled();
  });

  it("shows the target Environment as read-only context, not a 3rd Environment selector (Execution Target and the API header already own selection)", () => {
    render(
      <RunRequestPanel
        variant="inline"
        definition={definitionWith({})}
        environments={ENVIRONMENTS}
        selectedEnvironmentId="e1"
        onSelectEnvironment={vi.fn()}
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Preparing values for")).toBeInTheDocument();
    expect(screen.getByText("Dev")).toBeInTheDocument();
  });
});
