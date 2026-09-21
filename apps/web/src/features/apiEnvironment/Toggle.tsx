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
      className={`box-border inline-flex h-5 w-10 items-center rounded-full border p-0.5 transition-colors ${
        checked ? "border-primary bg-primary" : "border-border-strong bg-white"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full transition-transform ${checked ? "translate-x-[18px] bg-white" : "translate-x-0 bg-gray-900"}`}
      />
    </button>
  );
}
