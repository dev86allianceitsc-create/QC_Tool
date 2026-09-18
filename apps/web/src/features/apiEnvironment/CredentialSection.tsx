// UI-CRED-01 boundary only. Credential (Auth Type, Configure/Replace/Remove)
// is 3C and not implemented on the backend — every config always reports
// credentialStatus: "UNAVAILABLE_IN_3A". This section is a read-only
// placeholder until 3C ships; there is no Configure/Replace/Remove endpoint
// to call yet.
export function CredentialSection() {
  return (
    <div style={{ border: "1px solid #ccc", padding: "15px", marginTop: "15px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={{ margin: 0 }}>Credential</h4>
        <span
          style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: "bold",
            backgroundColor: "#F3F4F6",
            color: "#6B7280",
          }}
        >
          Not available yet
        </span>
      </div>
      <p style={{ color: "#666", fontSize: "13px", marginTop: "8px" }}>Credential configuration is not available in this release.</p>
    </div>
  );
}
