import { useState } from "react"

import type { ApiDetail, EnvironmentListItem } from "./apiEnvironment.types"

import { ClassificationBadge } from "./ClassificationBadge"

import { RequestInputTab } from "./RequestInputTab"

import type {
  PutRequestInputPayload,
  RequestInputDefinition,
} from "./requestInput.types"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

import {
  StepSidebar,
  type StepReadiness,
  type StepSidebarItem,
} from "../../components/ui/StepSidebar"

import { StatusBadge } from "../projects/StatusBadge"

type ConfigurationStep = "endpoint" | "requestInput"

const CONFIG_STEP_ORDER: ConfigurationStep[] = ["endpoint", "requestInput"]

// REVISION 3C-R02 — Configuration area: Endpoint and Request Input only.
// Authentication moved to Project Settings, managed per-Environment (shared
// by every API in it), so it no longer has a step here. The per-Environment
// Full URL has no manual-override entry point anywhere in the UI: the
// system always derives it from the Environment's domain plus the API's
// path (see effectiveUrl), and Run API shows that resolved value read-only.

export function ConfigurationArea({
  currentApi,

  environments,

  selectedEnvironment,

  environmentInactive,

  readOnlyConfig,

  requestInput,

  projectInactive,

  requestInputReadiness,

  onRequestInputDirtyChange,

  apiId,

  guardedNavigate,

  onFinish,
}: {
  currentApi: ApiDetail

  environments: EnvironmentListItem[]

  selectedEnvironment: EnvironmentListItem | null

  environmentInactive: boolean

  readOnlyConfig: boolean

  requestInput: {
    definition: RequestInputDefinition | null

    loading: boolean

    error: string | null

    saving: boolean

    refetch: () => Promise<void>

    save: (payload: PutRequestInputPayload) => Promise<RequestInputDefinition>
  }

  projectInactive: boolean

  requestInputReadiness: StepReadiness | undefined

  onRequestInputDirtyChange: (dirty: boolean) => void

  apiId: string

  guardedNavigate: (action: () => void) => void

  onFinish: () => void
}) {
  const [step, setStep] = useState<ConfigurationStep>("endpoint")

  const steps: StepSidebarItem[] = [
    {
      key: "endpoint",
      label: "Endpoint",
      description: "Method, path, and description.",
    },

    {
      key: "requestInput",
      label: "Request Input",
      description: "Path, Query, Header parameters and Body.",
      readiness: requestInputReadiness,
    },
  ]

  const currentIndex = CONFIG_STEP_ORDER.indexOf(step)

  const isLastStep = currentIndex >= CONFIG_STEP_ORDER.length - 1

  return (
    <div className="flex flex-col gap-6 p-6 md:flex-row">
      <StepSidebar
        ariaLabel="Configuration steps"
        steps={steps}
        activeKey={step}
        onSelect={(key) =>
          guardedNavigate(() => setStep(key as ConfigurationStep))
        }
      />

      <div className="min-w-0 flex-1">
        {step === "endpoint" && (
          <div className="flex flex-col gap-4">
            <Card>
              <h3 className="m-0 text-base font-semibold text-gray-900">
                {currentApi.apiName}
              </h3>
              <p className="mt-2.5 font-mono text-sm text-gray-900">
                <span className="font-semibold">{currentApi.httpMethod}</span>{" "}
                {currentApi.path}
              </p>
              <p className="mt-2.5 text-sm text-muted">
                {currentApi.description || "No description provided."}
              </p>
            </Card>

            {selectedEnvironment && (
              <Card>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h4 className="m-0 text-sm font-semibold text-gray-900">
                    {selectedEnvironment.environmentName}
                  </h4>
                  <ClassificationBadge
                    classification={selectedEnvironment.classification}
                  />
                  <StatusBadge status={selectedEnvironment.environmentStatus} />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  Allow Run: {selectedEnvironment.allowRun ? "ON" : "OFF"}{" "}
                  (managed from the Environments list)
                </p>
                <p className="mt-1 text-xs text-muted">
                  Domain: {selectedEnvironment.baseUrl ?? "not set"} (edited
                  from the Environments list)
                </p>
                {environmentInactive && (
                  <p className="text-xs text-muted">
                    This Environment is INACTIVE — Credential is view-only.
                  </p>
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

        {step === "requestInput" &&
          !requestInput.loading &&
          requestInput.error && (
            <Card>
              <p className="text-error">{requestInput.error}</p>
              <Button
                variant="secondary"
                onClick={() => void requestInput.refetch()}
              >
                Retry
              </Button>
            </Card>
          )}

        {step === "requestInput" &&
          !requestInput.loading &&
          !requestInput.error &&
          requestInput.definition && (
            <RequestInputTab
              key={apiId}
              definition={requestInput.definition}
              readOnly={projectInactive}
              saving={requestInput.saving}
              onSave={requestInput.save}
              onDirtyChange={onRequestInputDirtyChange}
            />
          )}

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex justify-between">
            <Button
              variant="secondary"
              onClick={() =>
                guardedNavigate(() =>
                  setStep(CONFIG_STEP_ORDER[currentIndex - 1]),
                )
              }
              disabled={currentIndex <= 0}
            >
              ← Back
            </Button>
            {isLastStep ? (
              <Button variant="primary" onClick={() => guardedNavigate(onFinish)}>
                Finish
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() =>
                  guardedNavigate(() =>
                    setStep(CONFIG_STEP_ORDER[currentIndex + 1]),
                  )
                }
              >
                Next →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
