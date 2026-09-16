import { useEffect, useState } from "react";
import { Header } from "../../components/Header";
import type { Role } from "../projects/projects.types";
import { MOCK_AUDIT_LOGS } from "./audit.mock";
import type { AuditEvent, AuditLogEntry, AuditResult } from "./audit.types";
import { AuditResultBadge } from "./AuditResultBadge";
import { AuditDetailModal } from "./AuditDetailModal";

// UI-SEC-01/02/03/05/06/07 — Admin-only Audit Log Viewer (REQ-SEC-001).
// Access control is presentation-only here: App.tsx only renders this
// screen for user.role === "ADMIN" (non-admin gets AccessDeniedScreen).
// Real backend enforcement is out of scope for this milestone (no
// audit_logs table/API exists yet — see audit.types.ts).

const PAGE_SIZE = 20;

type LoadState = "loading" | "success" | "error";
type ExportState = "idle" | "exporting" | "success" | "error";

function escapeCsvCell(raw: string): string {
  // Defends against CSV/Formula Injection when opened in spreadsheet apps.
  const prefixed = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${prefixed.replace(/"/g, '""')}"`;
}

function buildCsv(rows: AuditLogEntry[]): string {
  const headers = ["Audit ID", "Timestamp", "Actor", "Event", "Target", "Project", "Result"];
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.timestamp,
        r.actor ? r.actor.email : "Unresolved / System",
        r.event,
        r.target,
        r.project ? r.project.name : "",
        r.result,
      ]
        .map((c) => escapeCsvCell(String(c)))
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export function AuditLogScreen({
  user,
  onBack,
  onLogout,
  onShowSessionExpired,
}: {
  user: { email: string; role: Role };
  onBack: () => void;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<"ALL" | AuditEvent>("ALL");
  const [resultFilter, setResultFilter] = useState<"ALL" | AuditResult>("ALL");
  const [projectFilter, setProjectFilter] = useState<"ALL" | string>("ALL");
  const [actorFilter, setActorFilter] = useState<"ALL" | "SYSTEM" | string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");

  function loadLogs() {
    setLoadState("loading");
    // Simulated GET /audit-logs. A real implementation would issue a
    // server-paginated request per page/filter change instead of loading
    // everything once and deriving pages client-side.
    setTimeout(() => {
      setLogs(MOCK_AUDIT_LOGS);
      setLoadState("success");
    }, 600);
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventOptions = Array.from(new Set(logs.map((l) => l.event))).sort();
  const projectOptions = Array.from(new Map(logs.filter((l) => l.project).map((l) => [l.project!.id, l.project!.name])).entries());
  const actorOptions = Array.from(new Map(logs.filter((l) => l.actor).map((l) => [l.actor!.id, l.actor!.email])).entries());
  const hasUnresolvedActor = logs.some((l) => !l.actor);

  function matchesQuery(entry: AuditLogEntry): boolean {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || (entry.actor?.email.toLowerCase().includes(q) ?? false) || entry.target.toLowerCase().includes(q);
    const matchEvent = eventFilter === "ALL" || entry.event === eventFilter;
    const matchResult = resultFilter === "ALL" || entry.result === resultFilter;
    const matchProject = projectFilter === "ALL" || entry.project?.id === projectFilter;
    const matchActor = actorFilter === "ALL" || (actorFilter === "SYSTEM" ? !entry.actor : entry.actor?.id === actorFilter);
    const entryDate = entry.timestamp.slice(0, 10);
    const matchFrom = !fromDate || entryDate >= fromDate;
    const matchTo = !toDate || entryDate <= toDate;
    return matchSearch && matchEvent && matchResult && matchProject && matchActor && matchFrom && matchTo;
  }

  const filtered = logs.filter(matchesQuery).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, totalCount);

  const selectedEntry = logs.find((l) => l.id === selectedId) ?? null;

  function handleClearFilters() {
    setSearch("");
    setEventFilter("ALL");
    setResultFilter("ALL");
    setProjectFilter("ALL");
    setActorFilter("ALL");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function handleExport() {
    setExportState("exporting");
    setTimeout(() => {
      try {
        const csv = buildCsv(filtered); // ALL matching records, not just the current page
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportState("success");
      } catch {
        setExportState("error");
      }
    }, 700);
  }

  const selectStyle = { padding: "8px", border: "1px solid #ccc" };
  const btnStyle = { padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title="Audit Logs" onShowSessionExpired={onShowSessionExpired} />
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc" }}>
        <button onClick={onBack} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          ← Back
        </button>
      </div>

      <div style={{ padding: "20px", borderBottom: "1px solid #ccc" }}>
        <h2 style={{ margin: "0 0 4px" }}>Audit Logs</h2>
        <p style={{ margin: "0 0 15px", color: "#666" }}>Review system activity and security events</p>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search actor or target..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: "8px", border: "1px solid #ccc", width: "220px" }}
          />

          <select value={eventFilter} onChange={(e) => { setEventFilter(e.target.value as "ALL" | AuditEvent); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Events</option>
            {eventOptions.map((ev) => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>

          <select value={resultFilter} onChange={(e) => { setResultFilter(e.target.value as "ALL" | AuditResult); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="DENIED">DENIED</option>
          </select>

          <select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Projects</option>
            {projectOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          <select value={actorFilter} onChange={(e) => { setActorFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Actors</option>
            {actorOptions.map(([id, email]) => (
              <option key={id} value={id}>{email}</option>
            ))}
            {hasUnresolvedActor && <option value="SYSTEM">Unresolved / System</option>}
          </select>

          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            From
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} style={{ padding: "6px", border: "1px solid #ccc" }} />
          </label>
          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            To
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} style={{ padding: "6px", border: "1px solid #ccc" }} />
          </label>

          <button onClick={handleClearFilters} style={btnStyle}>Clear filters</button>

          <button onClick={handleExport} disabled={exportState === "exporting"} style={{ ...btnStyle, marginLeft: "auto", opacity: exportState === "exporting" ? 0.6 : 1 }}>
            Export CSV
          </button>
        </div>

        {exportState === "exporting" && <p style={{ fontSize: "12px", marginTop: "10px" }}>Exporting...</p>}
        {exportState === "success" && <p style={{ fontSize: "12px", marginTop: "10px", color: "#16A34A" }}>Export complete — {totalCount} matching record(s) downloaded.</p>}
        {exportState === "error" && <p style={{ fontSize: "12px", marginTop: "10px", color: "red" }}>Export failed. Please try again.</p>}

        {import.meta.env.DEV && (
          <div style={{ marginTop: "10px", padding: "8px", border: "1px dashed #ccc", backgroundColor: "#f9f9f9" }}>
            <p style={{ fontSize: "11px", color: "#666", margin: "0 0 5px" }}>*** Development Only - Demo Controls ***</p>
            <div style={{ display: "flex", gap: "5px" }}>
              <button onClick={() => setLoadState("error")} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
                Simulate load error
              </button>
              <button onClick={() => setExportState("error")} style={{ fontSize: "11px", padding: "5px 10px", border: "1px solid #ccc", cursor: "pointer" }}>
                Simulate export failure
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        {loadState === "loading" && <p>Loading audit logs...</p>}

        {loadState === "error" && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>Unable to load audit logs.</p>
            <button onClick={loadLogs} style={btnStyle}>Retry</button>
          </div>
        )}

        {loadState === "success" && logs.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>No audit logs yet.</p>
            <p style={{ color: "#666" }}>System activity will appear here.</p>
          </div>
        )}

        {loadState === "success" && logs.length > 0 && totalCount === 0 && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>No audit logs match your filters.</p>
            <button onClick={handleClearFilters} style={btnStyle}>Clear filters</button>
          </div>
        )}

        {loadState === "success" && totalCount > 0 && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000" }}>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Timestamp</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Actor</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Event</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Target</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Project</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    style={{ borderBottom: "1px solid #ccc", cursor: "pointer" }}
                  >
                    <td style={{ padding: "10px" }}>{new Date(entry.timestamp).toLocaleString()}</td>
                    <td style={{ padding: "10px" }}>{entry.actor ? entry.actor.email : "Unresolved / System"}</td>
                    <td style={{ padding: "10px" }}>{entry.event}</td>
                    <td style={{ padding: "10px" }}>{entry.target}</td>
                    <td style={{ padding: "10px" }}>{entry.project ? entry.project.name : "—"}</td>
                    <td style={{ padding: "10px" }}>
                      <AuditResultBadge result={entry.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px" }}>
              <span style={{ fontSize: "12px", color: "#666" }}>
                Showing {rangeStart}–{rangeEnd} of {totalCount}
              </span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ ...btnStyle, opacity: safePage <= 1 ? 0.5 : 1 }}>
                  Prev
                </button>
                <span style={{ fontSize: "12px" }}>Page {safePage} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ ...btnStyle, opacity: safePage >= totalPages ? 0.5 : 1 }}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedEntry && <AuditDetailModal entry={selectedEntry} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
