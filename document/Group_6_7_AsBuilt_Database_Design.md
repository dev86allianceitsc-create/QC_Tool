# Group 6/7 — Comparison Engine & Result/Classification — As-Built Database Design

**Status:** AS-BUILT / FOR REVIEW
**Branch:** `wip/group-3c-authentication`
**Companion:** `Group_6_7_AsBuilt_API_Design.md`
**Primary evidence:** `prisma/schema.prisma` (repo root — not `apps/api/prisma/`), lines 900–1152, plus the `run_executions` extension fields (lines 677–680); `AnD_Database_Group_6_7_Comparison_v0.3.md` §3/§4/§6/§8/§10; migration `20260925090000_add_comparison_group_6_7` (raw SQL for the one CHECK/partial-index Prisma cannot express).

---

## 1. Database scope and affected entities

Group 6/7 introduces 5 new tables — `comparison_chains`, `comparisons`, `comparison_attempts`, `comparison_findings`, `comparison_classification_events` — and extends 1 existing table, `run_executions` (Group 5), with 3 new columns for baseline locking and availability reporting. No column was removed or renamed on any pre-existing table. `Project`, `Api`, `Environment`, `User` (Group 1–3) and `Snapshot`/`RunExecution` (Group 5) are referenced by FK but not modified beyond the `run_executions` extension.

---

## 2. New tables introduced

### 2.1 `comparison_chains`
Represents a single user-requested "compare this sequence of Snapshots" operation. Holds only chain-level identity/scope — the ordered Snapshot membership itself is *not* stored as its own join table; it is re-derived at read time from `Snapshot.executionCompletedAt ASC, snapshotId ASC` between the two anchor Snapshots recorded implicitly via the chain's `Comparison` rows (`pairOrdinal`-ordered).

### 2.2 `comparisons`
One row per identified A→B Snapshot pair, regardless of how it was produced (automatic, manual pair, manual baseline-latest, or one adjacent pair of a chain). This is the resource-identity table — it exists even when the pair turns out to be BLOCKED, per the core invariant that gate failure still produces a resource, never a rejected request.

### 2.3 `comparison_attempts`
One row per processing attempt against a `Comparison`. A Comparison can have 1..N attempts (retries append, never overwrite); at most one attempt may reach `COMPLETED` per Comparison (enforced by a migration-only raw partial unique index, see §6). All status/gate/reason/result state lives here, not on `comparisons` — this is what makes retry-without-losing-history possible.

### 2.4 `comparison_findings`
One row per individual INPUT or OUTPUT difference (or match-relevant fact) produced by a specific attempt. Never stores raw `value_a`/`value_b` content by design (see §7) — only structural location (path/byte-offset/length), kind, and a pre-redacted safe summary.

### 2.5 `comparison_classification_events`
Append-only human classification trail (`EXPECTED`/`UNEXPECTED`) against a Comparison's concluded Result, independent of and never overwriting the Result itself. Optimistic-concurrency `revision` column.

---

## 3. Existing tables modified

### `run_executions` (Group 5 table, extended)

| Column | Type | Purpose |
|---|---|---|
| `baseline_snapshot_id` | `uuid`, nullable, FK → `snapshots.snapshot_id` | The frozen baseline Snapshot selected once at dispatch time (CMP-003) |
| `baseline_selected_at` | `timestamptz`, nullable | When the baseline lock happened — proof it precedes target-Snapshot capture, never recomputed afterward |
| `comparison_availability_reason_code` | `varchar`, nullable | `NO_LATEST_SNAPSHOT` / `NO_BASELINE` / `BASELINE_INVALIDATED` — surfaced on the Execution detail read (API-VERIFY-01) without a duplicate public endpoint |

No FK from `run_executions` to `comparisons` — the link is the reverse direction (`comparisons.source_execution_id` → `run_executions`), keeping `run_executions` from needing to know whether/how many Comparisons exist against it.

