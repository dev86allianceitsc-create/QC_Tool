import { useEffect, useState } from "react";
import type { EnvironmentListItem } from "./apiEnvironment.types";
import { JsonPayloadEditor } from "./JsonPayloadEditor";
import { RunParameterField } from "./RunParameterField";
import type { RequestInputDefinition, RunRequestValues } from "./requestInput.types";

// UI-INP-09/REQ-INP-004: Run Preparation drawer. Manual, per-Run Parameter
// and Payload value entry only (§20 boundary — Run Values are never merged
// into the Request Input Definition and are never persisted). Actual Run
// execution is explicitly out of scope for 3B-11: the Run button stays
// disabled and no network request is made from this panel.
export function RunRequestPanel({
  definition,
  environments,
  selectedEnvironmentId,
  onSelectEnvironment,
  onClose,
}: {
  definition: RequestInputDefinition;
  environments: EnvironmentListItem[];
  selectedEnvironmentId: string | null;
  onSelectEnvironment: (environmentId: string) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<RunRequestValues>({
    pathValues: {},
    queryValues: {},
    headerValues: {},
    bodyValue: "",
  });
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
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function setPathValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, pathValues: { ...prev.pathValues, [name]: value } }));
  }
  function setQueryValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, queryValues: { ...prev.queryValues, [name]: value } }));
  }
  function setHeaderValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, headerValues: { ...prev.headerValues, [name]: value } }));
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Run Preparation" style={{ position: "fixed", inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "420px",
          maxWidth: "100%",
          backgroundColor: "#fff",
          borderLeft: "1px solid #000",
          padding: "20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Run Preparation</h3>
          <button onClick={onClose} aria-label="Close Run Preparation" style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px" }}>
            ✕
          </button>
        </div>

        <div>
          <span style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "13px" }}>Environment</span>
          <select
            value={selectedEnvironmentId ?? ""}
            onChange={(e) => onSelectEnvironment(e.target.value)}
            style={{ width: "100%", padding: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
          >
            {environments.map((env) => (
              <option key={env.environmentId} value={env.environmentId}>
                {env.environmentName}
              </option>
            ))}
          </select>
          {selectedEnvironment && (
            <p style={{ color: "#666", fontSize: "12px", marginTop: "5px" }}>Allow Run: {selectedEnvironment.allowRun ? "ON" : "OFF"}</p>
          )}
        </div>

        {!hasConfigurableInputs && <p style={{ color: "#666", fontSize: "13px" }}>No manual request values required.</p>}

        {definition.pathParameters.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 8px 0" }}>Path</h4>
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
            <h4 style={{ margin: "0 0 8px 0" }}>Query</h4>
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
            <h4 style={{ margin: "0 0 8px 0" }}>Header</h4>
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

        <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            Close
          </button>
          <button
            disabled
            title="Run execution is not part of this release. This panel only prepares manual Run values."
            style={{ flex: 1, padding: "10px", border: "1px solid #000", backgroundColor: "#f3f3f3", color: "#999", cursor: "not-allowed" }}
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
