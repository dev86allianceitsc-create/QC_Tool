import { useState } from "react";

// UI-INP-07/REQ-INP-005 support: syntax-only JSON validation for a manually
// entered Run payload (REQ-INP-004). No schema validation, no size limits,
// no forced object-root — any valid JSON value is accepted. Empty input is a
// neutral "not yet entered" state, not an error and not coerced to {}/null.
export function JsonPayloadEditor({ value, onChange, autoFocus }: { value: string; onChange: (value: string) => void; autoFocus?: boolean }) {
  const [error, setError] = useState<string | null>(null);

  function validate(next: string) {
    if (next.trim() === "") {
      setError(null);
      return;
    }
    try {
      JSON.parse(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }} htmlFor="json-payload-editor">
        JSON Payload
      </label>
      <textarea
        id="json-payload-editor"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          validate(e.target.value);
        }}
        onBlur={(e) => validate(e.target.value)}
        rows={8}
        autoFocus={autoFocus}
        placeholder="Enter JSON payload for this Run"
        style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box", fontFamily: "monospace", fontSize: "13px" }}
      />
      {value.trim() !== "" && (
        error ? (
          <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>Invalid JSON: {error}</p>
        ) : (
          <p style={{ color: "green", fontSize: "12px", marginTop: "5px" }}>Valid JSON</p>
        )
      )}
    </div>
  );
}
