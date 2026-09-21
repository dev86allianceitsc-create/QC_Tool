import type { PathParameterDefinition } from "./requestInput.types";
import { thClass, tdClass } from "../../components/ui/table";

// UI-INP-02: Path Parameters are auto-detected from {placeholder} tokens in
// the API Path. Read-only — no rename, no Add/Delete, always Required
// (REQ-INP-003 BR-INP-003-01/02).
export function PathParameterTable({ pathParameters }: { pathParameters: PathParameterDefinition[] }) {
  return (
    <div>
      <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900">Path Parameters</h4>
      {pathParameters.length === 0 ? (
        <p className="text-xs text-muted">No path parameters detected.</p>
      ) : (
        <table className="w-full border-collapse rounded-md border border-border">
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Required</th>
              <th className={thClass}>Source</th>
            </tr>
          </thead>
          <tbody>
            {pathParameters.map((param) => (
              <tr key={param.name}>
                <td className={`${tdClass} font-mono`}>{param.name}</td>
                <td className={tdClass}>Yes</td>
                <td className={tdClass}>Auto-detected</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
