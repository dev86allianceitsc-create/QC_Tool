import type { ApiEnvironmentConfigListItem } from "./apiEnvironment.types";
import type { RunRequestValues } from "./requestInput.types";
import { buildPreviewUrl } from "./runApi.util";
import { Card } from "../../components/ui/Card";
import { JsonHighlight } from "../../components/ui/JsonHighlight";

// REVISION 3C-R01 — Run API / Request Preview: "Method, URL có thay path/
// query, safe headers/body summary; auth type/status masked" — preview only,
// never sent, and never a claim that a Run is "Ready" (REQ-ENV-002/003,
// REQ-SEC-002, AC-UI-3C-06). The Full URL itself is read-only here; it is
// only ever edited from Configuration → Endpoint.
export function RunRequestPreviewPanel({
  httpMethod,
  fullUrl,
  values,
  authTypeLabel,
  credentialStatus,
  runBlockers,
}: {
  httpMethod: string;
  fullUrl: string | null;
  values: RunRequestValues;
  authTypeLabel: string | null;
  credentialStatus: ApiEnvironmentConfigListItem["credentialStatus"] | null;
  runBlockers: string[];
}) {
  const previewUrl = buildPreviewUrl(fullUrl, values.pathValues, values.queryValues);
  const headerEntries = Object.entries(values.headerValues).filter(([, value]) => value.trim() !== "");
  const credentialLabel = credentialStatus === "CONFIGURED" ? "Configured" : credentialStatus === "NOT_CONFIGURED" ? "Not configured" : "Not required";

  return (
    <Card>
      <h3 className="m-0 mb-1 text-base font-semibold text-gray-900">Request Preview</h3>
      <p className="m-0 mb-3 text-xs text-muted">Preview only — this Run is never sent from here. Secrets are never shown.</p>

      {previewUrl ? (
        <p className="m-0 break-all font-mono text-sm text-gray-900">
          <span className="font-semibold">{httpMethod}</span> {previewUrl}
        </p>
      ) : (
        <p className="m-0 text-xs text-warning">No URL configured — set this in Configuration → Endpoint before a Run can be previewed.</p>
      )}

      {headerEntries.length > 0 && (
        <div className="mt-3">
          <h4 className="m-0 mb-1 text-xs font-semibold text-gray-900">Headers</h4>
          <ul className="m-0 list-none p-0 font-mono text-xs text-gray-900">
            {headerEntries.map(([name, value]) => (
              <li key={name}>
                {name}: {value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {values.bodyValue.trim() !== "" && (
        <div className="mt-3">
          <h4 className="m-0 mb-1 text-xs font-semibold text-gray-900">Body</h4>
          <pre className="m-0 whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-900">
            <JsonHighlight value={values.bodyValue} />
          </pre>
        </div>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <h4 className="m-0 mb-1 text-xs font-semibold text-gray-900">Authentication</h4>
        <p className="m-0 text-xs text-gray-900">{authTypeLabel ? `${authTypeLabel} — ${credentialLabel}` : "Not configured"}</p>
      </div>

      {runBlockers.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="m-0 mb-1 text-xs font-semibold text-gray-900">A Run cannot proceed yet:</p>
          <ul className="m-0 list-disc pl-5 text-xs text-muted">
            {runBlockers.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
