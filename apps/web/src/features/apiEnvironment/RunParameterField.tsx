// UI-INP-08/REQ-INP-004: single manual Run value input for one Path, Query,
// or Header parameter. This is a Run-time value only — never written back
// into the Request Input Definition (BR-INP-003-10, §20 boundary).
export function RunParameterField({
  label,
  required,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  required: boolean;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const inputId = `run-param-${label}`;
  return (
    <label htmlFor={inputId} style={{ display: "block", marginBottom: "10px" }}>
      <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }}>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
      />
    </label>
  );
}
