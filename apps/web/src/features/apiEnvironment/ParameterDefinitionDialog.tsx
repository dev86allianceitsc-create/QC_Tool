import { useState } from "react";
import type { ParameterDefinition, ParameterLocation } from "./requestInput.types";
import { isDuplicateName, isReservedHeaderName, validateParameterNameFormat } from "./requestInput.util";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";

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
    <Modal title={initialValue ? `Edit ${locationLabel} Parameter` : `Add ${locationLabel} Parameter`} width="380px">
      <div className="mb-3">
        <Input
          label="Name *"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder={location === "QUERY" ? "status" : "X-Client-ID"}
          className="font-mono"
        />
      </div>
      <fieldset className="mb-3 rounded-md border border-border p-2.5">
        <legend className="px-1 text-xs font-semibold text-gray-900">Requirement</legend>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-900">
          <input type="radio" checked={required} onChange={() => setRequired(true)} /> Required
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-900">
          <input type="radio" checked={!required} onChange={() => setRequired(false)} /> Optional
        </label>
      </fieldset>
      <p className="text-xs text-muted">No value is stored here. Value is entered when preparing a Run.</p>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="mt-3 flex gap-2.5">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleSave}>
          {initialValue ? "Save Changes" : "Add Parameter"}
        </Button>
      </div>
    </Modal>
  );
}
