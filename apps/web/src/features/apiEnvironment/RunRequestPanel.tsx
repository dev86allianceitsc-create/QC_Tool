import { useEffect, useState } from "react";
import type { EnvironmentListItem } from "./apiEnvironment.types";
import { JsonPayloadEditor } from "./JsonPayloadEditor";
import { RunParameterField } from "./RunParameterField";
import type { RequestInputDefinition, RunRequestValues } from "./requestInput.types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

// UI-INP-09/REQ-INP-004: Run Preparation. Manual, per-Run Parameter and
// Payload value entry only (§20 boundary — Run Values are never merged into
// the Request Input Definition and are never persisted). Actual Run
// execution is explicitly out of scope for 3B-11: the Run button stays
// disabled and no network request is made from this panel.
// `variant="dialog"` (default) keeps the original overlay-drawer behavior
// unchanged. `variant="inline"` (Review & Run) renders the same fields
// embedded directly in the page flow — no overlay/backdrop/role="dialog"/
// Escape-to-close/Close button, since there is nothing to "close" when the
// panel is always visible.
export function RunRequestPanel({
  definition,
  environments,
  selectedEnvironmentId,
  onSelectEnvironment,
  onClose,
  variant = "dialog",
}: {
  definition: RequestInputDefinition;
  environments: EnvironmentListItem[];
  selectedEnvironmentId: string | null;
  onSelectEnvironment: (environmentId: string) => void;
  onClose?: () => void;
  variant?: "dialog" | "inline";
}) {
  const [values, setValues] = useState<RunRequestValues>({
    pathValues: {},
    queryValues: {},
    headerValues: {},
    bodyValue: "",
  });
  // REQ-VER-001, simplified: Run persistence doesn't exist yet (no Run model),
  // so there is no Run record to attach Version metadata to. These are
  // transient, UI-only Run Preparation fields — same as Path/Query/Header/Body
  // above — never sent anywhere. Blank displays as "UNKNOWN" via placeholder.
  const [apiVersion, setApiVersion] = useState("");
  const [dbVersion, setDbVersion] = useState("");
  const selectedEnvironment = environments.find((e) => e.environmentId === selectedEnvironmentId) ?? null;
  const hasConfigurableInputs =
    definition.pathParameters.length > 0 ||
    definition.queryParameters.length > 0 ||
    definition.headerParameters.length > 0 ||
    definition.requestBody !== null;

  const firstFocusTarget: "path" | "query" | "header" | "body" | null = definition.pathParameters.length > 0
    ? "path"
    : definition.queryParameters.length > 0
      ? "query"
      : definition.headerParameters.length > 0
        ? "header"
        : definition.requestBody
          ? "body"
          : null;

  useEffect(() => {
    if (variant !== "dialog") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, variant]);

  function setPathValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, pathValues: { ...prev.pathValues, [name]: value } }));
  }
  function setQueryValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, queryValues: { ...prev.queryValues, [name]: value } }));
  }
  function setHeaderValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, headerValues: { ...prev.headerValues, [name]: value } }));
  }

  const content = (
    <div className="flex flex-col gap-4">
      {variant === "dialog" ? (
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold text-gray-900">Run Preparation</h3>
          <button onClick={onClose} aria-label="Close Run Preparation" className="cursor-pointer border-none bg-transparent text-base text-gray-700">
            ✕
          </button>
        </div>
      ) : (
        <h3 className="m-0 text-base font-semibold text-gray-900">Run Preparation</h3>
      )}

      {variant === "dialog" ? (
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-gray-900">Environment</span>
          <select
            value={selectedEnvironmentId ?? ""}
            onChange={(e) => onSelectEnvironment(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm text-gray-900"
          >
            {environments.map((env) => (
              <option key={env.environmentId} value={env.environmentId}>
                {env.environmentName}
              </option>
            ))}
          </select>
          {selectedEnvironment && <p className="mt-1.5 text-xs text-muted">Allow Run: {selectedEnvironment.allowRun ? "ON" : "OFF"}</p>}
        </div>
      ) : (
        // Inline variant is embedded directly under Execution Target and the
        // API header selector, which already own Environment selection — a
        // 3rd interactive selector here would just duplicate the same state.
        // Show the target as read-only context instead.
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-gray-900">Preparing values for</span>
          <p className="m-0 text-sm text-gray-900">{selectedEnvironment?.environmentName ?? "No Environment selected"}</p>
        </div>
      )}

      <div>
        <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900">Version</h4>
        <RunParameterField label="API Version" required={false} value={apiVersion} onChange={setApiVersion} placeholder="UNKNOWN" />
        <RunParameterField label="DB Version" required={false} value={dbVersion} onChange={setDbVersion} placeholder="UNKNOWN" />
      </div>

      {!hasConfigurableInputs && <p className="text-sm text-muted">No manual request values required.</p>}

      {definition.pathParameters.length > 0 && (
        <div>
          <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900">Path</h4>
          {definition.pathParameters.map((param, i) => (
            <RunParameterField
              key={param.name}
              label={param.name}
              required={param.required}
              value={values.pathValues[param.name] ?? ""}
              onChange={(v) => setPathValue(param.name, v)}
              autoFocus={firstFocusTarget === "path" && i === 0}
            />
          ))}
        </div>
      )}

      {definition.queryParameters.length > 0 && (
        <div>
          <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900">Query</h4>
          {definition.queryParameters.map((param, i) => (
            <RunParameterField
              key={param.name}
              label={param.name}
              required={param.required}
              value={values.queryValues[param.name] ?? ""}
              onChange={(v) => setQueryValue(param.name, v)}
              autoFocus={firstFocusTarget === "query" && i === 0}
            />
          ))}
        </div>
      )}

      {definition.headerParameters.length > 0 && (
        <div>
          <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900">Header</h4>
          {definition.headerParameters.map((param, i) => (
            <RunParameterField
              key={param.name}
              label={param.name}
              required={param.required}
              value={values.headerValues[param.name] ?? ""}
              onChange={(v) => setHeaderValue(param.name, v)}
              autoFocus={firstFocusTarget === "header" && i === 0}
            />
          ))}
        </div>
      )}

      {definition.requestBody && (
        <JsonPayloadEditor
          value={values.bodyValue}
          onChange={(v) => setValues((prev) => ({ ...prev, bodyValue: v }))}
          autoFocus={firstFocusTarget === "body"}
        />
      )}

      <div className="mt-auto flex gap-2.5">
        {variant === "dialog" && (
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Close
          </Button>
        )}
        <Button
          variant="secondary"
          className={variant === "dialog" ? "flex-1" : "w-full"}
          disabled
          title="Run execution is not part of this release. This panel only prepares manual Run values."
        >
          Run
        </Button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return <Card>{content}</Card>;
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Run Preparation" className="fixed inset-0 z-[100]">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-y-0 right-0 flex w-[420px] max-w-full flex-col gap-4 overflow-y-auto border-l border-border-strong bg-white p-5">
        {content}
      </div>
    </div>
  );
}
