import { useState } from "react";
import { ConfirmDialog } from "../projects/ConfirmDialog";
import type { ParameterDefinition, ParameterLocation } from "./requestInput.types";
import { Button } from "../../components/ui/Button";
import { thClass, tdClass } from "../../components/ui/table";

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
      <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900">{locationLabel} Parameters</h4>
      {parameters.length === 0 ? (
        <p className="text-xs text-muted">No {locationLabel.toLowerCase()} parameters configured.</p>
      ) : (
        <table className="w-full border-collapse rounded-md border border-border">
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Required</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((param, index) => (
              <tr key={`${param.name}-${index}`}>
                <td className={`${tdClass} font-mono`}>{param.name}</td>
                <td className={tdClass}>{param.required ? "Yes" : "Optional"}</td>
                <td className={tdClass}>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(index)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="ml-2 text-error" onClick={() => setPendingRemoveIndex(index)}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Button variant="secondary" size="sm" className="mt-2.5" onClick={onAdd}>
        + Add {locationLabel}
      </Button>

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
