// Generic confirmation overlay for new PRJ actions (Activate/Deactivate,
// Soft Delete, Remove Member). Modeled visually on App.tsx's existing Cancel
// Invitation overlay, but kept as its own component so that existing modal
// is left completely untouched.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "400px", textAlign: "center" }}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer", color: danger ? "red" : undefined }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
