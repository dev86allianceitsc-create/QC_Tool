import { useEffect, useState } from "react";
import type { AuthenticationConfiguration, PutAuthenticationConfigurationPayload, PutCredentialPayload } from "./authentication.types";
import { AuthenticationTab } from "./AuthenticationTab";
import type { ApiDetail, ApiEnvironmentConfigListItem, EnvironmentListItem } from "./apiEnvironment.types";
import { ClassificationBadge } from "./ClassificationBadge";
import { RequestInputTab } from "./RequestInputTab";
import type { PutRequestInputPayload, RequestInputDefinition } from "./requestInput.types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StepSidebar, type StepReadiness, type StepSidebarItem } from "../../components/ui/StepSidebar";
import { StatusBadge } from "../projects/StatusBadge";

type ConfigurationStep = "endpoint" | "requestInput" | "authentication";

const CONFIG_STEP_ORDER: ConfigurationStep[] = ["endpoint", "requestInput", "authentication"];

// REVISION 3C-R01 — Configuration area: Endpoint (incl. the per-Environment
// Full URL, moved here from the old Review & Run tab per §1 of the
// revision), Request Input, and Authentication. Reuses the same
// RequestInputTab/AuthenticationTab and hooks as before — only the shell
// around them changed. Full URL editing lives here now; Run API only ever
// shows it read-only.
export function ConfigurationArea({
  currentApi,
  environments,
  selectedEnvironment,
  environmentInactive,
  config,
  configsLoading,
  readOnlyConfig,
  urlDraft,
  onUrlDraftChange,
  savingUrl,
  urlError,
  urlSaved,
  onSaveUrl,
  requestInput,
  projectInactive,
  requestInputReadiness,
  onRequestInputDirtyChange,
  apiId,
  authentication,
  selectedEnvironmentId,
  isAdmin,
  authenticationReadOnlyReason,
  authenticationReadiness,
  onAuthenticationDirtyChange,
  guardedNavigate,
}: {
  currentApi: ApiDetail;
  environments: EnvironmentListItem[];
  selectedEnvironment: EnvironmentListItem | null;
  environmentInactive: boolean;
  config: ApiEnvironmentConfigListItem | null;
  configsLoading: boolean;
  readOnlyConfig: boolean;
  urlDraft: Record<string, string>;
  onUrlDraftChange: (environmentId: string, value: string) => void;
  savingUrl: boolean;
  urlError: string | null;
  urlSaved: boolean;
  onSaveUrl: () => void;
  requestInput: {
    definition: RequestInputDefinition | null;
    loading: boolean;
    error: string | null;
    saving: boolean;
    refetch: () => Promise<void>;
    save: (payload: PutRequestInputPayload) => Promise<RequestInputDefinition>;
  };
  projectInactive: boolean;
  requestInputReadiness: StepReadiness | undefined;
  onRequestInputDirtyChange: (dirty: boolean) => void;
  apiId: string;
  authentication: {
    config: AuthenticationConfiguration | null;
    loading: boolean;
    error: string | null;
    saving: boolean;
    refetch: () => Promise<void>;
    saveConfiguration: (payload: PutAuthenticationConfigurationPayload) => Promise<AuthenticationConfiguration>;
    saveCredential: (payload: PutCredentialPayload) => Promise<AuthenticationConfiguration>;
    removeCredential: () => Promise<AuthenticationConfiguration>;
  };
  selectedEnvironmentId: string | null;
  isAdmin: boolean;
  authenticationReadOnlyReason: string | undefined;
  authenticationReadiness: StepReadiness;
  onAuthenticationDirtyChange: (dirty: boolean) => void;
  guardedNavigate: (action: () => void) => void;
}) {
  const [step, setStep] = useState<ConfigurationStep>("endpoint");
  const [showFinishedMessage, setShowFinishedMessage] = useState(false);

  useEffect(() => {
    setShowFinishedMessage(false);
  }, [step]);

  const steps: StepSidebarItem[] = [
    { key: "endpoint", label: "Endpoint", description: "Method, path, description, and Full URL." },
    { key: "requestInput", label: "Request Input", description: "Path, Query, Header parameters and Body.", readiness: requestInputReadiness },
    { key: "authentication", label: "Authentication", description: "Credential configuration.", readiness: authenticationReadiness },
  ];

  const currentIndex = CONFIG_STEP_ORDER.indexOf(step);
  const isLastStep = currentIndex >= CONFIG_STEP_ORDER.length - 1;

  return (
    <div className="flex flex-col gap-6 p-6 md:flex-row">
      <StepSidebar
        ariaLabel="Configuration steps"
        steps={steps}
        activeKey={step}
        onSelect={(key) => guardedNavigate(() => setStep(key as ConfigurationStep))}
      />

      <div className="min-w-0 flex-1">
        {step === "endpoint" && (
          <div className="flex flex-col gap-4">
            <Card>
              <h3 className="m-0 text-base font-semibold text-gray-900">{currentApi.apiName}</h3>
              <p className="mt-2.5 font-mono text-sm text-gray-900">
                <span className="font-semibold">{currentApi.httpMethod}</span> {currentApi.path}
              </p>
              <p className="mt-2.5 text-sm text-muted">{currentApi.description || "No description provided."}</p>
            </Card>

            {selectedEnvironment && !configsLoading && (
              <Card>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h4 className="m-0 text-sm font-semibold text-gray-900">{selectedEnvironment.environmentName}</h4>
                  <ClassificationBadge classification={selectedEnvironment.classification} />
                  <StatusBadge status={selectedEnvironment.environmentStatus} />
                </div>
                <p className="mt-1.5 text-xs text-muted">Allow Run: {selectedEnvironment.allowRun ? "ON" : "OFF"} (managed from the Environments list)</p>
                {environmentInactive && <p className="text-xs text-muted">This Environment is INACTIVE — URL and Credential are view-only.</p>}

                <span className="mt-3 mb-1.5 block text-xs font-semibold text-gray-900">Full URL</span>
                <input
                  type="text"
                  value={urlDraft[selectedEnvironment.environmentId] ?? config?.fullUrl ?? ""}
                  onChange={(e) => onUrlDraftChange(selectedEnvironment.environmentId, e.target.value)}
                  disabled={readOnlyConfig}
                  placeholder="https://example.com/api/..."
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-mono text-gray-900 disabled:bg-gray-50 disabled:text-muted"
                />
                {!config?.fullUrl && <p className="mt-1.5 text-xs text-warning">No URL configured — Run is blocked for this API in this Environment.</p>}
                {urlError && <p className="mt-1.5 text-xs text-error">{urlError}</p>}
                {!urlError && urlSaved && <p className="mt-1.5 text-xs text-success">Full URL saved.</p>}
                {!readOnlyConfig && (
                  <Button variant="secondary" size="sm" className="mt-2.5" onClick={onSaveUrl} disabled={savingUrl}>
                    {savingUrl ? "Saving..." : "Save URL"}
                  </Button>
                )}
              </Card>
            )}
          </div>
        )}

        {step === "requestInput" && requestInput.loading && (
          <Card>
            <p className="m-0">Loading Request Input...</p>
          </Card>
        )}

        {step === "requestInput" && !requestInput.loading && requestInput.error && (
          <Card>
            <p className="text-error">{requestInput.error}</p>
            <Button variant="secondary" onClick={() => void requestInput.refetch()}>
              Retry
            </Button>
          </Card>
        )}

        {step === "requestInput" && !requestInput.loading && !requestInput.error && requestInput.definition && (
          <RequestInputTab
            key={apiId}
            definition={requestInput.definition}
            readOnly={projectInactive}
            saving={requestInput.saving}
            onSave={requestInput.save}
            onDirtyChange={onRequestInputDirtyChange}
          />
        )}

        {step === "authentication" && environments.length === 0 && (
          <Card>
            <p className="m-0 text-sm text-muted">No Environments exist for this API yet. Add an Environment to configure Authentication.</p>
          </Card>
        )}

        {step === "authentication" && environments.length > 0 && authentication.loading && (
          <Card>
            <p className="m-0">Loading Authentication...</p>
          </Card>
        )}

        {step === "authentication" && environments.length > 0 && !authentication.loading && authentication.error && (
          <Card>
            <p className="text-error">{authentication.error}</p>
            <Button variant="secondary" onClick={() => void authentication.refetch()}>
              Retry
            </Button>
          </Card>
        )}

        {step === "authentication" && environments.length > 0 && !authentication.loading && !authentication.error && authentication.config && (
          <AuthenticationTab
            key={`${apiId}:${selectedEnvironmentId}`}
            config={authentication.config}
            environmentName={selectedEnvironment?.environmentName}
            readOnly={!isAdmin || readOnlyConfig}
            readOnlyReason={authenticationReadOnlyReason}
            saving={authentication.saving}
            onSaveConfiguration={authentication.saveConfiguration}
            onSaveCredential={authentication.saveCredential}
            onRemoveCredential={authentication.removeCredential}
            onDirtyChange={onAuthenticationDirtyChange}
          />
        )}

        <div className="mt-6 border-t border-border pt-4">
          {isLastStep && showFinishedMessage && <p className="m-0 mb-3 text-sm text-success">Configuration completed.</p>}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => guardedNavigate(() => setStep(CONFIG_STEP_ORDER[currentIndex - 1]))} disabled={currentIndex <= 0}>
              ← Back
            </Button>
            {isLastStep ? (
              <Button variant="primary" onClick={() => setShowFinishedMessage(true)}>
                Finish
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => guardedNavigate(() => setStep(CONFIG_STEP_ORDER[currentIndex + 1]))}>
                Next →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
