// New primitive: no on/off switch exists elsewhere in the codebase yet.
// Used for Allow Run (REQ-ENV-003) — Admin-only mutation, disabled otherwise.
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "40px",
        height: "20px",
        padding: "2px",
        border: "1px solid #000",
        borderRadius: "10px",
        backgroundColor: checked ? "#000" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: checked ? "#fff" : "#000",
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 0.15s ease",
        }}
      />
    </button>
  );
}
