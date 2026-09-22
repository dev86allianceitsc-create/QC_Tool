import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunApiArea } from "./RunApiArea";
import type { ApiEnvironmentConfigListItem, EnvironmentListItem } from "./apiEnvironment.types";
import type { RequestInputDefinition } from "./requestInput.types";

const ENVIRONMENTS: EnvironmentListItem[] = [
  { environmentId: "e1", environmentName: "Dev", classification: "NON_PRODUCTION", allowRun: true, environmentStatus: "ACTIVE", createdAt: "t", updatedAt: "t" },
];

const CONFIG: ApiEnvironmentConfigListItem = {
  environmentId: "e1",
  environmentName: "Dev",
  classification: "NON_PRODUCTION",
  environmentStatus: "ACTIVE",
  allowRun: true,
  urlStatus: "CONFIGURED",
  fullUrl: "https://api.example.com/widgets/{id}",
  credentialStatus: "NOT_REQUIRED",
};

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

function renderArea(overrides: Partial<React.ComponentProps<typeof RunApiArea>> = {}) {
  return render(
    <RunApiArea
      httpMethod="GET"
      environments={ENVIRONMENTS}
      selectedEnvironmentId="e1"
      onSelectEnvironment={vi.fn()}
      config={CONFIG}
      configsLoading={false}
      executionTargetReadiness="configured"
      requestInputDefinition={definitionWith({})}
      authTypeLabel={null}
      credentialStatus="NOT_REQUIRED"
      runBlockers={[]}
      {...overrides}
    />,
  );
}

function goToStep(label: string) {
  const nav = screen.getByRole("navigation", { name: "Run API steps" });
  fireEvent.click(within(nav).getByRole("button", { name: label }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RunApiArea — navigation", () => {
  it("shows the guided steps in order: Execution Target, Request Values, Version Metadata, Request Preview, Execute", () => {
    renderArea();
    const nav = screen.getByRole("navigation", { name: "Run API steps" });
    const stepButtons = within(nav).getAllByRole("button");
    expect(stepButtons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Execution Target",
      "Request Values",
      "Version Metadata",
      "Request Preview",
      "Execute",
    ]);
  });

  it("opens on Execution Target by default", () => {
    renderArea();
    expect(screen.getByText("Configuration Readiness — Dev")).toBeInTheDocument();
  });
});

describe("RunApiArea — Execution Target", () => {
  it("shows the already-configured Full URL read-only, not an editable field (edited only from Configuration → Endpoint)", () => {
    renderArea();
    expect(screen.getByText(CONFIG.fullUrl!)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("https://example.com/api/...")).not.toBeInTheDocument();
    expect(screen.queryByText("Save URL")).not.toBeInTheDocument();
  });

  it("warns when no URL is configured, instead of showing an example URL that looks runnable", () => {
    renderArea({ config: { ...CONFIG, fullUrl: null, urlStatus: "NOT_CONFIGURED" } });
    expect(screen.getByText(/No URL configured/)).toBeInTheDocument();
  });

  it("lists the concrete reasons a Run cannot proceed yet", () => {
    renderArea({ runBlockers: ["The Full URL is not configured for this Environment."] });
    expect(screen.getByText("A Run cannot proceed yet:")).toBeInTheDocument();
    expect(screen.getByText("The Full URL is not configured for this Environment.")).toBeInTheDocument();
  });
});

describe("RunApiArea — Request Values", () => {
  it("renders manual value fields for configured Path, Query, and Header parameters", () => {
    renderArea({
      requestInputDefinition: definitionWith({
        pathParameters: [{ name: "id", required: true, source: "AUTO_DETECTED" }],
        queryParameters: [{ name: "status", required: false }],
        headerParameters: [{ name: "X-Client-ID", required: true }],
      }),
    });
    goToStep("Request Values");
    expect(screen.getByLabelText(/^id/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^status/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^X-Client-ID/)).toBeInTheDocument();
  });

  it("shows a 'no configurable inputs' empty state when the Definition has nothing to enter", () => {
    renderArea();
    goToStep("Request Values");
    expect(screen.getByText("No manual request values required.")).toBeInTheDocument();
  });

  it("accepts a valid JSON payload, object and non-object roots alike", () => {
    renderArea({ requestInputDefinition: definitionWith({ requestBody: { bodyType: "JSON" } }) });
    goToStep("Request Values");
    const textarea = screen.getByLabelText("JSON Payload");
    for (const value of ['{"a":1}', "[1,2,3]", "42", '"hello"', "true", "null"]) {
      fireEvent.change(textarea, { target: { value } });
      expect(screen.getByText("Valid JSON")).toBeInTheDocument();
    }
  });

  it("shows feedback for malformed JSON", () => {
    renderArea({ requestInputDefinition: definitionWith({ requestBody: { bodyType: "JSON" } }) });
    goToStep("Request Values");
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: "{not valid" } });
    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it("shows a placeholder instead of crashing when the Request Input Definition is not available yet", () => {
    renderArea({ requestInputDefinition: null });
    goToStep("Request Values");
    expect(screen.getByText("Request Input Definition is not available yet.")).toBeInTheDocument();
  });
});

