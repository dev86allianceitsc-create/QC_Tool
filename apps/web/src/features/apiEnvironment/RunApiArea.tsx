import { useEffect, useState } from "react"

import { loadRunRequestValuesDraft, saveRunRequestValuesDraft } from "./runRequestValuesDraft.util"

import type {
  ApiEnvironmentConfigListItem,
  EnvironmentListItem,
} from "./apiEnvironment.types"

import type { AuthType, TestAccount } from "./authentication.types"

import type {
  RequestInputDefinition,
  RunRequestValues,
} from "./requestInput.types"

import { RunExecutePanel } from "./RunExecutePanel"

import { RunExecutionTargetPanel } from "./RunExecutionTargetPanel"

import { RunRequestPreviewPanel } from "./RunRequestPreviewPanel"

import { RunRequestValuesPanel } from "./RunRequestValuesPanel"

import { RunVersionMetadataPanel } from "./RunVersionMetadataPanel"

import type { UseSingleRunExecutionResult } from "./useSingleRunExecution"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

import {
  StepSidebar,
  type StepReadiness,
  type StepSidebarItem,
} from "../../components/ui/StepSidebar"

type RunApiStep = "executionTarget" | "requestValues" | "versionMetadata" | "requestPreview" | "execute"

const RUN_STEP_ORDER: RunApiStep[] = [
  "executionTarget",
  "requestValues",
  "versionMetadata",
  "requestPreview",
  "execute",
]

// REVISION 3C-R01 — Run API area. A dedicated guided area parallel to

// Configuration, not the old in-wizard "Review & Run" tab and not a drawer

// alongside it (the revision explicitly rules out a duplicate Run drawer).

// Request Values and Version Metadata are lifted here (not owned by their

// panels) so Request Preview can read the same per-Run draft; none of this

// is ever persisted or sent (§20 boundary, REQ-VER-001 persistence deferred).

