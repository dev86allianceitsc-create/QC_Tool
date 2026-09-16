import type { AuditLogEntry } from "./audit.types";
import { AuditResultBadge } from "./AuditResultBadge";

// UI-SEC-04: centered modal opened from a table row in AuditLogScreen,
// following this app's existing modal/overlay convention (see the Create
// Project modal in ProjectListScreen.tsx and the SessionExpiredModal in
// App.tsx: fixed rgba(0,0,0,0.5) backdrop + centered white box). Strictly
// read-only: no edit/save affordances anywhere in this component.
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "13px" }}>{value}</div>
    </div>
  );
}

function ChangeBlock({ label, data }: { label: string; data: Record<string, string> | null }) {
  if (!data) return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>{label}</div>
      <div style={{ border: "1px solid #ccc", padding: "8px", fontSize: "12px", fontFamily: "monospace", backgroundColor: "#f9f9f9" }}>
        {entries.map(([key, value]) => (
          <div key={key}>
            {key}: {value}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuditDetailModal({ entry, onClose }: { entry: AuditLogEntry; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}
      data-testid="audit-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          border: "1px solid #000",
          padding: "20px",
          width: "440px",
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h3 style={{ margin: 0 }}>Audit Log Detail</h3>
          <button onClick={onClose} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            Close
          </button>
        </div>

        <Field label="Audit ID" value={entry.id} />
        <Field label="Event" value={entry.event} />
        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>Result</div>
          <AuditResultBadge result={entry.result} />
        </div>
        <Field label="Timestamp" value={new Date(entry.timestamp).toLocaleString()} />
        <Field label="Actor" value={entry.actor ? entry.actor.email : "Unresolved / System"} />
        <Field label="Actor / User ID" value={entry.actor ? entry.actor.id : "—"} />
        <Field label="Target" value={entry.target} />
        <Field label="Target Type" value={entry.targetType ?? "—"} />
        <Field label="Target ID" value={entry.targetId ?? "—"} />
        <Field label="Project" value={entry.project ? entry.project.name : "—"} />
        <Field label="Project ID" value={entry.project ? entry.project.id : "—"} />
        <ChangeBlock label="Change Information / Before" data={entry.before} />
        <ChangeBlock label="Change Information / After" data={entry.after} />
        <Field label="Request ID" value={entry.requestId ?? "—"} />
      </div>
    </div>
  );
}
