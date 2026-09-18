import { useState } from "react";
import type { ApiDetail, ApiMethod } from "./apiEnvironment.types";

const METHODS: ApiMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// UI-API-02: manual Create/Edit. Duplicate detection (same Project + Method +
// Path, REQ-FUN-002) is authoritative on the backend (409 API_ALREADY_EXISTS)
// and surfaced here via the `error` prop instead of a client-side pre-check.
export function CreateEditApiModal({
  editing,
  saving,
  error,
  onSave,
  onCancel,
}: {
  editing: ApiDetail | null;
  saving?: boolean;
  error?: string | null;
  onSave: (input: { apiName: string; httpMethod: string; path: string; description: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.apiName ?? "");
  const [method, setMethod] = useState<ApiMethod>((editing?.httpMethod as ApiMethod) ?? "GET");
  const [path, setPath] = useState(editing?.path ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSave() {
    if (!name.trim()) {
      setLocalError("API Name is required");
      return;
    }
    if (!path.trim() || !path.startsWith("/")) {
      setLocalError("Path is required and must start with /");
      return;
    }
    setLocalError(null);
    onSave({ apiName: name.trim(), httpMethod: method, path: path.trim(), description: description.trim() || null });
  }

  const displayError = localError ?? error ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #000", padding: "20px", width: "420px" }}>
        <h3>{editing ? "Edit API" : "Create API"}</h3>
        <label style={{ display: "block", marginBottom: "10px" }}>
          <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>API Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setLocalError(null); }}
            style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
          />
        </label>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <label style={{ display: "block", width: "120px" }}>
            <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Method *</span>
            <select value={method} onChange={(e) => { setMethod(e.target.value as ApiMethod); setLocalError(null); }} style={{ width: "100%", padding: "8px", border: "1px solid #ccc" }}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "block", flex: 1 }}>
            <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Path *</span>
            <input
              type="text"
              value={path}
              onChange={(e) => { setPath(e.target.value); setLocalError(null); }}
              placeholder="/orders/{id}"
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
            />
          </label>
        </div>
        <label style={{ display: "block", marginBottom: "10px" }}>
          <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box", minHeight: "60px" }}
          />
        </label>
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
