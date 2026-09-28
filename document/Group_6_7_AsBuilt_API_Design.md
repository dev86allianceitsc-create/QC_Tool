# Group 6/7 — Comparison Engine & Result/Classification — As-Built API Design

**Status:** AS-BUILT / FOR REVIEW
**Branch:** `wip/group-3c-authentication`
**Scope:** API-CMP-001…010 (AnD API v0.2), engine gates G1–G6 (Handoff v0.1), REQ-CMP-001…018, REQ-ENV-004, REQ-OUT-002.
**Companion:** `Group_6_7_AsBuilt_Database_Design.md`.

**Sources read in full for this document:** `AnD_API_Group_6_7_Comparison_v0.2.md`, `AnD_Database_Group_6_7_Comparison_v0.3.md`, `Handoff_Implementation_Comparison_Group_6_7_v0.1.md`, `REQ-CMP-001_Detail_Requirement_FINAL.md`; `prisma/schema.prisma` (Comparison/ComparisonChain/ComparisonAttempt/ComparisonFinding/ComparisonClassificationEvent/RunExecution models); every file under `apps/api/src/modules/comparison/` (4 controllers, 2 access guards + util, `comparison.service.ts`, `comparison-engine.service.ts`, `comparison-query.service.ts`, all 5 gate/diff utilities, 5 DTOs, 2 constants files) and the AUTO_EXECUTION wiring in `apps/api/src/modules/run/run-execution.engine.ts` / `runs.service.ts`. REQ-CMP-002…018/ENV-004/OUT-002 are traced via the AnD API v0.2 §7 and AnD Database v0.3 §8 Traceability Matrices (the BA-approved requirement→rule translation), cross-checked line-by-line against the code cited above — not re-derived from the raw requirement prose in this pass.

