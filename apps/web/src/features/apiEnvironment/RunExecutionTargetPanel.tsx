import type { ApiEnvironmentConfigListItem, EnvironmentListItem } from "./apiEnvironment.types";
import { ClassificationBadge } from "./ClassificationBadge";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../projects/StatusBadge";

// REVISION 3C-R01 — Run API / Execution Target: "Selected Environment,
// Method, resolved Full URL/status và run blockers — Read-only context từ
// 3A/3C". Full URL is only ever edited from Configuration / Endpoint now
// (REVISION 3C-R01 §1); this panel shows the already-configured value and
// why a Run cannot proceed, but never an editable field or an example URL
// that looks runnable.
export function RunExecutionTargetPanel({
  environments,
  selectedEnvironmentId,
  onSelectEnvironment,
  config,
  configsLoading,
  authTypeLabel,
  credentialStatus,
  runBlockers,
}: {
  environments: EnvironmentListItem[];
  selectedEnvironmentId: string | null;
  onSelectEnvironment: (environmentId: string) => void;
  config: ApiEnvironmentConfigListItem | null;
  configsLoading: boolean;
  authTypeLabel: string | null;
  credentialStatus: ApiEnvironmentConfigListItem["credentialStatus"] | null;
  runBlockers: string[];
}) {
  const selectedEnvironment = environments.find((e) => e.environmentId === selectedEnvironmentId) ?? null;

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="w-full shrink-0 lg:w-48">
        <h4 className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Execution Target</h4>
        <p className="mb-2 text-xs text-muted">
          {environments.length} Environment{environments.length === 1 ? "" : "s"} in this Project
        </p>
        <ol className="flex flex-col gap-1">
          {environments.map((env) => (
            <li key={env.environmentId}>
              <button
                onClick={() => onSelectEnvironment(env.environmentId)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  env.environmentId === selectedEnvironmentId ? "bg-primary-light font-semibold text-gray-900" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="block">{env.environmentName}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${env.environmentStatus === "ACTIVE" ? "bg-success" : "bg-gray-300"}`} />
                  {env.environmentStatus === "ACTIVE" ? "Active" : "Inactive"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="min-w-0 flex-1">
        {selectedEnvironment && !configsLoading && (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <h4 className="m-0 text-sm font-semibold text-gray-900">{selectedEnvironment.environmentName}</h4>
              <ClassificationBadge classification={selectedEnvironment.classification} />
              <StatusBadge status={selectedEnvironment.environmentStatus} />
            </div>
            <p className="mt-1.5 text-xs text-muted">Allow Run: {selectedEnvironment.allowRun ? "ON" : "OFF"} (managed from the Environments list)</p>
            {selectedEnvironment.environmentStatus === "INACTIVE" && (
              <p className="text-xs text-muted">This Environment is INACTIVE — URL and Credential are view-only.</p>
            )}

            <Card className="mt-4">
              <span className="mb-1.5 block text-xs font-semibold text-gray-900">Full URL</span>
              {config?.fullUrl ? (
                <p className="m-0 break-all font-mono text-sm text-gray-900">{config.fullUrl}</p>
              ) : (
                <p className="m-0 text-xs text-warning">No URL configured — set this in Configuration → Endpoint. Run is blocked until it is.</p>
              )}
              <p className="mt-1.5 mb-0 text-xs text-muted">Edited from Configuration → Endpoint, not here.</p>
            </Card>

            <Card className="mt-4">
              <h4 className="m-0 mb-2.5 text-sm font-semibold text-gray-900">Configuration Readiness — {selectedEnvironment.environmentName}</h4>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Environment Status</span>
                  <Badge tone={selectedEnvironment.environmentStatus === "ACTIVE" ? "success" : "neutral"} label={selectedEnvironment.environmentStatus === "ACTIVE" ? "Active" : "Inactive"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Allow Run</span>
                  <Badge tone={selectedEnvironment.allowRun ? "success" : "neutral"} label={selectedEnvironment.allowRun ? "ON" : "OFF"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">URL</span>
                  <Badge tone={config?.urlStatus === "CONFIGURED" ? "success" : "warning"} label={config?.urlStatus === "CONFIGURED" ? "Configured" : "Not Configured"} />
                </div>
                {/* UI-RUN-01: which Authentication Type would be used and
                    whether its credential is in place — safe metadata only,
                    never the Secret Credential Value (REQ-SEC-002). */}
                {authTypeLabel && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Authentication Type</span>
                    <span className="text-gray-900">{authTypeLabel}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Credential</span>
                  <Badge
                    tone={credentialStatus === "CONFIGURED" ? "success" : credentialStatus === "NOT_CONFIGURED" ? "warning" : "neutral"}
                    label={credentialStatus === "CONFIGURED" ? "Configured" : credentialStatus === "NOT_CONFIGURED" ? "Not Configured" : "Not Required"}
                  />
                </div>
              </div>

              {/* AC-UI-3C-06: when a Run could not proceed, say why here
                  rather than leaving a disabled Run button unexplained. */}
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
          </>
        )}
      </div>
    </div>
  );
}
