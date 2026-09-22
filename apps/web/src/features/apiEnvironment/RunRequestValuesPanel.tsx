import { JsonPayloadEditor } from "./JsonPayloadEditor";
import { RunParameterField } from "./RunParameterField";
import type { RequestInputDefinition, RunRequestValues } from "./requestInput.types";
import { Card } from "../../components/ui/Card";

// REVISION 3C-R01 — Run API / Request Values: manual, per-Run Path/Query/
// Header/Body value entry built from the persisted Request Input Definition
// (REQ-INP-004, §20 boundary). Fully controlled — `values` lives in
// RunApiArea so Request Preview can read the same draft; this panel never
// holds its own copy and never writes back into the Definition.
export function RunRequestValuesPanel({
  definition,
  values,
  onChange,
}: {
  definition: RequestInputDefinition;
  values: RunRequestValues;
  onChange: (values: RunRequestValues) => void;
}) {
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

  function setPathValue(name: string, value: string) {
    onChange({ ...values, pathValues: { ...values.pathValues, [name]: value } });
  }
  function setQueryValue(name: string, value: string) {
    onChange({ ...values, queryValues: { ...values.queryValues, [name]: value } });
  }
  function setHeaderValue(name: string, value: string) {
    onChange({ ...values, headerValues: { ...values.headerValues, [name]: value } });
  }

  return (
    <Card>
      <h3 className="m-0 mb-3 text-base font-semibold text-gray-900">Request Values</h3>
      <div className="flex flex-col gap-4">
        {!hasConfigurableInputs && <p className="m-0 text-sm text-muted">No manual request values required.</p>}

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
            onChange={(v) => onChange({ ...values, bodyValue: v })}
            autoFocus={firstFocusTarget === "body"}
          />
        )}
      </div>
    </Card>
  );
}
