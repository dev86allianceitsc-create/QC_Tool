// Group Run types — mirror apps/api/src/modules/run/runs.service.ts response

// shapes and dto/create-run.dto.ts request shape exactly. Date fields are

// strings here (JSON over the wire), not the backend's Date objects.

export type RunType = "SINGLE" | "BATCH"

export interface RunRequestValuesPayload {
  pathValues?: Record<string, string>

  queryValues?: Record<string, string>

  headerValues?: Record<string, string>

  bodyValue?: string
}

export interface RunExecutionInput {
  apiId: string

  requestValues: RunRequestValuesPayload

  apiVersion?: string

  databaseVersion?: string
}

export interface CreateRunPayload {
  runType: RunType

  environmentId: string

  testAccountId?: string

  executions: RunExecutionInput[]
}

export interface RunExecutionSummary {
  totalApis: number

  responseReceivedCount: number

  runErrorCount: number

  skippedCount: number

  unfinishedCount: number
}

export interface RunExecutionListItem {
  executionId: string

  apiId: string

  executionOrder: number

  executionStatus: string

  executionOutcome: string | null

  skipReasonCode: string | null

  httpStatus: number | null

  apiVersion: string

  databaseVersion: string

  startedAt: string | null

  endedAt: string | null

  durationMs: number | null

  // Phase 3 Test Case History & Run Again — frozen at dispatch time (null for
  // executions that never reached dispatch, e.g. SKIPPED/NOT_EXECUTED).
  testCaseKey: string | null

  authType: string | null

  // Advanced "Re-run this execution" lineage only — null for every ordinary
  // Run Again/Run API execution.
  rerunOfExecutionId: string | null
}

export interface RunDetail {
  runId: string

  projectId: string

  environmentId: string

  createdBy: string

  runType: string

  runStatus: string

  createdAt: string

  startedAt: string | null

  endedAt: string | null

  note: string | null

  summary: RunExecutionSummary

  // The Test Account selected for this whole Run (null when the
  // Environment's authType is not LOGIN_FORM, or none was selected).
  testAccountId: string | null

  executions: RunExecutionListItem[]
}

export interface RunListItem {
  runId: string

  runType: string

  runStatus: string

  apiId: string | null

  environmentId: string

  createdBy: string

  createdAt: string

  startedAt: string | null

  endedAt: string | null

  summary: RunExecutionSummary
}

export interface RunActualRequest {
  method: string

  url: string

  query: unknown

  headers: unknown

  body: string | null
}

export interface RunHttpResponse {
  httpStatus: number | null

  headers: unknown

  body: string | null

  contentType: string | null

  bodyKind: string | null

  isTruncated: boolean

  originalSizeBytes: number | null
}

// Mirrors apps/api/src/modules/run/runs.service.ts SnapshotSaveInfo exactly

// (AnD API Group 5 Snapshot §7 Run Extension). `state: "PENDING"` is part of

// the union but not currently emitted by deriveSnapshotSave — the backend

// instead returns `snapshotSave: null` while the execution is still

// PENDING/RUNNING, which callers should treat as the real "pending" signal

// (see ExecutionResultView's SnapshotStatusBlock). `message` is documented as

// intentionally never populated by the backend (avoids leaking raw error

// text) — UI should render `state` + `reasonCode`, not rely on `message`.

export interface SnapshotSaveInfo {
  state: "SAVED" | "NOT_CREATED" | "SAVE_FAILED" | "PENDING" | "UNKNOWN"

  snapshotId?: string

  reasonCode?: string

  message?: string
}

// Group 6/7 Comparison AnD API v0.2 requirement — mirrors

// apps/api/src/modules/run/runs.service.ts ComparisonAvailabilityInfo

// exactly. baselineSnapshotId/reasonCode come straight from the Execution's

// own locked columns (never recomputed); comparisonId is populated only once

// the AUTO_EXECUTION Comparison this Execution sourced actually exists.

export interface ComparisonAvailabilityInfo {
  baselineSnapshotId: string | null

  reasonCode: string | null

  comparisonId: string | null
}

export interface RunExecutionDetail {
  runId: string

