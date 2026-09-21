import { useState } from "react";
import type { EnvironmentClassification, EnvironmentListItem } from "./apiEnvironment.types";
import { Toggle } from "./Toggle";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";

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
    <Modal title={editing ? "Edit Environment" : "Create Environment"}>
      <div className="mb-3">
        <Input
          label="Environment Name *"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setLocalError(null);
          }}
          placeholder="e.g. Development, QA, Production"
        />
      </div>
      <div className="mb-3">
        <Select label="Classification *" value={classification} onChange={(e) => handleClassificationChange(e.target.value as EnvironmentClassification)}>
          <option value="NON_PRODUCTION">Non-Production</option>
          <option value="PRODUCTION">Production</option>
        </Select>
        <span className="mt-1 block text-[11px] text-muted">
          Independent of the Environment Name — naming an Environment "Production" does not make it Production.
        </span>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-900">Allow Run</span>
        <Toggle
          checked={allowRun}
          disabled={!editing}
          onChange={(v) => {
            setAllowRun(v);
            setTouchedAllowRun(true);
          }}
        />
      </div>
      {!editing && <p className="-mt-1 text-[11px] text-muted">Determined by Classification when the Environment is created.</p>}
      {displayError && <p className="text-xs text-error">{displayError}</p>}
      <div className="flex gap-2.5">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
