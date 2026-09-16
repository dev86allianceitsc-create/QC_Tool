import type { AuditLogDetail } from "./audit.types";
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

function ChangeBlock({ label, data }: { label: string; data: unknown }) {
  if (data === null || data === undefined) return null;
  const entries = typeof data === "object" ? Object.entries(data as Record<string, unknown>) : [];
  if (entries.length === 0) return null;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>{label}</div>
      <div style={{ border: "1px solid #ccc", padding: "8px", fontSize: "12px", fontFamily: "monospace", backgroundColor: "#f9f9f9" }}>
        {entries.map(([key, value]) => (
          <div key={key}>
            {key}: {String(value)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuditDetailModal({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: AuditLogDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
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

        {loading && <p>Loading detail...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {detail && (
          <>
            <Field label="Audit ID" value={detail.auditId} />
            <Field label="Event" value={detail.eventType} />
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>Result</div>
              <AuditResultBadge result={detail.result} />
            </div>
            <Field label="Timestamp" value={new Date(detail.occurredAt).toLocaleString()} />
            <Field label="Actor" value={detail.actorDisplay ?? "Unresolved / System"} />
            <Field label="Actor / User ID" value={detail.actorUserId ?? "—"} />
            <Field label="Target" value={detail.targetDisplay ?? "—"} />
            <Field label="Target Type" value={detail.targetType ?? "—"} />
            <Field label="Target ID" value={detail.targetId ?? "—"} />
            <Field label="Project ID" value={detail.projectId ?? "—"} />
            <ChangeBlock label="Change Information / Before" data={detail.beforeData} />
            <ChangeBlock label="Change Information / After" data={detail.afterData} />
            <Field label="Request ID" value={detail.requestId ?? "—"} />
            {detail.detail && <Field label="Detail" value={detail.detail} />}
          </>
        )}
      </div>
    </div>
  );
}