---

## 4. Field dictionary

### `comparison_chains`
| Column | Type | Null? | Notes |
|---|---|---|---|
| `comparison_chain_id` | uuid PK | no | |
| `project_id` | uuid FK → projects | no | |
| `api_id` | uuid FK → apis | no | |
| `environment_id` | uuid FK → environments | no | |
| `requested_by` | uuid FK → users | no | |
| `created_at` | timestamptz | no | default now() |
| `note` | text | yes | |

### `comparisons`
| Column | Type | Null? | Notes |
|---|---|---|---|
| `comparison_id` | uuid PK | no | |
| `project_id`, `api_id`, `environment_id` | uuid FK | no | Snapshot A's scope only (RS-CMP-016-01) — not "both sides," documented in the model comment |
| `baseline_snapshot_id`, `target_snapshot_id` | uuid FK → snapshots | no | |
| `source_kind` | varchar(32) | no | `AUTO_EXECUTION` / `MANUAL_PAIR` / `BASELINE_LATEST` / `CHAIN_PAIR` |
| `source_execution_id` | uuid FK → run_executions, unique | yes | non-NULL only for `AUTO_EXECUTION`; unique enforces per-Execution idempotency |
| `comparison_chain_id` | uuid FK → comparison_chains | yes | non-NULL only for `CHAIN_PAIR` |
| `pair_ordinal` | int | yes | non-NULL only alongside `comparison_chain_id` |
| `requested_by` | uuid FK → users | yes | NULL for `AUTO_EXECUTION` (system-triggered) |
| `created_at` | timestamptz | no | |
| `note` | text | yes | |

### `comparison_attempts`
| Column | Type | Null? | Notes |
|---|---|---|---|
| `comparison_attempt_id` | uuid PK | no | |
| `comparison_id` | uuid FK | no | |
| `attempt_number` | int | no | 1-based, unique per `comparison_id` |
| `processing_status` | varchar(20) | no | `QUEUED` / `RUNNING` / `BLOCKED` / `COMPLETED` / `FAILED` |
| `stopped_at_gate` | varchar(20) | yes | `ELIGIBILITY` / `INPUT` / `OUTPUT` — set only when `processing_status='BLOCKED'` |
| `reason_code` | varchar(40) | yes | one of the 11 `ComparisonAttemptReasonCode` values |
| `reason_detail_safe` | text | yes | pre-redacted human-readable detail, never raw payload content |
| `input_check_outcome` | varchar(20) | yes | `COMPATIBLE` / `MISMATCH` |
| `comparison_result` | varchar(20) | yes | `SAME` / `DIFFERENT` — set only when `processing_status='COMPLETED'` |
| `applied_rule_manifest` | jsonb | yes | rule-version/exclusion snapshot actually applied (currently always `DEFAULT_APPLIED_RULE_MANIFEST`, §13) |
| `started_at`, `ended_at` | timestamptz | yes | |
| `created_at` | timestamptz | no | |

