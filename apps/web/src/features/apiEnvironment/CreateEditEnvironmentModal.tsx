import { useState } from "react";
import type { EnvironmentClassification, EnvironmentListItem } from "./apiEnvironment.types";
import { Toggle } from "./Toggle";

// UI-ENV-02. Name uniqueness (REQ-ENV-001) is authoritative on the backend
// (409 ENVIRONMENT_NAME_EXISTS) and surfaced via the `error` prop instead of
// a client-side pre-check. Allow Run is server-derived on Create (no field on
// CreateEnvironmentDto), so the toggle previews the default but is disabled
// until the Environment exists; on Edit, allowRun is only included in the
// save payload if the admin actually touched it, so the frozen
// "PRODUCTION -> NON_PRODUCTION preserves allowRun when omitted" rule holds.
export function CreateEditEnvironmentModal({
  editing,
  saving,
  error,
  onSave,
  onCancel,
}: {
  editing: EnvironmentListItem | null;
  saving?: boolean;
  error?: string | null;
  onSave: (input: { environmentName: string; classification: EnvironmentClassification; allowRun?: boolean }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.environmentName ?? "");
  const [classification, setClassification] = useState<EnvironmentClassification>(editing?.classification ?? "NON_PRODUCTION");
  const [allowRun, setAllowRun] = useState(editing?.allowRun ?? true);
  const [touchedAllowRun, setTouchedAllowRun] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleClassificationChange(next: EnvironmentClassification) {
    setClassification(next);
    if (!touchedAllowRun) {
      setAllowRun(next === "NON_PRODUCTION");
    }
  }

  function handleSave() {
    if (!name.trim()) {
      setLocalError("Environment Name is required");
      return;
    }
    setLocalError(null);
    if (editing) {
      onSave({ environmentName: name.trim(), classification, ...(touchedAllowRun ? { allowRun } : {}) });
    } else {
      onSave({ environmentName: name.trim(), classification });
    }
  }

  const displayError = localError ?? error ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "400px" }}>
        <h3>{editing ? "Edit Environment" : "Create Environment"}</h3>
        <label style={{ display: "block", marginBottom: "10px" }}>
          <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Environment Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setLocalError(null); }}
            placeholder="e.g. Development, QA, Production"
            style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: "10px" }}>
          <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Classification *</span>
          <select value={classification} onChange={(e) => handleClassificationChange(e.target.value as EnvironmentClassification)} style={{ width: "100%", padding: "8px", border: "1px solid #ccc" }}>
            <option value="NON_PRODUCTION">Non-Production</option>
            <option value="PRODUCTION">Production</option>
          </select>
          <span style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "#666" }}>
            Independent of the Environment Name — naming an Environment "Production" does not make it Production.
          </span>
        </label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <span style={{ fontWeight: "bold" }}>Allow Run</span>
          <Toggle checked={allowRun} disabled={!editing} onChange={(v) => { setAllowRun(v); setTouchedAllowRun(true); }} />
        </div>
        {!editing && <p style={{ color: "#666", fontSize: "11px", marginTop: "-4px" }}>Determined by Classification when the Environment is created.</p>}
        {displayError && <p style={{ color: "red", fontSize: "12px" }}>{displayError}</p>}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
