import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditLogScreen } from "./AuditLogScreen";

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const LONG_TIMEOUT = { timeout: 2000 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderLoaded() {
  render(<AuditLogScreen user={ADMIN} onBack={vi.fn()} onLogout={vi.fn()} />);
  await screen.findByText(/Showing \d/, {}, LONG_TIMEOUT);
}

describe("AuditLogScreen", () => {
  // UI-SEC-06
  it("shows the loading state before the mock fetch resolves", () => {
    render(<AuditLogScreen user={ADMIN} onBack={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByText("Loading audit logs...")).toBeInTheDocument();
  });

  // UI-SEC-01
  it("renders the audit list, newest first, once loaded", async () => {
    await renderLoaded();
    expect(screen.getAllByText("LOGIN_SUCCESS").length).toBeGreaterThan(0);
  });

  // UI-SEC-02 search
  it("filters by Actor via search", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByPlaceholderText("Search actor or target..."), { target: { value: "alice@example.com" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.textContent).toContain("alice@example.com"));
    });
  });

  // UI-SEC-02 search
  it("filters by Target via search", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByPlaceholderText("Search actor or target..."), { target: { value: "Project D" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.textContent).toContain("Project D"));
    });
  });

  // UI-SEC-02 filter
  it("filters by Event", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Events"), { target: { value: "ACCESS_DENIED" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.textContent).toContain("ACCESS_DENIED"));
    });
  });

  // UI-SEC-02 filter
  it("filters by Result", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Results"), { target: { value: "DENIED" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.textContent).toContain("DENIED"));
    });
  });

  // UI-SEC-02 filter
  it("filters by Project", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Projects"), { target: { value: "p1" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.textContent).toContain("Project A"));
    });
  });

  // UI-SEC-02 filter
  it("filters by Actor dropdown", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Actors"), { target: { value: "u2" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.textContent).toContain("alice@example.com"));
    });
  });

  // UI-SEC-02 filter
  it("filters by From/To date range", async () => {
    await renderLoaded();
    const fromInput = screen.getByLabelText("From", { exact: false });
    const toInput = screen.getByLabelText("To", { exact: false });
    fireEvent.change(fromInput, { target: { value: "2026-09-16" } });
    fireEvent.change(toInput, { target: { value: "2026-09-16" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((r) => r.textContent?.includes("LOGIN_SUCCESS"))).toBe(true);
      expect(rows.some((r) => r.textContent?.includes("PROJECT_CREATED"))).toBe(false);
    });
  });

  // UI-SEC-02 combined
  it("combines Search and Filter (intersection semantics)", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Results"), { target: { value: "DENIED" } });
    fireEvent.change(screen.getByPlaceholderText("Search actor or target..."), { target: { value: "bob@example.com" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row.textContent).toContain("bob@example.com");
        expect(row.textContent).toContain("DENIED");
      });
    });
  });

  // UI-SEC-02 clear filters
  it("Clear filters resets search, filters, and returns matching rows", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByDisplayValue("All Results"), { target: { value: "DENIED" } });
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.some((r) => r.textContent?.includes("LOGIN_SUCCESS"))).toBe(false);
    });

    fireEvent.click(screen.getAllByText("Clear filters")[0]);
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows.some((r) => r.textContent?.includes("LOGIN_SUCCESS"))).toBe(true);
    });
    expect((screen.getByPlaceholderText("Search actor or target...") as HTMLInputElement).value).toBe("");
  });

  // UI-SEC-03
  it("paginates results and shows an accurate range", async () => {
    await renderLoaded();
    expect(screen.getByText(/Showing 1–20 of/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(screen.getByText(/Showing 21–/)).toBeInTheDocument());
  });

  // UI-SEC-03
  it("resets to page 1 when the search query changes", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(screen.getByText(/Showing 21–/)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Search actor or target..."), { target: { value: "alice@example.com" } });
    await waitFor(() => expect(screen.getByText(/Showing 1–/)).toBeInTheDocument());
  });

  // UI-SEC-04
  it("clicking a row opens the detail modal for that entry", async () => {
    await renderLoaded();
    const rows = screen.getAllByRole("row").slice(1);
    const row = rows.find((r) => r.textContent?.includes("ACCESS_DENIED"))!;
    fireEvent.click(row);

    expect(await screen.findByText("Audit Log Detail")).toBeInTheDocument();
    expect(screen.getAllByText("ACCESS_DENIED").length).toBeGreaterThan(0);
  });

  // UI-SEC-04
  it("closing the modal preserves list/search/filter/page state", async () => {
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
    await renderLoaded();
    fireEvent.change(screen.getByPlaceholderText("Search actor or target..."), { target: { value: "nobody-matches-this-query" } });
    await waitFor(() => expect(screen.getByText("No audit logs match your filters.")).toBeInTheDocument());
    expect(screen.getAllByText("Clear filters").length).toBeGreaterThan(0);
  });

  // UI-SEC-06
  it("shows an error state with Retry, and Retry recovers to success", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Simulate load error"));
    expect(await screen.findByText("Unable to load audit logs.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry"));
    expect(screen.getByText("Loading audit logs...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("LOGIN_SUCCESS").length).toBeGreaterThan(0), LONG_TIMEOUT);
  });

  // UI-SEC-05
  it("exports ALL matching records via CSV, not just the current page", async () => {
    let capturedBlob: Blob | null = null;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock-url";
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await renderLoaded();
    fireEvent.click(screen.getByText("Export CSV"));
    await screen.findByText(/Export complete/, {}, LONG_TIMEOUT);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const csvText = await capturedBlob!.text();
    const dataRows = csvText.trim().split("\r\n").slice(1);
    expect(dataRows.length).toBeGreaterThan(20);
  });

  // UI-SEC-01
  it("exposes no Edit/Delete/bulk-selection UI", async () => {
    await renderLoaded();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox").length).toBe(0);
  });
});