  executionId: string

  apiId: string

  environmentId: string

  executionOrder: number

  executionStatus: string

  executionOutcome: string | null

  actualRequest: RunActualRequest | null

  httpResponse: RunHttpResponse | null

  executionError: { reasonCode: string; message: string | null } | null

  skipReason: { reasonCode: string } | null

  apiVersion: string

  databaseVersion: string

  createdAt: string

  startedAt: string | null

  endedAt: string | null

  durationMs: number | null

  snapshotSave: SnapshotSaveInfo | null

  // Non-null only while executionStatus is RUNNING or COMPLETED (see

  // deriveComparisonAvailability) — permanently null for

  // PENDING/SKIPPED/INTERRUPTED/NOT_EXECUTED.

  comparisonAvailability: ComparisonAvailabilityInfo | null

  // Phase 3 Test Case History & Run Again — see RunExecutionListItem's
  // matching fields for testCaseKey/authType/rerunOfExecutionId; testAccountId
  // here is the parent Run's selected Test Account (Run.testAccountId).
  testCaseKey: string | null

  authType: string | null

  testAccountId: string | null

  rerunOfExecutionId: string | null
}

export interface ApiRunExecutionListItem {
  runId: string

  executionId: string

  runType: string

  environmentId: string

  executionStatus: string

  executionOutcome: string | null

  httpStatus: number | null

  apiVersion: string

  databaseVersion: string

  createdAt: string

  // Phase 3 Test Case History & Run Again — see RunExecutionDetail's matching
  // fields.
  testCaseKey: string | null

  authType: string | null

  testAccountId: string | null

  rerunOfExecutionId: string | null

  // Phase 3 §8 Test Case History drill-down — this row's own comparison
  // outcome, same derivation/precedence as TestCaseListItem.lastResult: never
  // conflates "no comparison" (UNAVAILABLE) with "different test case" or
  // with SAME/DIFFERENT.
  comparisonResult: "SAME" | "DIFFERENT" | "INITIAL_RUN" | "UNAVAILABLE"

  // The baseline Snapshot's completedAt this row was actually compared
  // against (null whenever comparisonResult is INITIAL_RUN/UNAVAILABLE with
  // no baseline at all).
  comparedWithAt: string | null

  // The Comparison this row's own execution sourced, when one exists — lets
  // a SAME/DIFFERENT row's "View Differences" action open that Comparison
  // directly instead of the execution's own detail page. Null whenever
  // comparisonResult is not SAME/DIFFERENT.
  comparisonId: string | null
}

// Phase 3 Test Case History & Run Again (§7/§8) — mirrors
// apps/api/src/modules/run/runs.service.ts TestCaseListItem exactly. One card
// per distinct testCaseKey for this API, backing the Run History tab's
// grouped view. lastResult: INITIAL_RUN (no baseline existed yet, concept A
// had nothing to chain to), SAME/DIFFERENT (concept C — the only two values
// ever shown as an automatic comparison's actual outcome), or UNAVAILABLE (a
// baseline candidate existed but no Comparison ever completed against it —
// blocked at ELIGIBILITY/INPUT (concept B), no target Snapshot was produced,
// or it is still in flight). Never conflate UNAVAILABLE with "different test
// case" — a card's identity is testCaseKey alone.
export interface TestCaseListItem {
  testCaseKey: string

  apiId: string

  environmentId: string

  environmentName: string

  authType: string | null

  testAccountId: string | null

  testAccountLabel: string | null

  // The latest execution's raw submitted Request Input
  // (RunExecution.requestInputSnapshot), same shape as the payload Run API
  // originally submitted.
  inputSummary: RunRequestValuesPayload | null

  lastRunAt: string

  lastExecutionId: string

  lastResult: "SAME" | "DIFFERENT" | "INITIAL_RUN" | "UNAVAILABLE"

  runCount: number

  // Stable display ordinal — ranked by this Test Case's first-ever run,
  // which never changes once set. Render this instead of array index: the
  // list itself is still sorted most-recently-run first, so index position
  // moves on every Run Again while this number must not.
  testCaseNumber: number
}
