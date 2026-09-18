// New primitive: no read-only/inactive banner exists elsewhere yet.
// Used for Project INACTIVE and Environment INACTIVE (UI-SHARED-01) — both
// mean "view-only, mutation actions disabled" per REQ-FUN-001/REQ-ENV-003.
export function InactiveBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "10px 20px",
        backgroundColor: "#F3F4F6",
        borderBottom: "1px solid #ccc",
        color: "#6B7280",
        fontSize: "13px",
      }}
    >
      {message}
    </div>
  );
}