### `comparison_findings`
| Column | Type | Null? | Notes |
|---|---|---|---|
| `comparison_finding_id` | uuid PK | no | |
| `comparison_attempt_id` | uuid FK | no | |
| `phase` | varchar(20) | no | `INPUT` / `OUTPUT` |
| `component` | varchar(32) | no | e.g. `METHOD`/`URL`/`REQUEST_HEADER`/`REQUEST_BODY`/`STATUS`/`RESPONSE_HEADER`/`RESPONSE_BODY` (7 values, `ComparisonComponent`) |
| `finding_ordinal` | int | no | stable per-attempt-per-phase ordering, unique with `(comparison_attempt_id, phase)` |
| `difference_kind` | varchar(32) | no | `PRESENCE`/`TYPE`/`VALUE`/`ORDER`/`LENGTH`/`RAW_BYTES` (6 values, CHECK-enforced) |
| `location_path` | text | yes | JSON path / header name — never fabricated for raw-byte findings |
| `a_byte_offset`, `b_byte_offset`, `a_byte_length`, `b_byte_length` | bigint | yes | structural pointers into the Snapshot's raw payload, not the payload itself |
| `a_value_kind`, `b_value_kind` | varchar(20) | yes | distinguishes ABSENT / NULL / EMPTY / VALUE at each side (CMP-009) |
| `rule_code` | varchar(60) | no | one of 13 `COMPARISON_RULE_CODES` (extensible, **not** CHECK-enforced — deliberately open-ended per the constants file's own comment) |
| `safe_summary` | text | yes | pre-redacted description; never raw value bytes |
| `created_at` | timestamptz | no | |

### `comparison_classification_events`
| Column | Type | Null? | Notes |
|---|---|---|---|
| `comparison_classification_event_id` | uuid PK | no | |
| `comparison_id` | uuid FK | no | |
| `revision` | int | no | 1-based, unique per `comparison_id` |
| `classification` | varchar(20) | no | `EXPECTED` / `UNEXPECTED` |
| `note` | text | yes | max length `COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH=2000` (app-layer only, see §13) |
| `classified_by` | uuid FK → users | no | |
| `created_at` | timestamptz | no | |

---

## 5. Relationships and cardinality

```
projects 1───N comparison_chains
projects 1───N comparisons
apis 1───N comparisons / comparison_chains
environments 1───N comparisons / comparison_chains
users 1───N comparisons (requested_by, nullable) / comparison_chains / comparison_classification_events

run_executions 0..1───0..1 comparisons        (source_execution_id, unique ⇒ at most one AUTO comparison)
run_executions 1───N snapshots                (Group 5, unchanged)
snapshots 1───N comparisons (as baseline_snapshot_id)
snapshots 1───N comparisons (as target_snapshot_id)

comparison_chains 1───N comparisons           (comparison_chain_id + pair_ordinal)
comparisons 1───N comparison_attempts         (1..N, append-only)
comparison_attempts 1───N comparison_findings (0..N per attempt)
comparisons 1───N comparison_classification_events (0..N, append-only)

run_executions N───1 snapshots (baseline_snapshot_id, new FK from §3)
```

All Comparison-domain FKs use `onDelete: Restrict` — no automatic cascade-delete anywhere in this domain, matching the "no auto-delete, retention is a data-owner decision (G6/DB-DECISION-01)" default.

---

## 6. Indexes and database constraints

**Unique constraints:**
- `uq_comparisons_source_execution_id` — `comparisons(source_execution_id)` → AUTO-per-Execution idempotency (CMP-013).
- `uq_comparisons_chain_id_pair_ordinal` — `comparisons(comparison_chain_id, pair_ordinal)`.
- `uq_comparison_attempts_comparison_id_attempt_number` — `comparison_attempts(comparison_id, attempt_number)`.
- `uq_comparison_attempts_completed_per_comparison` — **raw partial unique index**, migration-only (`WHERE processing_status = 'COMPLETED'`), since Prisma's schema DSL cannot express a partial index declaratively; same convention already used for `ApiConfiguration`'s active-uniqueness index. Guarantees at most one terminal `COMPLETED` attempt per Comparison even under a retry race.
- `uq_comparison_findings_attempt_id_phase_finding_ordinal` — `comparison_findings(comparison_attempt_id, phase, finding_ordinal)`.
- `uq_comparison_classification_events_comparison_id_revision` — `comparison_classification_events(comparison_id, revision)` → backs optimistic-concurrency `REVISION_CONFLICT` detection.

**CHECK constraints** (all named, all confirmed present in `schema.prisma`'s Comparison block):
- `ck_comparisons_baseline_target_distinct` — `baseline_snapshot_id <> target_snapshot_id`.
- `ck_comparisons_source_kind` — `source_kind` ∈ the 4-value enum.
- `ck_comparisons_source_execution_id` — non-NULL iff `source_kind='AUTO_EXECUTION'`.
- `ck_comparisons_chain_fields` — `comparison_chain_id`/`pair_ordinal` non-NULL together iff `source_kind='CHAIN_PAIR'`.
- `ck_comparisons_pair_ordinal` — `pair_ordinal >= 1` when present.
- `ck_comparison_attempts_processing_status`, `_stopped_at_gate`, `_reason_code`, `_input_check_outcome` — enum membership per column.
- `ck_comparison_attempts_completed_result` — `comparison_result` is non-NULL **iff** `processing_status='COMPLETED'` — the single constraint that makes CMP-001's "Result only after full gate pass" claim DB-enforced, not just app-enforced.
- `ck_comparison_findings_phase`, `_component`, `_difference_kind` — enum membership.
- Byte-offset/length CHECKs on `comparison_findings` — non-negative when present (exact predicate not re-derived this pass beyond confirming the constraint exists in schema; see `schema.prisma` inline comment for the literal SQL).
- `ck_comparison_classification_events_revision` — `revision >= 1`.
- `ck_comparison_classification_events_classification` — enum membership.

**Indexes for query paths actually used by the API:**
- `idx_comparison_chains_project_id_created_at` — `(project_id, created_at DESC)`.
- `idx_comparisons_baseline_snapshot_id`, `idx_comparisons_target_snapshot_id` — back the `listComparisons` `snapshotId` OR-filter (RV-07).
- `idx_comparisons_project_id_api_id_created_at` — `(project_id, api_id, created_at DESC)`, the primary `listComparisons` pagination path.

No additional index was added for `comparison_attempts`/`comparison_findings`/`comparison_classification_events` beyond their unique constraints — all current read paths (`listComparisonAttempts`, `listComparisonFindings`, `listClassificationEvents`) filter by `comparison_id`/`comparison_attempt_id`, which the unique constraints' leading columns already serve as an index.

---

## 7. Sensitive/raw evidence storage and redaction boundary

Unlike Group 3C (credential encryption at rest), Group 6/7's sensitive-data concern is **raw request/response content**, not secrets storage per se — the actual bytes already live in Snapshot (Group 5) and are not duplicated here. The Comparison domain's own design choice, confirmed directly in the `ComparisonFinding` model's inline schema comment:

> "Never stores raw `value_a`/`value_b`... Detail is re-derived from Snapshot by a backend that re-checks permission (CMP-015/017/018)."

This means:
- `comparison_findings` is **structurally incapable** of holding a raw value — there is no `value_a`/`value_b` column, only `*_byte_offset`/`*_byte_length` pointers plus a pre-redacted `safe_summary` text.
- Any future raw-content "view more" feature (the G5 API gap documented in the companion API doc) would need to re-open Snapshot's own raw payload store and re-check permission at read time — it cannot be serviced by reading `comparison_findings` alone, by design.
- `reason_detail_safe` on `comparison_attempts` follows the same rule — always a safe, pre-redacted string, never raw payload content.

This is a stricter posture than Group 3C's credential encryption (which stores an encrypted-but-present secret): here, the sensitive bytes are **not present at all** in this domain's tables, only pointers into a Snapshot record that itself is subject to its own Group-5 permission/redaction rules.

---

## 8. Attempt lifecycle and retry persistence model

Equivalent to Group 3C's "credential lifecycle" section, this section covers `comparison_attempts`' state machine, since that is this domain's lifecycle-bearing table:

`QUEUED → RUNNING → {BLOCKED | COMPLETED | FAILED}`

- **QUEUED**: row created (transactionally with the parent `comparisons` row on first creation), dispatch not yet started.
- **RUNNING**: gate pipeline (`ELIGIBILITY → INPUT → OUTPUT`) executing.
- **BLOCKED**: a gate returned a failure reason; `stopped_at_gate` + `reason_code` set; `comparison_result` stays NULL (DB-enforced by `ck_comparison_attempts_completed_result`).
- **COMPLETED**: full pipeline passed; `comparison_result` set (`SAME`/`DIFFERENT`); at most one such row per Comparison (partial unique index, §6).
- **FAILED**: unexpected exception (`ENGINE_ERROR`) or a persistence-layer failure after partial work (`PERSISTENCE_ERROR`) — never leaves a half-written `COMPLETED` row, since the final publish is one transactional write.

**Retry** always **appends** `attempt_number + 1` as a new row — no UPDATE ever targets a terminal (`BLOCKED`/`COMPLETED`/`FAILED`) attempt's own status/result columns. This is what makes `listComparisonAttempts` a genuine, non-destructive history rather than a mutable "latest attempt" projection. Retry eligibility (§9 of the API doc) is a service-layer read of `COMPARISON_ATTEMPT_RETRY_POLICY` keyed on the terminal attempt's `reason_code`, not a DB constraint — the DB only guarantees *that* history is preserved, not *which* reasons are retryable.

---

## 9. Data isolation by Project, API, and Environment

- `comparisons.project_id`/`api_id`/`environment_id` scope the resource to Snapshot A's context (RS-CMP-016-01) — **not** a merged/ambiguous scope across both sides. A pair spanning two different Projects (a `CONTEXT_MISMATCH`-blocked pair) is still representable as a single row, correctly scoped to one side, with the mismatch itself recorded as the block reason rather than as a schema-level impossibility.
- Cross-Project/Environment leakage is prevented at the **query layer**, not by a DB-level row-security policy: `ComparisonAccessGuard` independently checks `hasProjectAccess` against both `baseline_snapshot.project_id` and `target_snapshot.project_id` before any row is returned (see companion API doc §7) — the DB schema itself does not enforce that both sides share a Project (they explicitly may not, for a mismatched pair), so isolation is an application-layer responsibility here, consistent with how `Snapshot`/`RunExecution` isolation already works upstream.
- `comparison_chains` **does** require both endpoints to share Project/API/Environment/auth context before a chain can be created (422 otherwise) — chains are a stricter, single-scope resource by design, unlike ad-hoc pair Comparisons.
- Auth-context scoping for `BASELINE_LATEST` selection uses `computeAuthContextKey` (Group 5's stable auth-context derivation, reused rather than reinvented) as part of the `WHERE` clause in `selectBaselineSnapshot` — never a raw-token comparison (REQ-CMP-007/AUTH boundary honored at the query level, not the schema level).

---

## 10. Version metadata / rule-manifest persistence status

- `comparison_attempts.applied_rule_manifest` (jsonb) exists specifically to record *which* rule/exclusion version was actually applied to that attempt — the schema-level hook for CMP-017's "preserve one consistent decode/representation boundary" and G3's policy-versioning need. **Currently always populated with the same hardcoded `DEFAULT_APPLIED_RULE_MANIFEST`** (`{ruleManifestVersion:1, exclusions:[], representationBoundary:"DEFAULT"}`) — there is no real versioned-policy table yet to source it from (DB-VERIFY-03, open).
- API/Database version-changed flags (CMP-012) are **not** persisted as their own column — `apiVersionChanged`/`databaseVersionChanged` are computed on read (`computeVersionChanged`) from whatever version metadata each Snapshot already carries (Group 5), keeping this domain from duplicating version state it does not own.
- `latencyDeltaMs` (CMP-011) is likewise not persisted — computed on read from each Snapshot's own captured timing, confirming latency can never retroactively affect a stored `comparison_result` (it is never written anywhere in this domain's tables).

---

## 11. Mapping to Group 6/7 requirements

See `Group_6_7_AsBuilt_API_Design.md` §14 for the full REQ-CMP-001…018/ENV-004/OUT-002 table (requirement → AnD design rule → implementation evidence, spanning both API and DB layers). DB-specific highlights not repeated there:

- **CMP-001** DB-enforced via `ck_comparison_attempts_completed_result` (not just app logic) — a `COMPLETED` row without a Result, or a Result on a non-`COMPLETED` row, is a constraint violation, not just a bug.
- **CMP-013** DB-enforced via `uq_comparisons_source_execution_id`.
- **CMP-014** DB-enforced via `uq_comparison_attempts_completed_per_comparison` (terminal-attempt immutability) plus `uq_comparison_attempts_comparison_id_attempt_number` (ordered append-only history).
- **CMP-002** DB-enforced via `uq_comparison_classification_events_comparison_id_revision` (the actual mechanism behind `REVISION_CONFLICT`).
- **CMP-015/017/018** — DB *cannot* satisfy the "full Detail" half by design (§7); DB-VERIFY-02 (does Snapshot's own raw storage even have enough fidelity to support this later) remains explicitly open per AnD DB v0.3 §10.1, unresolved by this domain's own tables.

---

## 12. Deviations from the Database Design Standard

| Deviation | Detail |
|---|---|
| Partial unique index expressed in raw migration SQL | `uq_comparison_attempts_completed_per_comparison` cannot be declared in Prisma's schema DSL (no partial-index support); implemented via a raw SQL migration statement instead, following the exact precedent already set by `ApiConfiguration`'s active-uniqueness index elsewhere in this schema — not a new pattern introduced by this domain. |
| `rule_code` not CHECK-enforced | Unlike `component`/`difference_kind` (closed enums, CHECK-enforced), `rule_code` is deliberately left open-ended (`comparison-finding.constants.ts`'s own comment) to allow new diagnostic rule codes without a migration — a documented, intentional asymmetry, not an oversight. |
| No row-level security / no DB-level cross-Project isolation | Isolation for mismatched-scope pairs is enforced at the query/guard layer (§9), not by a DB CHECK or RLS policy, since a `CONTEXT_MISMATCH`-blocked pair must be representable as a single valid row spanning two Projects. |
| `applied_rule_manifest` populated with a constant placeholder | Not a schema deviation, but a data-population deviation from the AnD's intent that this column reflect a real, versioned policy source (§10, §13). |

---

## 13. Unapproved design decisions / open questions

1. **`COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH = 2000`** is an app-layer `class-validator` limit only — there is no DB-level `varchar(2000)`/CHECK length constraint on `comparison_classification_events.note` (it is `text`, unbounded at the schema level). If 2000 is confirmed as the real business limit, a matching DB-level guard could be added; not added unilaterally since the length itself is still a "DESIGN PROPOSAL" per AnD API v0.2 §3.
2. **No real rule/policy-version table** backs `applied_rule_manifest` — see §10/§12. Adding one (and what its schema should look like) is a G3/DB-VERIFY-03 decision reserved for confirmation, not invented here.
3. **DB-VERIFY-02** (whether Snapshot's existing raw-payload storage has sufficient fidelity — e.g., multipart part boundaries, exact original byte encoding — to ever fully back a CMP-017/018 raw-Detail feature) is explicitly still open per AnD DB v0.3 §10.1; this domain's schema does not attempt to answer it, since Snapshot's storage is Group 5's responsibility.
4. **Retention/archive/anonymize policy** for the 5 new tables (how long `comparison_findings`/`comparison_attempts` history is kept) is explicitly a data-owner/ops decision (G6/DB-DECISION-01 in the Handoff doc) — `onDelete: Restrict` on every FK is the only decision made in this pass (no auto-delete), and no retention/archival mechanism has been added.

---

Both As-Built documents (this one and `Group_6_7_AsBuilt_API_Design.md`) are now complete and internally consistent with each other and with the verified test/build state (159/159 Comparison tests, 468/468 full-suite tests, clean typecheck, clean build — see API doc §0).
