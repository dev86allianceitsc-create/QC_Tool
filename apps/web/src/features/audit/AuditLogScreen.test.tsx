import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse, mockTextResponse } from "../../test/mock-fetch";
import { AuditLogScreen } from "./AuditLogScreen";

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const LONG_TIMEOUT = { timeout: 2000 };

const ITEM_A = { auditId: "a1", eventType: "LOGIN_SUCCESS", result: "SUCCESS", occurredAt: "2026-09-16T08:12:03.000Z", actorDisplay: "admin@example.com", targetDisplay: "admin@example.com", projectId: null };
const ITEM_B = { auditId: "a2", eventType: "ACCESS_DENIED", result: "DENIED", occurredAt: "2026-09-06T12:40:00.000Z", actorDisplay: "carol@example.com", targetDisplay: "Project D", projectId: "p1" };

const PROJECTS_PAGE = { items: [{ projectId: "p1", projectName: "Project A", description: null, projectStatus: "ACTIVE" }], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 };
const LOGS_PAGE = { items: [ITEM_A, ITEM_B], page: 1, pageSize: 20, totalItems: 2, totalPages: 1 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/projects?")) return Promise.resolve(mockJsonResponse(200, PROJECTS_PAGE));
    if (String(url).includes("/audit-logs/export")) return Promise.resolve(mockTextResponse(200, "auditId\r\na1"));
    if (String(url).includes("/audit-logs/")) {
      return Promise.resolve(mockJsonResponse(200, { ...ITEM_B, actorUserId: "u4", targetType: "PROJECT", targetId: "p1", beforeData: null, afterData: null, requestId: "req-1", detail: null }));
    }
    return Promise.resolve(mockJsonResponse(200, LOGS_PAGE));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderLoaded() {
  const fetchMock = stubFetch();
  render(<AuditLogScreen user={ADMIN} accessToken="token-1" onBack={vi.fn()} onLogout={vi.fn()} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />);
  await screen.findByText(/Showing \d/, {}, LONG_TIMEOUT);
  return fetchMock;
}

describe("AuditLogScreen", () => {
  // UI-SEC-06
  it("shows the loading state before the fetch resolves", () => {
    stubFetch();
    render(<AuditLogScreen user={ADMIN} accessToken="token-1" onBack={vi.fn()} onLogout={vi.fn()} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />);
    expect(screen.getByText("Loading audit logs...")).toBeInTheDocument();
  });

  // UI-SEC-01
  it("renders the audit list once loaded", async () => {
    await renderLoaded();
    expect(screen.getAllByText("LOGIN_SUCCESS").length).toBeGreaterThan(0);
  });

  // UI-SEC-02 search
  it("filters by Search and resets to page 1", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.change(screen.getByPlaceholderText("Search actor or target..."), { target: { value: "alice@example.com" } });
    await waitFor(() => {
      const [url] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(url)).toContain("search=alice%40example.com");
      expect(String(url)).toContain("page=1");
    });
  });

  // UI-SEC-02 filter
  it("filters by Event", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Events"), { target: { value: "ACCESS_DENIED" } });
    await waitFor(() => {
      const [url] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(url)).toContain("eventType=ACCESS_DENIED");
    });
  });

  // UI-SEC-02 filter
  it("filters by Result", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Results"), { target: { value: "DENIED" } });
    await waitFor(() => {
      const [url] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(url)).toContain("result=DENIED");
    });
  });

  // UI-SEC-02 filter
  it("filters by Project, populated from GET /projects", async () => {
    const fetchMock = await renderLoaded();
    await waitFor(() => expect(screen.getByDisplayValue("All Projects")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("All Projects"), { target: { value: "p1" } });
    await waitFor(() => {
      const [url] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(url)).toContain("projectId=p1");
    });
  });

  // UI-SEC-02 filter
  it("filters by From/To date range", async () => {
    const fetchMock = await renderLoaded();
    const fromInput = screen.getByLabelText("From", { exact: false });
    const toInput = screen.getByLabelText("To", { exact: false });
    fireEvent.change(fromInput, { target: { value: "2026-09-16" } });
    fireEvent.change(toInput, { target: { value: "2026-09-16" } });
    await waitFor(() => {
      const [url] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(url)).toContain("from=2026-09-16");
      expect(String(url)).toContain("to=2026-09-16");
    });
  });

  // UI-SEC-02 clear filters
  it("Clear filters resets search/filters and refetches", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Results"), { target: { value: "DENIED" } });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));

    fireEvent.click(screen.getByText("Clear filters"));
    await waitFor(() => {
      const [url] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(url)).not.toContain("result=");
    });
    expect((screen.getByPlaceholderText("Search actor or target...") as HTMLInputElement).value).toBe("");
  });

  // UI-SEC-03
  it("paginates results via Prev/Next wired to real page/totalPages", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/projects?")) return Promise.resolve(mockJsonResponse(200, PROJECTS_PAGE));
      if (String(url).includes("page=2")) return Promise.resolve(mockJsonResponse(200, { items: [ITEM_B], page: 2, pageSize: 20, totalItems: 21, totalPages: 2 }));
      return Promise.resolve(mockJsonResponse(200, { items: [ITEM_A], page: 1, pageSize: 20, totalItems: 21, totalPages: 2 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditLogScreen user={ADMIN} accessToken="token-1" onBack={vi.fn()} onLogout={vi.fn()} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />);
    await screen.findByText(/Showing 1–/, {}, LONG_TIMEOUT);

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(screen.getByText(/Showing 21–/)).toBeInTheDocument());
  });

  // UI-SEC-04
  it("clicking a row opens the detail modal for that entry", async () => {
    await renderLoaded();
    const rows = screen.getAllByRole("row").slice(1);
    const row = rows.find((r) => r.textContent?.includes("ACCESS_DENIED"))!;
    fireEvent.click(row);

    expect(await screen.findByText("Audit Log Detail")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("ACCESS_DENIED").length).toBeGreaterThan(0));
  });

  // UI-SEC-04
  it("closing the modal preserves list/search state", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByPlaceholderText("Search actor or target..."), { target: { value: "alice@example.com" } });
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));

    const row = screen.getAllByRole("row")[1];
    fireEvent.click(row);
    await screen.findByText("Audit Log Detail");

    fireEvent.click(screen.getByText("Close"));
    await waitFor(() => expect(screen.queryByText("Audit Log Detail")).not.toBeInTheDocument());
    expect((screen.getByPlaceholderText("Search actor or target...") as HTMLInputElement).value).toBe("alice@example.com");
  });

  // UI-SEC-06
  it("shows the no-match empty state with Clear filters", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/projects?")) return Promise.resolve(mockJsonResponse(200, PROJECTS_PAGE));
      return Promise.resolve(mockJsonResponse(200, { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditLogScreen user={ADMIN} accessToken="token-1" onBack={vi.fn()} onLogout={vi.fn()} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("No audit logs match your filters.")).toBeInTheDocument());
    expect(screen.getAllByText("Clear filters").length).toBeGreaterThan(0);
  });

  // UI-SEC-06
  it("shows an error state with Retry, and Retry recovers to success", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/projects?")) return Promise.resolve(mockJsonResponse(200, PROJECTS_PAGE));
      return Promise.resolve(mockJsonResponse(500, { errorCode: "INTERNAL_ERROR", message: "boom", details: [], requestId: "r1" }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditLogScreen user={ADMIN} accessToken="token-1" onBack={vi.fn()} onLogout={vi.fn()} onSessionExpired={vi.fn()} onAccessDenied={vi.fn()} />);
    expect(await screen.findByText("Unable to load audit logs.")).toBeInTheDocument();

    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/projects?")) return Promise.resolve(mockJsonResponse(200, PROJECTS_PAGE));
      return Promise.resolve(mockJsonResponse(200, LOGS_PAGE));
    });
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(screen.getAllByText("LOGIN_SUCCESS").length).toBeGreaterThan(0), LONG_TIMEOUT);
  });

  // UI-SEC-05
  it("exports via GET /audit-logs/export and triggers a download", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const fetchMock = await renderLoaded();
    fireEvent.click(screen.getByText("Export CSV"));
    await screen.findByText(/Export complete/, {}, LONG_TIMEOUT);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const exportCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/audit-logs/export"));
    expect(exportCall).toBeTruthy();
  });

  // UI-SEC-01
  it("exposes no Edit/Delete/bulk-selection UI", async () => {
    await renderLoaded();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox").length).toBe(0);
  });
});
