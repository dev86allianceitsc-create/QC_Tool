// Extracted unchanged from App.tsx so it can be reused by the new
// features/projects screens without duplicating markup.
export function Header({
  user,
  onLogout,
  title,
  onShowSessionExpired,
  onNavigateAuditLogs,
}: {
  user: { email: string; role: string };
  onLogout: () => void;
  title: string;
  onShowSessionExpired?: () => void;
  // UI-SEC-07: presentation-only nav item — only passed by callers when
  // user.role === "ADMIN", so USER never sees this button.
  onNavigateAuditLogs?: () => void;
}) {
  return (
    <div style={{ height: "60px", borderBottom: "1px solid #ccc", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f9f9f9" }}>
      <h2 style={{ margin: 0, fontSize: "18px" }}>{title}</h2>
      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        <span>{user.email} ({user.role})</span>
        {onNavigateAuditLogs && (
          <button onClick={onNavigateAuditLogs} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            Audit Logs
          </button>
        )}
        {onShowSessionExpired && (
          <button onClick={onShowSessionExpired} style={{ fontSize: "10px", padding: "4px 8px", border: "1px solid #ccc", backgroundColor: "#fff", cursor: "pointer", color: "#666" }}>
            [Test Session Expired]
          </button>
        )}
        <button onClick={onLogout} style={{ padding: "8px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          Logout
        </button>
      </div>
    </div>
  );
}
