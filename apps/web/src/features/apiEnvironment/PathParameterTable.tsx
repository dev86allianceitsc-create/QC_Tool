import type { CSSProperties } from "react";
import type { PathParameterDefinition } from "./requestInput.types";

// UI-INP-02: Path Parameters are auto-detected from {placeholder} tokens in
// the API Path. Read-only — no rename, no Add/Delete, always Required
// (REQ-INP-003 BR-INP-003-01/02).
export function PathParameterTable({ pathParameters }: { pathParameters: PathParameterDefinition[] }) {
  return (
    <div>
      <h4 style={{ margin: "0 0 8px 0" }}>Path Parameters</h4>
      {pathParameters.length === 0 ? (
        <p style={{ color: "#666", fontSize: "13px" }}>No path parameters detected.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Name</th>
              <th style={headerCellStyle}>Required</th>
              <th style={headerCellStyle}>Source</th>
            </tr>
          </thead>
          <tbody>
            {pathParameters.map((param) => (
              <tr key={param.name}>
                <td style={cellStyle}>{param.name}</td>
                <td style={cellStyle}>Yes</td>
                <td style={cellStyle}>Auto-detected</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const headerCellStyle: CSSProperties = { textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc", fontSize: "13px" };
const cellStyle: CSSProperties = { padding: "8px", borderBottom: "1px solid #eee", fontSize: "13px" };
