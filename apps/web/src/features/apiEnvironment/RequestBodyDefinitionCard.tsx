// UI-INP-05: Body is an optional capability of the API (BR-INP-003-16/17).
// MVP Body Type is JSON only (UI-DP-3B-02, FROZEN) — no other type is ever
// rendered as a selectable option. No payload editor here: JSON payload is
// entered manually for each Run (REQ-INP-005), not stored in the Definition.
export function RequestBodyDefinitionCard({ enabled, onToggle }: { enabled: boolean; onToggle: (enabled: boolean) => void }) {
  return (
    <div>
      <h4 style={{ margin: "0 0 8px 0" }}>Request Body</h4>
      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        Use request body
      </label>
      {enabled && (
        <div style={{ marginTop: "10px" }}>
          <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Body Type</span>
          <input type="text" value="JSON" disabled readOnly style={{ width: "160px", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box", backgroundColor: "#F3F4F6" }} />
          <p style={{ color: "#666", fontSize: "12px", marginTop: "5px" }}>JSON payload is entered manually for each Run.</p>
        </div>
      )}
    </div>
  );
}
