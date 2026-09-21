import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { ApiDetailScreen } from "./ApiDetailScreen";

const API = {
  apiId: "a1",
  projectId: "p1",
  apiName: "Get Widget",
  httpMethod: "GET",
  path: "/widgets/{id}",
  description: "Fetch a widget by id.",
  creationSource: "MANUAL",
  createdAt: "t",
  updatedAt: "t",
};

const ENVIRONMENTS_PAGE = {
  items: [{ environmentId: "e1", environmentName: "Dev", classification: "NON_PRODUCTION", allowRun: true, environmentStatus: "ACTIVE", createdAt: "t", updatedAt: "t" }],
  page: 1,
  pageSize: 100,
  totalItems: 1,
  totalPages: 1,
};

const CONFIGS_PAGE = { apiId: "a1", items: [] };

const AUTH_CONFIG = {
  apiId: "a1",
  environmentId: "e1",
  authType: "NONE",
  credentialStatus: "NOT_REQUIRED",
  loginUrl: null,
  username: null,
  usernameField: null,
  passwordField: null,
  tokenResponsePath: null,
  updatedAt: null,
};

const REQUEST_INPUT = {
  apiId: "a1",
  httpMethod: "GET",
  path: "/widgets/{id}",
  pathParameters: [{ name: "id", required: true, source: "AUTO_DETECTED" }],
  queryParameters: [],
  headerParameters: [],
  requestBody: null,
};

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(requestInputOverride?: unknown, requestInputStatus = 200) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/request-input")) {
      if (init?.method === "PUT") {
        const payload = JSON.parse(init.body as string);
        return Promise.resolve(mockJsonResponse(200, { ...REQUEST_INPUT, ...payload }));
      }
      return Promise.resolve(mockJsonResponse(requestInputStatus, requestInputOverride ?? REQUEST_INPUT));
    }
    if (url.includes("/authentication")) {
      if (init?.method === "PUT" || init?.method === "DELETE") {
        const payload = init.body ? JSON.parse(init.body as string) : {};
        return Promise.resolve(mockJsonResponse(200, { ...AUTH_CONFIG, ...payload }));
      }
      return Promise.resolve(mockJsonResponse(200, AUTH_CONFIG));
    }
    if (url.includes("/environment-configs")) {
      return Promise.resolve(mockJsonResponse(200, CONFIGS_PAGE));
    }
    if (url.includes("/environments")) {
      return Promise.resolve(mockJsonResponse(200, ENVIRONMENTS_PAGE));
    }
    if (url.includes(`/apis/${API.apiId}`)) {
      return Promise.resolve(mockJsonResponse(200, API));
    }
    return Promise.resolve(mockJsonResponse(404, {}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen() {
  return render(
    <ApiDetailScreen
      user={ADMIN}
      projectId="p1"
      projectStatus="ACTIVE"
      apiId="a1"
      accessToken="token-1"
      onBack={vi.fn()}
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
    />,
  );
}

describe("ApiDetailScreen — tabs", () => {
  it("shows the guided steps in order: Endpoint, Request Input, Authentication, Review & Run", async () => {
    stubFetch();
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    const nav = screen.getByRole("navigation", { name: "API Workspace steps" });
    const stepButtons = within(nav).getAllByRole("button");
    expect(stepButtons.map((b) => b.getAttribute("aria-label"))).toEqual(["Endpoint", "Request Input", "Authentication", "Review & Run"]);
  });

  it("renders the Request Input tab content when selected, loaded from GET", async () => {
    stubFetch();
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    fireEvent.click(screen.getByText("Request Input"));

    expect(await screen.findByText("Path Parameters")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("Query Parameters")).toBeInTheDocument();
    expect(screen.getByText("Header Parameters")).toBeInTheDocument();
    expect(screen.getByText("Request Body")).toBeInTheDocument();
  });

  it("still renders the existing Endpoint tab content (non-regression)", async () => {
    stubFetch();
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    expect(screen.getByText("Fetch a widget by id.")).toBeInTheDocument();
  });

  it("still renders the existing Review & Run tab content (non-regression)", async () => {
    stubFetch();
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    fireEvent.click(screen.getByText("Review & Run"));

    expect(await screen.findByText("Full URL")).toBeInTheDocument();
  });

  it("renders the Authentication tab with real configuration, driven by the API", async () => {
    stubFetch();
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    fireEvent.click(screen.getByText("Authentication"));

    expect(await screen.findByText("Authentication Type")).toBeInTheDocument();
    expect(screen.getByText("No authentication is required for this API in this Environment.")).toBeInTheDocument();
  });
});

describe("ApiDetailScreen — Request Input persistence", () => {
  it("shows Query/Header/Body already configured from a persisted GET (not an empty mock-derived state)", async () => {
    stubFetch({
      ...REQUEST_INPUT,
      queryParameters: [{ name: "status", required: false }],
      headerParameters: [{ name: "X-Client-ID", required: true }],
      requestBody: { bodyType: "JSON" },
    });
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    fireEvent.click(screen.getByText("Request Input"));

    expect(await screen.findByText("status")).toBeInTheDocument();
    expect(screen.getByText("X-Client-ID")).toBeInTheDocument();
    expect(screen.getByDisplayValue("JSON")).toBeInTheDocument();
  });

  it("Save triggers a real PUT and the UI reflects the echoed response", async () => {
    const fetchMock = stubFetch();
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    fireEvent.click(screen.getByText("Request Input"));
    await screen.findByText("Path Parameters");

    fireEvent.click(screen.getByText("+ Add Query"));
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "status" } });
    fireEvent.click(screen.getByText("Add Parameter"));

    fireEvent.click(screen.getByText("Save"));

    await screen.findByText("Cancel changes");
    expect(screen.getByText("Cancel changes")).toBeDisabled();

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(putCall).toBeDefined();
    expect(String(putCall?.[0])).toContain("/apis/a1/request-input");
    const body = JSON.parse((putCall?.[1] as RequestInit).body as string);
    expect(body).toEqual({ queryParameters: [{ name: "status", required: false }], headerParameters: [], requestBody: null });
  });

  it("shows an inline error with Retry when the GET fails", async () => {
    stubFetch({ errorCode: "NOT_FOUND", message: "Request Input not found" }, 404);
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    fireEvent.click(screen.getByText("Request Input"));

    expect(await screen.findByText("Request Input not found")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});

describe("ApiDetailScreen — Run API", () => {
  it("navigates to Review & Run and shows the Run Preparation fields inline, reflecting the persisted Definition", async () => {
    stubFetch({
      ...REQUEST_INPUT,
      queryParameters: [{ name: "status", required: false }],
    });
    renderScreen();
    await screen.findByText("Fetch a widget by id.");

    await screen.findByText((_, el) => el?.tagName === "BUTTON" && el.textContent === "Run API" && !(el as HTMLButtonElement).disabled);
    fireEvent.click(screen.getByText("Run API"));

    expect(await screen.findByText("Full URL")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Run Preparation" })).not.toBeInTheDocument();
    expect(screen.getByText("Run Preparation")).toBeInTheDocument();
    expect(screen.getByLabelText(/^status/)).toBeInTheDocument();
  });

  it("does not execute any request when Review & Run is shown", async () => {
    const fetchMock = stubFetch();
    renderScreen();
    await screen.findByText("Fetch a widget by id.");
    await screen.findByText((_, el) => el?.tagName === "BUTTON" && el.textContent === "Run API" && !(el as HTMLButtonElement).disabled);
    fetchMock.mockClear();

    fireEvent.click(screen.getByText("Run API"));
    await screen.findByText("Full URL");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