describe("RunApiArea — Version Metadata", () => {
  it("offers both Version fields, empty and optional, with no prefill (VER-OD-03)", () => {
    renderArea();
    goToStep("Version Metadata");
    expect((screen.getByLabelText("API Version") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Database Version") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Optional\./)).toBeInTheDocument();
  });

  it("records an undeclared field as UNKNOWN without blocking the other (VER-BR-02)", () => {
    renderArea();
    goToStep("Version Metadata");
    fireEvent.change(screen.getByLabelText("API Version"), { target: { value: "2.4.0" } });

    const summary = screen.getByText(/Will be recorded as/);
    expect(summary).toHaveTextContent("API Version: 2.4.0");
    expect(summary).toHaveTextContent("Database Version: UNKNOWN");
  });

  it("keeps a free-form version exactly as declared, trimmed (VER-OD-01)", () => {
    renderArea();
    goToStep("Version Metadata");
    fireEvent.change(screen.getByLabelText("Database Version"), { target: { value: "  release 2026-Q3  " } });
    expect(screen.getByText(/Will be recorded as/)).toHaveTextContent("Database Version: release 2026-Q3");
  });

  it("reports a version over the length cap instead of truncating it", () => {
    renderArea();
    goToStep("Version Metadata");
    fireEvent.change(screen.getByLabelText("API Version"), { target: { value: "x".repeat(101) } });
    expect(screen.getByText("API Version must be 100 characters or fewer.")).toBeInTheDocument();
  });

  it("keeps declared Version values when navigating away and back (values are lifted, not lost)", () => {
    renderArea();
    goToStep("Version Metadata");
    fireEvent.change(screen.getByLabelText("API Version"), { target: { value: "2.4.0" } });

    goToStep("Request Values");
    goToStep("Version Metadata");

    expect((screen.getByLabelText("API Version") as HTMLInputElement).value).toBe("2.4.0");
  });
});

describe("RunApiArea — Request Preview", () => {
  it("shows Method, the resolved URL, and a masked Authentication summary", () => {
    renderArea({ authTypeLabel: "Bearer Token", credentialStatus: "CONFIGURED" });
    goToStep("Request Preview");
    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText(CONFIG.fullUrl!)).toBeInTheDocument();
    expect(screen.getByText("Bearer Token — Configured")).toBeInTheDocument();
  });

  it("warns instead of previewing a request when no URL is configured", () => {
    renderArea({ config: { ...CONFIG, fullUrl: null, urlStatus: "NOT_CONFIGURED" } });
    goToStep("Request Preview");
    expect(screen.getByText(/No URL configured/)).toBeInTheDocument();
  });
});

describe("RunApiArea — Execute", () => {
  it("shows an honest 'not available yet' placeholder with a permanently disabled Execute button", () => {
    renderArea();
    goToStep("Execute");
    expect(screen.getByText(/Execution not available yet/)).toBeInTheDocument();
    expect(screen.getByTitle("Run execution is not part of this release.")).toBeDisabled();
  });
});

describe("RunApiArea — never executes", () => {
  it("never calls fetch during any interaction across any step", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderArea({
      requestInputDefinition: definitionWith({
        queryParameters: [{ name: "status", required: false }],
        requestBody: { bodyType: "JSON" },
      }),
    });

    goToStep("Request Values");
    fireEvent.change(screen.getByLabelText(/^status/), { target: { value: "active" } });
    fireEvent.change(screen.getByLabelText("JSON Payload"), { target: { value: "{}" } });

    goToStep("Version Metadata");
    fireEvent.change(screen.getByLabelText("API Version"), { target: { value: "2.4.0" } });

    goToStep("Request Preview");
    goToStep("Execute");
    fireEvent.click(screen.getByTitle("Run execution is not part of this release."));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
