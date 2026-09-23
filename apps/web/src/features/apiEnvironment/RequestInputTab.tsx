import { useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { ParameterDefinitionDialog } from "./ParameterDefinitionDialog";
import { ParameterDefinitionTable } from "./ParameterDefinitionTable";
import { PathParameterTable } from "./PathParameterTable";
import { RequestBodyDefinitionCard } from "./RequestBodyDefinitionCard";
import type { ParameterDefinition, ParameterLocation, PutRequestInputPayload, RequestInputDefinition } from "./requestInput.types";
import { toPutPayload } from "./requestInput.util";
import { Button } from "../../components/ui/Button";

type DialogState = { location: ParameterLocation; index: number | null } | null;

// UI-INP-01: API Detail / Request Input tab. Manages the Request Input
// Definition for this API (REQ-INP-001/003) — this screen never collects a
// Run Value (BR-INP-003-10/20). "Save" commits the draft via the real PUT
// endpoint (3B-12); on success the draft is re-baselined to the returned
// canonical Definition, and on failure the draft is preserved untouched so
// the user can correct and retry.
export function RequestInputTab({
  definition,
  readOnly,
  saving,
  onSave,
  onDirtyChange,
}: {
  definition: RequestInputDefinition;
  readOnly?: boolean;
  saving?: boolean;
  onSave: (payload: PutRequestInputPayload) => Promise<RequestInputDefinition>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<RequestInputDefinition>(definition);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = draft !== definition;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function existingNames(location: ParameterLocation, excludeIndex: number | null): string[] {
    const list = location === "QUERY" ? draft.queryParameters : draft.headerParameters;
    return list.filter((_, i) => i !== excludeIndex).map((p) => p.name);
  }

  function handleDialogSave(value: ParameterDefinition) {
    if (!dialog) return;
    const key = dialog.location === "QUERY" ? "queryParameters" : "headerParameters";
    setDraft((prev) => {
      const list = [...prev[key]];
      if (dialog.index === null) {
        list.push(value);
      } else {
        list[dialog.index] = value;
      }
      return { ...prev, [key]: list };
    });
    setDialog(null);
  }

  function handleRemove(location: ParameterLocation, index: number) {
    const key = location === "QUERY" ? "queryParameters" : "headerParameters";
    setDraft((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }

  function handleBodyToggle(enabled: boolean) {
    setDraft((prev) => ({ ...prev, requestBody: enabled ? { bodyType: "JSON" } : null }));
  }

  async function handleSave() {
    setSaveError(null);
    try {
      const saved = await onSave(toPutPayload(draft));
      setDraft(saved);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save changes.");
    }
  }

  function handleCancel() {
    setDraft(definition);
    setSaveError(null);
    setJustSaved(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <PathParameterTable pathParameters={draft.pathParameters} />

      <ParameterDefinitionTable
        location="QUERY"
        parameters={draft.queryParameters}
        onAdd={() => setDialog({ location: "QUERY", index: null })}
        onEdit={(index) => setDialog({ location: "QUERY", index })}
        onRemove={(index) => handleRemove("QUERY", index)}
      />

      <ParameterDefinitionTable
        location="HEADER"
        parameters={draft.headerParameters}
        onAdd={() => setDialog({ location: "HEADER", index: null })}
        onEdit={(index) => setDialog({ location: "HEADER", index })}
        onRemove={(index) => handleRemove("HEADER", index)}
      />

      <RequestBodyDefinitionCard enabled={draft.requestBody !== null} onToggle={handleBodyToggle} />

      {!readOnly && (
        <div className="flex flex-col gap-2.5">
          {saveError && <p className="m-0 text-sm text-error">{saveError}</p>}
          {!saveError && !dirty && justSaved && <p className="m-0 text-sm text-success">Saved.</p>}
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={handleCancel} disabled={!dirty}>
              Cancel changes
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={!dirty || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {dialog && (
        <ParameterDefinitionDialog
          location={dialog.location}
          initialValue={dialog.index === null ? undefined : (dialog.location === "QUERY" ? draft.queryParameters : draft.headerParameters)[dialog.index]}
          existingNames={existingNames(dialog.location, dialog.index)}
          onSave={handleDialogSave}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
