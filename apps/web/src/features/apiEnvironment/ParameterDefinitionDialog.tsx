import { useState } from "react";
import type { ParameterDefinition, ParameterLocation } from "./requestInput.types";
import { isDuplicateName, isReservedHeaderName, validateParameterNameFormat } from "./requestInput.util";

// UI-INP-06: reusable Add/Edit dialog for Query and Header Definitions.
// Client-side validation is UX only (§3.2/§3.3) — the backend remains
// authoritative. No value/default field is exposed here (BR-INP-003-10):
// Run Values are entered later, in Run Preparation.
export function ParameterDefinitionDialog({
  location,
  initialValue,
  existingNames,
  onSave,
  onCancel,
}: {
  location: ParameterLocation;
  initialValue?: ParameterDefinition;
  existingNames: string[];
  onSave: (value: ParameterDefinition) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [required, setRequired] = useState(initialValue?.required ?? false);
  const [error, setError] = useState<string | null>(null);

  const locationLabel = location === "QUERY" ? "Query" : "Header";

  function handleSave() {
    const trimmed = name.trim();
    const formatError = validateParameterNameFormat(trimmed, location);
    if (formatError) {
      setError(formatError);
      return;
    }
    if (location === "HEADER" && isReservedHeaderName(trimmed)) {
      setError(`'${trimmed}' is reserved and cannot be configured as a normal Header. Authentication belongs to Group 3C.`);
      return;
    }
    const namesToCompare = initialValue ? existingNames.filter((n) => n !== initialValue.name) : existingNames;
    if (isDuplicateName(trimmed, namesToCompare, location)) {
      setError(`Duplicate ${locationLabel} parameter name '${trimmed}' is not allowed.`);
      return;
    }
    setError(null);
    onSave({ name: trimmed, required });
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "380px" }}>
        <h3>{initialValue ? `Edit ${locationLabel} Parameter` : `Add ${locationLabel} Parameter`}</h3>
        <label style={{ display: "block", marginBottom: "10px" }}>
          <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder={location === "QUERY" ? "status" : "X-Client-ID"}
            style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
          />
        </label>
        <fieldset style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "10px" }}>
          <legend style={{ fontWeight: "bold", fontSize: "13px" }}>Requirement</legend>
          <label style={{ display: "block", marginBottom: "5px" }}>
            <input type="radio" checked={required} onChange={() => setRequired(true)} /> Required
          </label>
          <label style={{ display: "block" }}>
            <input type="radio" checked={!required} onChange={() => setRequired(false)} /> Optional
          </label>
        </fieldset>
        <p style={{ color: "#666", fontSize: "12px" }}>No value is stored here. Value is entered when preparing a Run.</p>
        {error && <p style={{ color: "red", fontSize: "12px" }}>{error}</p>}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            {initialValue ? "Save Changes" : "Add Parameter"}
          </button>
        </div>
      </div>
    </div>
  );
}