**Verified this session (commands actually run, not assumed):**

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` (apps/api) | PASS — no errors |
| `npx nest build` (apps/api) | PASS — no errors |
| `node --experimental-vm-modules jest src/modules/comparison` | PASS — 9 suites, 159 tests |
| `node --experimental-vm-modules jest` (full apps/api suite) | PASS — 38 suites, 468 tests |

No lint script exists in this repo (`apps/api/package.json` has no `lint` entry) — not run. Stderr lines reading `write conflict` / `db is down` / `boom` / `connection reset` during the test run are intentional mock-rejection messages from FAILED-path unit tests (`ComparisonEngineService`/`SnapshotService` error-handling specs asserting the logger fires), not real failures — confirmed by the 0-failure summary line.

---

## 1. Contract scope and boundary

Group 6/7 exposes exactly the 10 operations catalogued as API-CMP-001…010 in AnD API v0.2 §1.1, across 4 controllers:

- `ProjectComparisonsController` (`/projects/:projectId/comparisons`) — CMP-001 create, CMP-003 list.
- `ProjectComparisonChainsController` (`/projects/:projectId/comparison-chains`) — CMP-002 create chain.
- `ComparisonsController` (`/comparisons/:comparisonId/...`) — CMP-004 get, 005 findings, 006 attempts, 007 retry, 009 classify, 010 list classifications.
- `ComparisonChainsController` (`/comparison-chains/:comparisonChainId`) — CMP-008 get chain.

**Boundary honored:** `ComparisonEngineService`/`ComparisonService` are exported by `ComparisonModule` (`comparison.module.ts`) so `RunModule` can inject them for AUTO_EXECUTION wiring, exactly the precedent set by `SnapshotModule`/`AuditModule`. `ComparisonQueryService` (the API-shape layer: permission pre-checks, 400/404/422 branching, response mapping) is **not exported** — nothing outside this module talks to the Comparison API surface directly, matching `SnapshotQueryService`'s own module comment. No GET operation re-triggers the engine; every read path (`getComparison`, `listComparisonFindings`, `listComparisonAttempts`, `getComparisonChain`, `listClassificationEvents`) only reads persisted rows. The only two paths that ever call `ComparisonEngineService.processAttempt` are (a) `RunExecutionEngine`'s AUTO_EXECUTION wiring immediately after `ComparisonService.tryCreateAutomaticComparison`, awaited synchronously, and (b) `ComparisonQueryService.dispatch`, called fire-and-forget from `createComparison`/`createComparisonChain`/`retryComparison` (`.catch(err => this.logger.error(...))`, never awaited by the HTTP response).

**API-VERIFY-01 resolved without a duplicate Run endpoint:** `RunExecutionDetail.comparisonAvailability: ComparisonAvailabilityInfo | null` (`runs.service.ts`) is an additive optional field on the pre-existing Run execution-detail endpoint, modeled on the same precedent as `snapshotSave`. No new public Run route was created.

---

## 2. Common API conventions actually implemented

- **AuthN:** `SessionGuard` (Bearer session) on every controller, identical to Group 3C/5.
- **AuthZ:** `ProjectAccessGuard` on the two `:projectId`-scoped controllers; `ComparisonAccessGuard`/`ComparisonChainAccessGuard` on the two bare-ID controllers (§7).
- **Pagination:** every list operation extends/uses `PaginationQueryDto` and returns `ComparisonPagedResult<T>` (`{ items, page, pageSize, totalCount }`-shaped, mirroring the repo's existing paged-result convention rather than Audit's own `PagedResult` type verbatim — a naming deviation, see §12).
- **UUID validation:** `:projectId`/nested path params use `ParseUUIDPipe` at the controller. The two bare-ID routes (`comparisonId`, `comparisonChainId`) validate inside their guard instead (`comparison-access.util.ts` `isValidUuid`), because Nest's Guards phase runs before its Pipes phase — a malformed UUID reaching Prisma's `@db.Uuid` column would otherwise throw `PrismaClientValidationError` instead of a clean 400/404.
- **404-collapse for cross-project safety:** both bare-ID guards throw the same `NOT_FOUND` for "resource does not exist" and "resource exists but access denied" — a cross-project actor can never distinguish the two (AnD API §2.1).
- **Error envelope:** `BusinessException extends HttpException`, constructed `super({ errorCode, message }, status)` — same convention as every other module; `errorCode` is reachable only via `.getResponse().errorCode`, never via NestJS's default `message`/`statusCode` shape.
- **Location header:** used only on the two "create" 201s (`createComparison`, `createComparisonChain`), each pointing at the bare-ID GET route for the created resource — consistent with AnD's "201 + Location" requirement, scoped to CMP-001/002 only (not retroactively applied to CMP-007's 201, see §12).

---

## 3. API Registry (as implemented)

| Operation | Method & route | Controller | Status codes |
|---|---|---|---|
| API-CMP-001 `createComparison` | `POST /projects/:projectId/comparisons` | ProjectComparisonsController | 201, 200 (no-pair), 400, 401, 403, 404, 422 |
| API-CMP-002 `createComparisonChain` | `POST /projects/:projectId/comparison-chains` | ProjectComparisonChainsController | 201, 400, 401, 403, 404, 422 |
| API-CMP-003 `listComparisons` | `GET /projects/:projectId/comparisons` | ProjectComparisonsController | 200, 401, 403, 404 |
| API-CMP-004 `getComparison` | `GET /comparisons/:comparisonId` | ComparisonsController | 200, 401, 404 |
| API-CMP-005 `listComparisonFindings` | `GET /comparisons/:comparisonId/findings` | ComparisonsController | 200, 401, 404 |
| API-CMP-006 `listComparisonAttempts` | `GET /comparisons/:comparisonId/attempts` | ComparisonsController | 200, 401, 404 |
| API-CMP-007 `retryComparison` | `POST /comparisons/:comparisonId/retry` | ComparisonsController | 201, 401, 404, 409 |
| API-CMP-008 `getComparisonChain` | `GET /comparison-chains/:comparisonChainId` | ComparisonChainsController | 200, 401, 404 |
| API-CMP-009 `createClassificationEvent` | `POST /comparisons/:comparisonId/classification-events` | ComparisonsController | 201, 400, 401, 404, 409 |
| API-CMP-010 `listClassificationEvents` | `GET /comparisons/:comparisonId/classification-events` | ComparisonsController | 200, 401, 404 |

Global prefix is `api/v1` (matches AnD's documented paths); confirmed via the controllers' relative paths plus the existing `main.ts` global prefix used by every other module (not re-verified line-by-line this session, consistent with all controllers read).

**Deviation from AnD's route for retry:** AnD API v0.2 §1.1 documents `retryComparison` at `POST /comparisons/{comparisonId}/attempts`; the implementation uses `POST /comparisons/:comparisonId/retry` (`comparisons.controller.ts:77`). Same operation semantics (new attempt, 201, `RetryComparisonResultDto`), different path token — see §12.

---

## 4. Endpoint-by-endpoint analysis

### API-CMP-001 `createComparison`
Body: `CreateComparisonDto` — `selectionMode: PAIR | BASELINE_LATEST` discriminator. `PAIR` requires `baselineSnapshotId`/`targetSnapshotId` (both `@IsUUID`, `@ValidateIf` branch-conditional); `BASELINE_LATEST` requires `apiId`/`environmentId`/`authContextRef` (string, non-empty). The DTO only expresses "required when this branch selected" — the complementary "forbidden when the other branch selected" check (a mixed-branch body is `400 VALIDATION_ERROR`) is enforced in `ComparisonQueryService.createComparison` itself, before the DTO fields are read.
- `PAIR` + valid ids + gate passes/fails → `201 CREATED`, `Location` header, `{comparisonId, comparisonAttemptId, processingStatus}` (`CreateComparisonResult`). A gate failure does **not** downgrade this to an error — a BLOCKED attempt is still a successfully created resource (AnD invariant, §1 core scope requirement #1).
- `BASELINE_LATEST` that cannot construct a pair → `200 OK`, `{comparisonId: null, availabilityReasonCode, latestSnapshotId}` (`ComparisonAvailabilityResult`), **no** Execution write, **no** resource created — `project-comparisons.controller.ts:64-68` branches on `"comparisonAttemptId" in result` to pick 201 vs 200 at the transport layer, keeping the service return type a plain discriminated union.
- 422 `SEMANTIC_VALIDATION_ERROR`: duplicate baseline/target id, or `baselineSnapshotId` not belonging to the path Project.
- 404: Project, or either named Snapshot in a `PAIR` request, not found/not visible.

### API-CMP-002 `createComparisonChain`
Body: `CreateComparisonChainDto` — only `startSnapshotId`/`endSnapshotId` (`@IsUUID`). Every Snapshot in between is resolved and frozen server-side (`executionCompletedAt ASC, snapshotId ASC` per the model comment) — the client is never the authoritative source for chain membership. 201 returns `{comparisonChainId, selectedSnapshotCount, pairCount}` + `Location`. 422 on identical endpoints, endpoints spanning different Project/API/Environment/auth context, or fewer than 2 Snapshots resolved.

### API-CMP-003 `listComparisons`
Query: `ListComparisonsQueryDto` — allowlisted filters only (`apiId`, `snapshotId` matching A **or** B, `executionId` matching the AUTO source Execution **or** either side's source Execution, `sourceKind`, `processingStatus`, `result`). `result` strictly matches `SAME`/`DIFFERENT`, never a NULL not-yet-concluded row. Returns `ComparisonPagedResult<ComparisonSummaryDto>`.

### API-CMP-004 `getComparison`
Returns `ComparisonDetailDto` — identity/scope, `baselineSnapshot`/`targetSnapshot` `SnapshotSummary` (only emitted after both-sides access is confirmed by the guard), `latencyDeltaMs`/`apiVersionChanged`/`databaseVersionChanged`, status/reason/result/classification as independent fields (§5, §11 example block in `comparisons.controller.ts:39-44` covers BLOCKED/SAME/DIFFERENT/FAILED shapes).

### API-CMP-005 `listComparisonFindings`
Query: `ListComparisonFindingsQueryDto` (`phase?: INPUT | OUTPUT`, optional — omitted returns both in the same stable ordinal sort). Returns `ComparisonFindingsResult`: paged `ClassificationEventItemDto`-sibling finding rows, `a`/`b` sides always via `buildFindingSide` (see §12 for the raw-content gap this exposes).

### API-CMP-006 `listComparisonAttempts`
Returns `ComparisonPagedResult<ComparisonAttemptListItemDto>`, oldest attempt first, full retry/reason history per Comparison.

### API-CMP-007 `retryComparison`
No body. 201 `{comparisonAttemptId, attemptNumber, processingStatus: QUEUED}`. 409 with one of `ALREADY_COMPLETED` / `ATTEMPT_NOT_TERMINAL` / `REASON_NOT_RETRYABLE` / `CONCURRENT_RETRY` (P2002 race on a second concurrent retry call).

### API-CMP-008 `getComparisonChain`
Returns `ComparisonChainDetailDto` — chain identity plus a paged, `pairOrdinal`-ordered list of the chain's Comparisons (`ComparisonChainAccessGuard` checks the chain's single authoritative Project, no per-pair Snapshot check needed since chain endpoints are required to share scope).

### API-CMP-009 `createClassificationEvent`
Body: `CreateClassificationEventDto` — `classification: EXPECTED | UNEXPECTED`, optional trimmed `note` (max `COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH = 2000`, self-flagged pending confirmation, see §13), required-but-nullable `expectedRevision` (`null` = "I believe no event exists yet", explicit integer = optimistic-concurrency check). 409 `NOT_CLASSIFIABLE` (no COMPLETED/DIFFERENT attempt yet) or `REVISION_CONFLICT` (stale `expectedRevision`, message echoes the current revision).

### API-CMP-010 `listClassificationEvents`
Returns `ComparisonPagedResult<ClassificationEventItemDto>`, newest revision first — full audit trail of every classification change, never overwritten.

---

## 5. Response field dictionary (as implemented)

Types below are the actual exported interfaces from `comparison-query.service.ts`, cited by name in the controllers read this session.

| Type | Key fields | Notes |
|---|---|---|
| `ComparisonSummaryDto` / `ComparisonDetailDto` | `comparisonId, projectId, apiId, environmentId, baselineSnapshotId, targetSnapshotId, sourceKind, sourceExecutionId?, comparisonChainId?, pairOrdinal?, processingStatus, stoppedAtGate?, reasonCode?, reasonDetailSafe?, inputCheckOutcome?, result?, outputDifferenceCount?, classification?, classificationRevision?, classifiedBy?, classifiedAt?, latencyDeltaMs?, apiVersionChanged?, databaseVersionChanged?, createdAt, endedAt?` | `result`/`outputDifferenceCount` NULL until COMPLETED; `classification*` NULL together until first event; `*Changed` computed by `computeVersionChanged(a,b)` — `null` if either side `UNKNOWN`, else `a!==b`. |
| `FindingSideDto` | `{presenceKind, displayKind, safeText, hexPreview, isRedacted, hasMore}` | `buildFindingSide()` currently **always** returns `safeText: null, hexPreview: null, isRedacted: true` — see §12/G5 gap. |
| `ComparisonFindingItemDto` | `findingId, phase, component, differenceKind, findingOrdinal, location?, a, b, ruleCode, ruleVersion, safeSummary?` | `location` is JSON path/header name/byte offset — never a fabricated path for raw content. |
| `ComparisonAttemptListItemDto` | attempt-level mirror of the status/gate/reason/result fields above, plus `attemptNumber`. | |
| `RetryComparisonResultDto` | `{comparisonAttemptId, attemptNumber, processingStatus}` | |
| `ClassificationEventItemDto` / `ClassificationEventResultDto` | `{revision, classification, note?, classifiedBy, classifiedAt}` | Append-only; no update/delete route exists. |
| `ComparisonChainDetailDto` | chain identity + paged `comparisons: ComparisonSummaryDto[]` ordered by `pairOrdinal`. | |
| `CreateComparisonResult` / `ComparisonAvailabilityResult` | discriminated by presence of `comparisonAttemptId`. | |
| `CreateChainResultDto` | `{comparisonChainId, selectedSnapshotCount, pairCount}` | |
| `ComparisonPagedResult<T>` | `{items: T[], page, pageSize, totalCount}` (repo's own paging shape, not Audit's `PagedResult`). | |

---

## 6. Error dictionary

| HTTP | errorCode | Where | Notes |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO validation, malformed query, mixed `selectionMode` branches | |
| 401 | `SESSION_INVALID` / `SESSION_EXPIRED` / `SESSION_REVOKED` | `SessionGuard` | Same catalog as every other module |
| 403 | `PROJECT_ACCESS_DENIED` | `ProjectAccessGuard` (project-scoped routes) | |
| 403 | `ACCESS_DENIED` | `ComparisonAccessGuard`/`ComparisonChainAccessGuard`, only when `request.userId` itself cannot be resolved (should be unreachable behind `SessionGuard`, defensive) | |
| 404 | `NOT_FOUND` | Comparison/chain/Snapshot/Project not found, **or** cross-project access denied (collapsed, §2) | |
| 409 | `ALREADY_COMPLETED` / `ATTEMPT_NOT_TERMINAL` / `REASON_NOT_RETRYABLE` / `CONCURRENT_RETRY` | `retryComparison` | |
| 409 | `NOT_CLASSIFIABLE` / `REVISION_CONFLICT` | `createClassificationEvent` | |
| 422 | `SEMANTIC_VALIDATION_ERROR` | duplicate ids, wrong-Project baseline, chain scope mismatch, <2 Snapshots resolvable | Reserved strictly for **request-shape** semantic errors — a validly-identified pair that fails the CMP-005 gate is *never* remapped to 422; it is a 201-created BLOCKED resource (AnD API §5, core instruction #4). |

`Comparison.reasonCode` (`comparison_attempts.reason_code`) is a **state value** on the resource body, orthogonal to the HTTP `errorCode` in this table — confirmed distinct at both the DTO level (`ComparisonDetailDto.reasonCode`) and the DB CHECK-constrained column (`ck_comparison_attempts_reason_code`).

---

## 7. AuthN/AuthZ model

- **Project-scoped routes** (`ProjectComparisonsController`, `ProjectComparisonChainsController`): `SessionGuard` then `ProjectAccessGuard` on the mutating/listing methods — identical composition to every other Project-scoped resource in the repo.
- **Bare-ID routes** (`ComparisonsController`, `ComparisonChainsController`): `SessionGuard` then a dedicated guard, because there is no `:projectId` in the path to hand to `ProjectAccessGuard`:
  - `ComparisonAccessGuard` resolves the Comparison, then checks `hasProjectAccess` against **both** `baselineSnapshot.projectId` and `targetSnapshot.projectId` in parallel (`Promise.all`) — directly implementing "check permission for both Snapshot A and B before returning any reason" (REQ-CMP-016), since a `CONTEXT_MISMATCH`-blocked pair can legitimately span two different Projects (a Comparison's own `projectId`/`apiId`/`environmentId` columns reflect Snapshot A's scope only, RS-CMP-016-01).
  - `ComparisonChainAccessGuard` checks a single Project, since a chain's two endpoints are required to already share Project/API/Environment/auth context.
  - Both guards audit-log `COMPARISON_ACCESS_DENIED` (with `targetType: "COMPARISON"` or `"COMPARISON_CHAIN"`) before throwing the collapsed 404.
- **`hasProjectAccess`** (`comparison-access.util.ts`) mirrors `ProjectAccessGuard`'s own membership check: system `ADMIN` role bypasses, otherwise a `ProjectMembership` row must exist for `(userId, projectId)`. This is the **only** permission granularity implemented — see API-VERIFY-04 in §11: there is no distinct view/compare/retry/classify/raw/note permission, everything collapses to this one project-membership check, including `retryComparison` and `createClassificationEvent`.
- Raw payload/secret exposure: `buildFindingSide()` always sets `isRedacted: true`, `safeText: null`, `hexPreview: null` — no code path in this module currently emits raw bytes to any response, so there is no redaction *bypass* to audit, but also no raw-Detail *feature* yet (§12, G5).

---

## 8. Validation layering

1. **Transport shape** (`class-validator` DTOs): type/format/enum-membership/required-vs-optional, including the discriminated-union branch technique (`@ValidateIf` on `CreateComparisonDto.selectionMode`) and the required-but-nullable technique (`CreateClassificationEventDto.expectedRevision`, matching `PutRequestInputDto.requestBody`'s existing precedent). Failures → `400 VALIDATION_ERROR`.
2. **Cross-field/branch validation not expressible by decorators** (mixed `selectionMode` branches) — enforced in `ComparisonQueryService` before the DTO fields are read, still surfaced as `400`.
3. **Existence/ownership semantics** (Project/Snapshot exist and are visible, baseline belongs to the path Project, chain endpoints differ and share scope) — `404`/`422` in `ComparisonQueryService`, **before** any engine gate runs.
4. **Business-state gates** (Project/API/Environment/auth-context match, invalidation, completeness, input compatibility, output diffing) — run only *after* a Comparison + attempt already exist; never surfaced as an HTTP error, always as a persisted `BLOCKED`/`COMPLETED` attempt (§6).
5. **Mutation-state gates** (retry eligibility, classification eligibility/revision) — `409`, checked transactionally against the current row, with P2002 unique-violation handling for genuine concurrent races (`CONCURRENT_RETRY`).

---

## 9. Idempotency & retry

- **AUTO_EXECUTION idempotency:** `comparisons.source_execution_id` is `@unique` — Postgres treats multiple `NULL`s as distinct, so this single column enforces "at most one automatic Comparison per Execution" without a partial index, while leaving `MANUAL_PAIR`/`BASELINE_LATEST`/`CHAIN_PAIR` (`NULL` here) unconstrained by it. `tryCreateAutomaticComparison` catches the resulting P2002 as a benign duplicate-dispatch no-op (e.g. an invalidation-race retry of the same Execution).
- **Chain pair idempotency:** `@@unique([comparisonChainId, pairOrdinal])`.
- **Terminal-attempt immutability:** `ck_comparison_attempts_completed_result` plus a migration-only partial unique index (`uq_comparison_attempts_completed_per_comparison` — Prisma cannot express a partial index declaratively, same convention as `ApiConfiguration`'s active-uniqueness index) guarantee at most one `COMPLETED` attempt per Comparison at the DB layer, on top of the service-level `ATTEMPT_NOT_TERMINAL`/`ALREADY_COMPLETED` checks.
- **Retry policy** (`comparison.constants.ts` `COMPARISON_ATTEMPT_RETRY_POLICY`): `never` for identity/eligibility/input facts a retry cannot change (`CONTEXT_MISMATCH`, `ENVIRONMENT_MISMATCH`, `AUTH_CONTEXT_UNKNOWN`, `SNAPSHOT_INVALIDATED`, `INPUT_MISMATCH`); `always` for technical failures (`ENGINE_ERROR`, `PERSISTENCE_ERROR`); `conditional` for Snapshot-data-unusable reasons (`SNAPSHOT_INCOMPLETE`, `UNSUPPORTED_FORMAT`, `UNSUPPORTED_ENCODING`, `PAYLOAD_UNAVAILABLE`) gated on a `payloadNowReadable` flag. **Known gap:** `payloadNowReadable` is a parameter of `ComparisonService.retryComparisonAttempt` but is never accepted from the client by `ComparisonQueryService.retryComparison` — the `conditional` branch is implemented but currently unreachable via the public API (minor, self-documented, listed in §13, not a defect).
- **Classification revision conflict:** `expectedRevision` optimistic concurrency, backed by `@@unique([comparisonId, revision])`, which doubles as the DB-level conflict check the service relies on.
- Retrying never rewrites a terminal attempt or the Comparison's `baselineSnapshotId`/`targetSnapshotId`/`sourceKind` — it only appends a new `ComparisonAttempt` row.

---

## 10. Auditability

Audit events written by this module (via `AuditWriterService`, same pattern as Snapshot/Run):

| Event | Emitted by | Trigger |
|---|---|---|
| `COMPARISON_CREATED` | `ComparisonService` | Manual/baseline-latest/chain-pair Comparison creation |
| `COMPARISON_CHAIN_CREATED` | `ComparisonService` | Chain creation |
| `COMPARISON_ACCESS_DENIED` | `ComparisonAccessGuard`, `ComparisonChainAccessGuard` | Not-found or cross-project denial (both collapse to the same 404, but are audited before the throw) |
| `COMPARISON_RETRY_REQUESTED` | `ComparisonQueryService` | Successful `retryComparison` |
| `COMPARISON_CLASSIFIED` | `ComparisonQueryService` | Successful `createClassificationEvent` |

No audit event exists for GET reads (consistent with the rest of the repo — reads are not audited, only mutations and access denials).

---

## 11. Engine gate verification (G1–G6, Handoff v0.1 §4)

| Gate | Meaning | Status | Evidence |
|---|---|---|---|
| G1 Schema | Comparison/Attempt/Finding/Classification tables exist with the right shape | **RESOLVED** | `prisma/schema.prisma:900-1151`, migration `20260925090000_add_comparison_group_6_7` |
| G2 Raw evidence | Snapshot holds sufficient raw input/output for structural diffing | **RESOLVED** for structural comparison | `body-diff.util.ts`/`header-diff.util.ts` operate on raw bytes/header pairs already captured by Snapshot (Group 5); DB-VERIFY-02 (raw sufficiency for CMP-017/018 *representation* claims) remains an explicit open item per AnD DB v0.3 §10.1 |
| G3 Policy | Exclusion/rule-version manifest source | **CONFIRMED GAP** | `DEFAULT_APPLIED_RULE_MANIFEST` (`comparison.constants.ts:52-56`) is hardcoded — no policy/rule-version master table exists yet (DB-VERIFY-03). No header/field is auto-excluded anywhere in `comparison-input-gate.util.ts`/`comparison-output-gate.util.ts`, honoring the standing "no self-invented exclusion policy" constraint |
| G4 API/Auth | Granular view/compare/retry/classify/raw/note permissions | **PARTIAL/OPEN** | Every permission decision collapses to `hasProjectAccess` (§7); no role-specific split exists (API-VERIFY-04) |
| G5 Full Detail | Raw-byte-read/preview API for findings | **CONFIRMED GAP** | `buildFindingSide()` (`comparison-query.service.ts`) unconditionally returns `safeText: null, hexPreview: null, isRedacted: true` — there is currently **no** API path that returns raw finding bytes or preview text at all; structural findings (path/offset/kind) exist, raw-content access does not (API-VERIFY-03) |
| G6 Operations | All 10 API-CMP operations implemented and functioning | **RESOLVED** (retention policy itself is DB-DECISION-01, an org decision, not a code gap) | §3–§4 above; 468/468 tests pass |

**Blocking for SAME/DIFFERENT conclusions:** G1–G3 — G1/G2 resolved, G3 is a genuine, self-documented gap (no real policy source, safe-default behavior of "exclude nothing" chosen instead of inventing one). **Blocking to freeze the API for `BASELINE_LATEST`/Detail:** G4–G5 — both open, both explicitly flagged rather than silently treated as complete.

## 11.1 RV-01…09 findings (Handoff v0.1 §2) — cross-verified against code

| # | Finding | Verified resolution |
|---|---|---|
| RV-01 | Baseline must be locked before dispatch, never reselected | `run-execution.engine.ts`: `baselineSnapshotId` written to `RunExecution` once, `ComparisonService.selectBaselineSnapshot` never called again for that Execution |
| RV-02 | No Comparison without both a baseline and a target | `tryCreateAutomaticComparison` only called when both `baseline` and `targetSnapshot` are present; the `else if (!targetSnapshot && baseline)` branch only updates `comparisonAvailabilityReasonCode`, creates nothing |
| RV-03 | Input compared before output, input mismatch never becomes DIFFERENT | `comparison-engine.service.ts`: INPUT gate runs and returns before the OUTPUT gate is ever invoked; `blockAttempt` is the only outcome on an INPUT finding |
| RV-04 | SAME/DIFFERENT only after full gate pass + full output comparison, atomic publish | `completeAttempt` persists `comparisonResult` + all findings in one write; a persistence failure is caught and turned into `FAILED`/`PERSISTENCE_ERROR`, never a partial published Result |
| RV-05 | Chain retains every Snapshot including one invalidated mid-chain; pairs processed independently | `createComparisonChain` resolves the full ordered Snapshot list once, creates one Comparison+attempt per adjacent pair; each pair's own ELIGIBILITY gate independently reports `SNAPSHOT_INVALIDATED` for that pair only |
| RV-06 | Version-changed flags nullable when UNKNOWN/missing | `computeVersionChanged(a,b)` returns `null` if either side is `"UNKNOWN"`, else `a !== b` |
| RV-07 | `executionId` filter matches AUTO source Execution or either side's source Execution | `listComparisons`: `OR: [{sourceExecutionId}, {baselineSnapshot: {runExecutionId}}, {targetSnapshot: {runExecutionId}}]` |
| RV-08 | Retry policy distinguishes never/always/conditional | `COMPARISON_ATTEMPT_RETRY_POLICY` (§9); conditional branch present but not yet client-reachable (self-documented gap, not a defect) |
| RV-09 | Classification independent of Result, append-only, revision-conflict detected | `ComparisonClassificationEvent` has no update/delete route; `@@unique([comparisonId, revision])` backs `REVISION_CONFLICT` |

## 11.2 API-VERIFY-01…06 (AnD API v0.2 §8) resolution

| Item | Question | Status | Evidence |
|---|---|---|---|
| API-VERIFY-01 | Run/Execution extension for baseline/availability/Comparison link, no duplicate endpoint | **RESOLVED** | `RunExecutionDetail.comparisonAvailability` (§1) |
| API-VERIFY-02 | Stable, opaque `authContextRef` | **OPEN** | `CreateComparisonDto.authContextRef` is accepted as a plain string and passed through as a literal match against the stored `authContextKey` — no separate opaque-reference/lookup layer exists |
| API-VERIFY-03 | Snapshot raw-read API sufficient for CMP-015/017/018 Detail | **CONFIRMED GAP** | Same finding as G5 above |
| API-VERIFY-04 | Granular permission matrix (view/compare/retry/classify/raw/note) | **OPEN** | Same finding as G4 above |
| API-VERIFY-05 | Error catalog/OpenAPI/requestId coverage | **LARGELY RESOLVED** | Every controller method carries `@ApiResponse` for its full status-code set (§3–§4); `BusinessException` envelope is uniform; `requestId` propagation was not re-verified this session (assumed via the repo's existing global exception filter, not re-read) |
| API-VERIFY-06 | Exclusion policy/version manifest source | **CONFIRMED GAP** | Same finding as G3 above |

---

## 12. Deviations from the API Design Standard / AnD proposal

| Deviation | Detail |
|---|---|
| Retry route path | AnD documents `POST /comparisons/{id}/attempts`; implemented as `POST /comparisons/{id}/retry` (`comparisons.controller.ts:77`). Same contract otherwise. |
| Paged-result shape | `ComparisonPagedResult<T>` reuses this repo's existing `{items,page,pageSize,totalCount}` convention, not Audit module's own `PagedResult` type — a naming/type divergence, not a behavioral one. |
| `authContextRef` semantics | Defined only as "equals the stored `authContextKey`" — no opaque-reference indirection was introduced (API-VERIFY-02, open by design, not invented past what's approved). |
| `Location` header scope | Applied only to CMP-001/002's 201s, not CMP-007's 201 (retry) — AnD does not explicitly require it there and the implementation did not add it speculatively. |
| `presenceKind`/finding sides | `buildFindingSide()` always returns `isRedacted:true` with no byte-tracked preview — a conservative "redact everything until G5 ships" default, not a partial/inconsistent redaction policy. |
| `assertProjectActive`-style project-state checks | Applied only to create-mutation paths (create comparison/chain/retry/classify), not to GET reads — consistent with how the rest of the repo scopes that check. |
| `listComparisons` status staleness (self-documented in code) | `processingStatus` on a list row can reflect a stale BLOCKED/FAILED attempt superseded by a later successful retry, until the caller re-fetches; noted as a known, accepted limitation rather than solved with an extra join in this pass. |

---

## 13. Unapproved design decisions / open items requiring confirmation

Per the standing instruction not to invent exclusion policy or new roles unilaterally, the following are flagged rather than silently decided:

1. **G3/API-VERIFY-06/DB-VERIFY-03 — no real rule/exclusion policy source.** `DEFAULT_APPLIED_RULE_MANIFEST` is a hardcoded placeholder (`exclusions: []`, `representationBoundary: "DEFAULT"`). The safe default chosen — exclude nothing, compare everything including Date/Authorization/nonce headers — matches the explicit "no auto-exclusion without an approved policy" instruction, but a real manifest/versioning source is still needed before CMP-006/007/008/016/017/018 can be considered fully frozen.
2. **G4/API-VERIFY-04 — no granular permission matrix.** view/compare/retry/classify/raw/note all currently collapse to one `hasProjectAccess` (project-membership-or-ADMIN) check. No new role was invented to fill this gap — it is reported as open, per instruction.
3. **G5/API-VERIFY-03 — no raw-byte-read API.** CMP-015/017/018's "safe preview + full-Detail-on-demand" model is only half-built: structural findings (path/offset/kind/redacted-summary) are complete; an actual permission-checked raw-content read endpoint against Snapshot does not exist yet.
4. **`COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH = 2000`** — reused from `snapshot.constants.ts`'s `SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH` for consistency; AnD API v0.2 §3 leaves this length "DESIGN PROPOSAL" — not a value taken from any REQ-CMP clause, pending explicit confirmation.
5. **Retry's `conditional` policy branch is unreachable via the public API** — `payloadNowReadable` exists on `ComparisonService.retryComparisonAttempt` but `ComparisonQueryService.retryComparison` never accepts or forwards it from the client. Not fixed unilaterally, since accepting it would require deciding *how* a caller affirms "the same bytes are now fully readable" — exactly the kind of policy decision the standing instruction reserves for confirmation.
6. **`run-execution.engine.ts`'s AUTO_EXECUTION call site has no dedicated test.** `ComparisonService`/`ComparisonEngineService` primitives are well covered in isolation, but the actual Run→Comparison trigger wiring inside `dispatchOne` is untested (no `run-execution.engine.spec.ts`; `run-dispatch.util.spec.ts` never references Comparison). Not a functional defect — the wiring is a direct, narrow call — but a test-coverage gap worth a follow-up commit rather than silently claimed as covered.

---

## 14. Requirement mapping (REQ-CMP-001…018, REQ-ENV-004, REQ-OUT-002)

Middle column is the BA-approved requirement→design-rule translation already recorded in AnD API v0.2 §7 / AnD Database v0.3 §8; right column is this session's own implementation evidence.

| Requirement | AnD design rule (already approved) | Implementing element | Status |
|---|---|---|---|
| CMP-001 | Result nullable; SAME/DIFFERENT only after input-compatible + output fully compared | `ComparisonEngineService.processAttempt` result branch; `ck_comparison_attempts_completed_result` | Implemented, tested (`comparison-engine.service.spec.ts`, `REQ-CMP-001` RS-01..10/BR-01..10 read in full) |
| CMP-002 | Classification events, revision, actor/time, history, independent of Result | `createClassificationEvent`/`listClassificationEvents`, `ComparisonClassificationEvent` | Implemented, tested (Should priority, implemented after core Musts per instruction) |
| CMP-003 | Baseline locked in Execution before dispatch, never reselected | `run-execution.engine.ts`, `RunExecution.baselineSnapshotId`/`baselineSelectedAt` | Implemented, tested |
| CMP-004 | Create modes (pair/baseline-latest), chain freeze A→B, per-pair detail | `CreateComparisonDto`/`CreateComparisonChainDto`, `createComparisonChain` | Implemented, tested |
| CMP-005 | Backend gate: Project/API/Environment/auth context match, completeness, not invalidated | `comparison-eligibility.util.ts` | Implemented, tested (18 cases incl. BR-CMP-014-09 precedence) |
| CMP-006 | Input outcome/gate, INPUT findings, mismatch → Result NULL, no output comparison | `comparison-input-gate.util.ts` | Implemented, tested |
| CMP-007 | Strict actual output status/headers/body, no auto exclusions | `comparison-output-gate.util.ts`, `header-diff.util.ts` | Implemented, tested |
| CMP-008 | Arrays/raw findings positional, index/order preserved | `body-diff.util.ts` `walk()` | Implemented, tested |
| CMP-009 | ABSENT/NULL/EMPTY distinguished, not conflated with missing payload | `body-diff.util.ts` presence handling, `a_value_kind`/`b_value_kind` | Implemented, tested |
| CMP-010 | Raw lexeme/type compared, no numeric coercion (`1` vs `1.0` vs `"1"`) | `json-raw-tokenizer.util.ts`, leaf comparison in `walk()` | Implemented, tested (13 tokenizer cases) |
| CMP-011 | Latency A/B/delta at Summary, never affects Result | `latencyDeltaMs` (`computeVersionChanged`-sibling logic) | Implemented, tested |
| CMP-012 | API/DB Version A→B + independent changed flag, never affects Result | `computeVersionChanged` | Implemented, tested |
| CMP-013 | Internal AUTO trigger, idempotent per Execution, no public "create Result" endpoint | `tryCreateAutomaticComparison`, `uq_comparisons_source_execution_id` | Implemented; `ComparisonService` primitives are unit-tested, but the Run-side call site itself (`run-execution.engine.ts` `dispatchOne` invoking `tryCreateAutomaticComparison`+`processAttempt`) has **no dedicated test** — the only Run-module spec is `run-dispatch.util.spec.ts`, which contains zero references to Comparison (confirmed via grep). Flagged as a coverage gap, not a functional defect. |
| CMP-014 | Availability at Execution; attempt status/reason; Result NULL until concluded; retry via CMP-007 | `comparisonAvailabilityReasonCode`, `blockAttempt`/`failAttempt`, `retryComparisonAttempt` | Implemented, tested |
| CMP-015 | OUTPUT findings A→B with location/rule, redaction + pagination | `comparison-query.service.ts` finding mapping, `buildFindingSide` | **Partially implemented** — structural findings complete, raw-content read (§11 G5) open |
| CMP-016 | Comparison identity/source/status/history/project-scope across 003–008 | Full query-service surface (§3–§5) | Implemented, tested |
| CMP-017 | Snapshot representation/rule-version boundary, unsupported/incomplete reason, no recompute | `UNSUPPORTED_FORMAT`/`UNSUPPORTED_ENCODING` reason codes, `applied_rule_manifest` | **Partially implemented** — reason codes and manifest field exist; real representation/policy source is DB-VERIFY-02/03 open item |
| CMP-018 | Full binary/multipart bytes compared, safe byte location, no metadata-only conclusion | `body-diff.util.ts` raw-bytes fallback (`RAW_BYTES` finding on any non-JSON/undecidable body) | Implemented for the raw-byte-equality path; explicit multipart-part-aware location is not separately modeled (falls back to whole-body `RAW_BYTES`) |
| ENV-004 | Environment ID is a real historical scope value, checked for equality, never inferred | `comparison-eligibility.util.ts` ENVIRONMENT_MISMATCH check; `CreateComparisonDto.environmentId` for BASELINE_LATEST | Implemented, tested |
| OUT-002 | Result/history summary exposes status/result/classification as independent, honestly-nullable fields; no promise of a raw-content endpoint ahead of policy | `ComparisonSummaryDto`/`ComparisonDetailDto` field independence (§5); `buildFindingSide` redaction default | Implemented for summary shape; raw-content contract is the same open G5 item |

---

## 15. Local verification

- OpenAPI/Swagger UI: `http://localhost:3000/api/docs` (or `http://localhost:$API_PORT/api/docs` if `API_PORT` is set) — `SwaggerModule.setup("api/docs", ...)` in `apps/api/src/main.ts`.
- Test files: `apps/api/src/modules/comparison/*.spec.ts` (9 files, 159 tests, all passing — §0 command table above).

Core Musts (CMP-001, 003–008, 011–014, 016, ENV-004, OUT-002 summary shape) are implemented and passing. The Should feature (CMP-002 classification) is implemented on top of them, per the standing "core Musts before CMP-002" instruction. Remaining open items are G3/G4/G5 (rule-policy source, permission granularity, raw-content read API) — each flagged above rather than resolved by inventing a policy or role, per the standing constraint.
