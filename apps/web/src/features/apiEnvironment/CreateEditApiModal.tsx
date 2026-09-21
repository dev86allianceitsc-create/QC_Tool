import { useState } from "react";
import type { ApiDetail, ApiMethod } from "./apiEnvironment.types";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";

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
    <Modal title={editing ? "Edit API" : "Create API"}>
      <div className="mb-3">
        <Input
          label="API Name *"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setLocalError(null);
          }}
        />
      </div>
      <div className="mb-3 flex gap-2.5">
        <div className="w-[120px]">
          <Select
            label="Method *"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as ApiMethod);
              setLocalError(null);
            }}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Input
            label="Path *"
            type="text"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setLocalError(null);
            }}
            placeholder="/orders/{id}"
            className="font-mono"
          />
        </div>
      </div>
      <div className="mb-3">
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
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