export function RunApiArea({
  apiId,

  httpMethod,

  environments,

  selectedEnvironmentId,

  onSelectEnvironment,

  config,

  configsLoading,

  executionTargetReadiness,

  requestInputDefinition,

  authTypeLabel,

  authType,

  credentialStatus,

  testAccounts,

  testAccountsLoading,

  runBlockers,

  runExecution,

  onViewSnapshot,

  onViewComparison,

  initialValues,
}: {
  apiId: string

  httpMethod: string

  environments: EnvironmentListItem[]

  selectedEnvironmentId: string | null

  onSelectEnvironment: (environmentId: string) => void

  config: ApiEnvironmentConfigListItem | null

  configsLoading: boolean

  executionTargetReadiness: StepReadiness

  requestInputDefinition: RequestInputDefinition | null

  authTypeLabel: string | null

  authType: AuthType | null

  credentialStatus: ApiEnvironmentConfigListItem["credentialStatus"] | null

  testAccounts: TestAccount[]

  testAccountsLoading: boolean

  runBlockers: string[]

  runExecution: UseSingleRunExecutionResult

  onViewSnapshot?: (snapshotId: string) => void

  onViewComparison?: (comparisonId: string) => void

  initialValues?: RunRequestValues
}) {
  const [step, setStep] = useState<RunApiStep>("executionTarget")

  const [values, setValues] = useState<RunRequestValues>(
    () =>
      initialValues ??
      loadRunRequestValuesDraft(apiId, selectedEnvironmentId) ?? {
        pathValues: {},
        queryValues: {},
        headerValues: {},
        bodyValue: "",
      },
  )

  const [apiVersion, setApiVersion] = useState("")

  const [dbVersion, setDbVersion] = useState("")

  const [testAccountId, setTestAccountId] = useState<string | null>(null)

  const [justSavedDraft, setJustSavedDraft] = useState(false)

  useEffect(() => {
    if (initialValues && selectedEnvironmentId) {
      saveRunRequestValuesDraft(apiId, selectedEnvironmentId, initialValues)
    }
  }, [initialValues, selectedEnvironmentId, apiId])

  useEffect(() => {
    setTestAccountId(null)
  }, [selectedEnvironmentId])

  function handleSaveDraft() {
    saveRunRequestValuesDraft(apiId, selectedEnvironmentId, values)
    setJustSavedDraft(true)
    setTimeout(() => setJustSavedDraft(false), 1500)
  }

  const steps: StepSidebarItem[] = [
    {
      key: "executionTarget",
      label: "Execution Target",
      description: "Selected Environment, resolved Full URL, and run blockers.",
      readiness: executionTargetReadiness,
    },

    {
      key: "requestValues",
      label: "Request Values",
      description: "Manual Path, Query, Header and Body values for this Run.",
    },

    {
      key: "versionMetadata",
      label: "Version Metadata",
      description: "Optional API Version and Database Version for this Run.",
    },

    {
      key: "requestPreview",
      label: "Request Preview",
      description: "Method, resolved URL, safe headers/body, and masked auth.",
    },

    {
      key: "execute",
      label: "Execute",
      description: "Send this Run and view the actual result.",
    },
  ]

  const currentIndex = RUN_STEP_ORDER.indexOf(step)

  return (
    <div className="flex flex-col gap-6 p-6 md:flex-row">
      <StepSidebar
        ariaLabel="Run API steps"
        steps={steps}
        activeKey={step}
        onSelect={(key) => setStep(key as RunApiStep)}
      />

      <div className="min-w-0 flex-1">
        {step === "executionTarget" && (
          <RunExecutionTargetPanel
            environments={environments}
            selectedEnvironmentId={selectedEnvironmentId}
            onSelectEnvironment={onSelectEnvironment}
            config={config}
            configsLoading={configsLoading}
            authTypeLabel={authTypeLabel}
            authType={authType}
            credentialStatus={credentialStatus}
            testAccounts={testAccounts}
            testAccountsLoading={testAccountsLoading}
            selectedTestAccountId={testAccountId}
            onSelectTestAccount={setTestAccountId}
            runBlockers={runBlockers}
          />
        )}

        {step === "requestValues" &&
          (requestInputDefinition ? (
            <RunRequestValuesPanel
              definition={requestInputDefinition}
              values={values}
              onChange={setValues}
              onSaveDraft={handleSaveDraft}
              justSavedDraft={justSavedDraft}
            />
          ) : (
            <Card>
              <p className="m-0 text-sm text-muted">
                Request Input Definition is not available yet.
              </p>
            </Card>
          ))}

        {step === "versionMetadata" && (
          <RunVersionMetadataPanel
            apiVersion={apiVersion}
            dbVersion={dbVersion}
            onApiVersionChange={setApiVersion}
            onDbVersionChange={setDbVersion}
          />
        )}

        {step === "requestPreview" && (
          <RunRequestPreviewPanel
            httpMethod={httpMethod}
            fullUrl={config?.effectiveUrl ?? null}
            values={values}
            authTypeLabel={authTypeLabel}
            credentialStatus={credentialStatus}
            runBlockers={runBlockers}
          />
        )}

        {step === "execute" && (
          <RunExecutePanel
            httpMethod={httpMethod}
            fullUrl={config?.effectiveUrl ?? null}
            values={values}
            apiVersion={apiVersion}
            dbVersion={dbVersion}
            authType={authType}
            testAccountId={testAccountId}
            runBlockers={runBlockers}
            runExecution={runExecution}
            onViewSnapshot={onViewSnapshot}
            onViewComparison={onViewComparison}
          />
        )}

        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button
            variant="secondary"
            onClick={() => setStep(RUN_STEP_ORDER[currentIndex - 1])}
            disabled={currentIndex <= 0}
          >
            ← Back
          </Button>
          <Button
            variant="secondary"
            onClick={() => setStep(RUN_STEP_ORDER[currentIndex + 1])}
            disabled={currentIndex >= RUN_STEP_ORDER.length - 1}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  )
}
