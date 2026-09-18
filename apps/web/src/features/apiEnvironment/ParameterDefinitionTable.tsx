import { useState } from "react";
import type { CSSProperties } from "react";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import type { ParameterDefinition, ParameterLocation } from "./requestInput.types";

// UI-INP-03/04: reusable Add/Edit/Remove table for Query and Header
// Definitions (REQ-INP-003 BR-INP-003-07/08/12/13). No default/Run Value
// column — Run Values belong to Run Preparation, not the Definition.
export function ParameterDefinitionTable({
  location,
  parameters,
  onAdd,
  onEdit,
  onRemove,
}: {
  location: ParameterLocation;
  parameters: ParameterDefinition[];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const locationLabel = location === "QUERY" ? "Query" : "Header";

  return (
    <div>
      <h4 style={{ margin: "0 0 8px 0" }}>{locationLabel} Parameters</h4>
      {parameters.length === 0 ? (
        <p style={{ color: "#666", fontSize: "13px" }}>No {locationLabel.toLowerCase()} parameters configured.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Name</th>
              <th style={headerCellStyle}>Required</th>
              <th style={headerCellStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((param, index) => (
              <tr key={`${param.name}-${index}`}>
                <td style={cellStyle}>{param.name}</td>
                <td style={cellStyle}>{param.required ? "Yes" : "Optional"}</td>
                <td style={cellStyle}>
                  <button onClick={() => onEdit(index)} style={actionButtonStyle}>
                    Edit
                  </button>
                  <button onClick={() => setPendingRemoveIndex(index)} style={{ ...actionButtonStyle, marginLeft: "8px", color: "red" }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button onClick={onAdd} style={{ marginTop: "10px", padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
        + Add {locationLabel}
      </button>

      {pendingRemoveIndex !== null && (
        <ConfirmDialog
          title={`Remove ${locationLabel} Parameter`}
          message={`Remove '${parameters[pendingRemoveIndex]?.name}' from this API's Request Input Definition? This does not affect any Run history.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => {
            onRemove(pendingRemoveIndex);
            setPendingRemoveIndex(null);
          }}
          onCancel={() => setPendingRemoveIndex(null)}
        />
      )}
    </div>
  );
}

const headerCellStyle: CSSProperties = { textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc", fontSize: "13px" };
const cellStyle: CSSProperties = { padding: "8px", borderBottom: "1px solid #eee", fontSize: "13px" };
const actionButtonStyle: CSSProperties = { border: "none", background: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: "13px" };
