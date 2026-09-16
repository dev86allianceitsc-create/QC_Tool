import { useEffect, useState } from "react";
import { Header } from "../../components/Header";
import { listProjects } from "../projects/projects.api";
import type { ProjectListItem, Role } from "../projects/projects.types";
import type { AuditEvent, AuditResult } from "./audit.types";
import { AuditResultBadge } from "./AuditResultBadge";
import { AuditDetailModal } from "./AuditDetailModal";
import { useAuditLogDetail } from "./useAuditLogDetail";
import { useAuditLogs } from "./useAuditLogs";

// UI-SEC-01/02/03/05/06/07 — Admin-only Audit Log Viewer (REQ-SEC-001),
// wired to the real GET /audit-logs, GET /audit-logs/export, and
// GET /audit-logs/:auditId endpoints (API-SEC-001..003). Access control is
// enforced server-side (RolesGuard ADMIN); App.tsx also only renders this
// screen for user.role === "ADMIN" (non-admin gets AccessDeniedScreen).
// The Actor filter dropdown was dropped: no endpoint enumerates users, and
// the Search box already covers actor/target server-side.

const EVENT_OPTIONS: AuditEvent[] = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "SESSION_INVALID",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_ACTIVATED",
  "PROJECT_DEACTIVATED",
  "PROJECT_SOFT_DELETED",
  "PROJECT_MEMBER_ADDED",
  "PROJECT_MEMBER_REMOVED",
  "SYSTEM_ROLE_CHANGED",
  "ACCESS_DENIED",
  "API_CONFIG_CREATED",
  "API_CONFIG_UPDATED",
  "API_RUN_EXECUTED",
  "RESULT_CLASSIFICATION_CHANGED",
];

export function AuditLogScreen({
  user,
  accessToken,
  onBack,
  onLogout,
  onShowSessionExpired,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  accessToken: string | null;
  onBack: () => void;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const {
    filters,
    updateFilters,
    clearFilters,
    page,
    setPage,
    items,
    totalItems,
    totalPages,
    loading,
    error,
    refetch,
    exportState,
    exportCsv,
  } = useAuditLogs(accessToken, onSessionExpired, onAccessDenied);

  const detailState = useAuditLogDetail(accessToken, onSessionExpired, onAccessDenied);

  const [projectOptions, setProjectOptions] = useState<ProjectListItem[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    listProjects({ pageSize: 100 }, accessToken)
      .then((result) => setProjectOptions(result.items))
      .catch(() => setProjectOptions([]));
  }, [accessToken]);

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, totalItems);

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
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            style={{ padding: "8px", border: "1px solid #ccc", width: "220px" }}
          />

          <select value={filters.eventType || "ALL"} onChange={(e) => updateFilters({ eventType: e.target.value === "ALL" ? "" : e.target.value })} style={selectStyle}>
            <option value="ALL">All Events</option>
            {EVENT_OPTIONS.map((ev) => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>

          <select
            value={filters.result || "ALL"}
            onChange={(e) => updateFilters({ result: e.target.value === "ALL" ? "" : (e.target.value as AuditResult) })}
            style={selectStyle}
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="DENIED">DENIED</option>
          </select>

          <select value={filters.projectId || "ALL"} onChange={(e) => updateFilters({ projectId: e.target.value === "ALL" ? "" : e.target.value })} style={selectStyle}>
            <option value="ALL">All Projects</option>
            {projectOptions.map((p) => (
              <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
            ))}
          </select>

          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            From
            <input type="date" value={filters.from} onChange={(e) => updateFilters({ from: e.target.value })} style={{ padding: "6px", border: "1px solid #ccc" }} />
          </label>
          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            To
            <input type="date" value={filters.to} onChange={(e) => updateFilters({ to: e.target.value })} style={{ padding: "6px", border: "1px solid #ccc" }} />
          </label>

          <button onClick={clearFilters} style={btnStyle}>Clear filters</button>

          <button onClick={exportCsv} disabled={exportState === "exporting"} style={{ ...btnStyle, marginLeft: "auto", opacity: exportState === "exporting" ? 0.6 : 1 }}>
            Export CSV
          </button>
        </div>

        {exportState === "exporting" && <p style={{ fontSize: "12px", marginTop: "10px" }}>Exporting...</p>}
        {exportState === "success" && <p style={{ fontSize: "12px", marginTop: "10px", color: "#16A34A" }}>Export complete.</p>}
        {exportState === "error" && <p style={{ fontSize: "12px", marginTop: "10px", color: "red" }}>Export failed. Please try again.</p>}
      </div>

      <div style={{ flex: 1, padding: "20px", overflow: "auto" }}>
        {loading && <p>Loading audit logs...</p>}

        {!loading && error && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>Unable to load audit logs.</p>
            <button onClick={refetch} style={btnStyle}>Retry</button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>No audit logs match your filters.</p>
            <button onClick={clearFilters} style={btnStyle}>Clear filters</button>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000" }}>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Timestamp</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Actor</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Event</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Target</th>
                  <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #ccc" }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr
                    key={entry.auditId}
                    onClick={() => void detailState.open(entry.auditId)}
                    style={{ borderBottom: "1px solid #ccc", cursor: "pointer" }}
                  >
                    <td style={{ padding: "10px" }}>{new Date(entry.occurredAt).toLocaleString()}</td>
                    <td style={{ padding: "10px" }}>{entry.actorDisplay ?? "Unresolved / System"}</td>
                    <td style={{ padding: "10px" }}>{entry.eventType}</td>
                    <td style={{ padding: "10px" }}>{entry.targetDisplay ?? "—"}</td>
                    <td style={{ padding: "10px" }}>
                      <AuditResultBadge result={entry.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px" }}>
              <span style={{ fontSize: "12px", color: "#666" }}>
                Showing {rangeStart}–{rangeEnd} of {totalItems}
              </span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ ...btnStyle, opacity: page <= 1 ? 0.5 : 1 }}>
                  Prev
                </button>
                <span style={{ fontSize: "12px" }}>Page {page} of {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={{ ...btnStyle, opacity: page >= totalPages ? 0.5 : 1 }}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailState.auditId && (
        <AuditDetailModal detail={detailState.detail} loading={detailState.loading} error={detailState.error} onClose={detailState.close} />
      )}
    </div>
  );
}
