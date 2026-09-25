-- Group 6/7 — Comparison implementation.
-- Additive migration only — prior migrations (20260911192701_init_user_auth,
-- 20260914180000_add_account_status_check,
-- 20260916031150_add_project_status_and_audit_logs,
-- 20260917040000_add_api_environment_core_3a,
-- 20260918060000_add_request_input_3b,
-- 20260921120000_add_authentication_3c,
-- 20260923140000_add_group_run,
-- 20260924120000_add_group_5_snapshot,
-- 20260924130000_add_snapshot_headers) are NOT modified.
--
-- Source of truth: document/database/AnD_Database_Group_6_7_Comparison_v0.3.md
-- and REQ-CMP-001..018, REQ-ENV-004, REQ-OUT-002 (BA FINAL / Client
-- Confirmed as applicable). AnD Section 9 states "Chưa phát hành DDL/
-- migration ở phiên bản 0.3" — this migration is the first physical
-- release of that logical design, hand-authored directly from
-- prisma/schema.prisma (same structural shape `prisma migrate diff
-- --from-config-datasource --to-schema prisma/schema.prisma --script`
-- would produce against the live dev database), then extended with what
-- Prisma's declarative schema cannot express (raw CHECK constraints, one
-- partial unique index) — same pattern as the two Group 5 migrations.
--
-- Scope of this migration:
--   1. run_executions gains 3 columns (AnD Section 4.1): baseline_snapshot_id
--      / baseline_selected_at record the baseline Snapshot chosen right
--      before dispatch (CMP-003/013) — chosen once, never reselected, NULL
--      when no baseline was available at Execution time (never fabricated).
--      comparison_availability_reason_code records Execution-level
--      Comparison availability only (NO_BASELINE | NO_NEW_SNAPSHOT), never a
--      Comparison Result, and NULL whenever both a baseline and an eligible
--      target Snapshot exist.
--   2. Five new tables (AnD Sections 4.2–4.6): comparison_chains,
--      comparisons, comparison_attempts, comparison_findings,
--      comparison_classification_events.
--
-- Key DB-level decisions (see prisma/schema.prisma doc comments for full
-- per-column rationale):
--   - ck_comparisons_baseline_target_distinct guarantees Snapshot A (baseline)
--     and Snapshot B (target) of a pair are never the same Snapshot.
--   - comparisons.project_id/api_id/environment_id describe Snapshot A's
--     scope only (RS-CMP-016-01) and are NOT CHECK-constrained to match
--     Snapshot B's scope: a scope-mismatched pair must still persist as
--     BLOCKED with a reason on its ComparisonAttempt rather than be rejected
--     at insert (CMP-005/014/016). This is a deliberate omission, not an
--     oversight.
--   - uq_comparisons_source_execution_id is a plain UNIQUE constraint, not a
--     raw partial index: PostgreSQL already treats multiple NULLs in a
--     UNIQUE column as distinct, which is sufficient to express "required
--     and unique for AUTO_EXECUTION, NULL for every other source_kind"
--     together with ck_comparisons_source_execution_id.
--   - uq_comparison_attempts_completed_per_comparison IS a raw partial
--     unique index (`WHERE processing_status = 'COMPLETED'`), because the
--     at-most-one-COMPLETED-attempt rule is a partial condition on a
--     non-unique-domain column — Prisma's declarative schema cannot express
--     this, so it is added here only (not in schema.prisma), following the
--     existing ux_api_configurations_active precedent.
--   - comparison_attempts.stopped_at_gate uses explicit tokens (ELIGIBILITY |
--     INPUT | OUTPUT | PERSISTENCE) as a Design Proposal: AnD Section 4.4
--     names 4 gate concepts but does not freeze exact tokens.
--   - comparison_attempts.applied_rule_manifest is a free-form JSONB
--     snapshot of the rule/version/policy/exclusion/representation boundary
--     applied at that attempt (CMP-006/007/008/016/017/018). No policy/
--     rule-version master table exists anywhere in this repo yet
--     (DB-VERIFY-03) — the application is expected to write a hardcoded
--     default manifest here until such a table exists. Documented known
--     limitation, not modeled as a FK.
--   - comparison_findings.a_value_kind / b_value_kind / rule_code have no
--     CHECK constraint: AnD lists their domains as open-ended / non-
--     exhaustive (Section 4.5), the same "taxonomy not yet frozen" precedent
--     already used for audit_logs.event_type.
--   - comparison_findings never stores raw value_a/value_b bytes — only
--     path/offset/length/kind and a redacted safe_summary — so Detail
--     content is always re-derived from Snapshot via a permission-checked
--     backend, never duplicated here (CMP-015/017/018).
--
-- No `updated_at` column on any of the five new tables — all are
-- immutable/append-only once written (no application Update/Delete), same
-- convention as audit_logs and every Group 5 Snapshot table.
--
-- FK delete behavior is RESTRICT (not CASCADE) throughout, consistent with
-- 3A/3B/3C/Run/Snapshot: Comparison history must never be lost as a side
-- effect of a hard delete elsewhere.

-- AlterTable
ALTER TABLE "run_executions" ADD COLUMN "baseline_snapshot_id" UUID;
ALTER TABLE "run_executions" ADD COLUMN "baseline_selected_at" TIMESTAMPTZ;
ALTER TABLE "run_executions" ADD COLUMN "comparison_availability_reason_code" VARCHAR(32);

-- CreateTable
CREATE TABLE "comparison_chains" (
    "comparison_chain_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "api_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "comparison_chains_pkey" PRIMARY KEY ("comparison_chain_id")
);

-- CreateTable
CREATE TABLE "comparisons" (
    "comparison_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "api_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "baseline_snapshot_id" UUID NOT NULL,
    "target_snapshot_id" UUID NOT NULL,
    "source_kind" VARCHAR(32) NOT NULL,
    "source_execution_id" UUID,
    "comparison_chain_id" UUID,
    "pair_ordinal" INTEGER,
    "requested_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "comparisons_pkey" PRIMARY KEY ("comparison_id")
);

-- CreateTable
CREATE TABLE "comparison_attempts" (
    "comparison_attempt_id" UUID NOT NULL,
    "comparison_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "processing_status" VARCHAR(20) NOT NULL,
    "stopped_at_gate" VARCHAR(20),
    "reason_code" VARCHAR(40),
    "reason_detail_safe" TEXT,
    "input_check_outcome" VARCHAR(20),
    "comparison_result" VARCHAR(20),
    "applied_rule_manifest" JSONB,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_attempts_pkey" PRIMARY KEY ("comparison_attempt_id")
);

-- CreateTable
CREATE TABLE "comparison_findings" (
    "comparison_finding_id" UUID NOT NULL,
    "comparison_attempt_id" UUID NOT NULL,
    "phase" VARCHAR(20) NOT NULL,
    "component" VARCHAR(32) NOT NULL,
    "finding_ordinal" INTEGER NOT NULL,
    "difference_kind" VARCHAR(32) NOT NULL,
    "location_path" TEXT,
    "a_byte_offset" BIGINT,
    "b_byte_offset" BIGINT,
    "a_byte_length" BIGINT,
    "b_byte_length" BIGINT,
    "a_value_kind" VARCHAR(20),
    "b_value_kind" VARCHAR(20),
    "rule_code" VARCHAR(60) NOT NULL,
    "safe_summary" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_findings_pkey" PRIMARY KEY ("comparison_finding_id")
);

-- CreateTable
CREATE TABLE "comparison_classification_events" (
    "comparison_classification_event_id" UUID NOT NULL,
    "comparison_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "classification" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "classified_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_classification_events_pkey" PRIMARY KEY ("comparison_classification_event_id")
);

-- CreateIndex
CREATE INDEX "idx_run_executions_baseline_snapshot_id" ON "run_executions"("baseline_snapshot_id");

-- CreateIndex
CREATE INDEX "idx_comparison_chains_project_id_created_at" ON "comparison_chains"("project_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_comparisons_source_execution_id" ON "comparisons"("source_execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comparisons_chain_id_pair_ordinal" ON "comparisons"("comparison_chain_id", "pair_ordinal");

-- CreateIndex
CREATE INDEX "idx_comparisons_baseline_snapshot_id" ON "comparisons"("baseline_snapshot_id");

-- CreateIndex
CREATE INDEX "idx_comparisons_target_snapshot_id" ON "comparisons"("target_snapshot_id");

-- CreateIndex
CREATE INDEX "idx_comparisons_project_id_api_id_created_at" ON "comparisons"("project_id", "api_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_comparison_attempts_comparison_id_attempt_number" ON "comparison_attempts"("comparison_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comparison_findings_attempt_id_phase_finding_ordinal" ON "comparison_findings"("comparison_attempt_id", "phase", "finding_ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comparison_classification_events_comparison_id_revision" ON "comparison_classification_events"("comparison_id", "revision");

-- AddForeignKey
ALTER TABLE "run_executions" ADD CONSTRAINT "run_executions_baseline_snapshot_id_fkey" FOREIGN KEY ("baseline_snapshot_id") REFERENCES "snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_chains" ADD CONSTRAINT "comparison_chains_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_chains" ADD CONSTRAINT "comparison_chains_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_chains" ADD CONSTRAINT "comparison_chains_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_chains" ADD CONSTRAINT "comparison_chains_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_baseline_snapshot_id_fkey" FOREIGN KEY ("baseline_snapshot_id") REFERENCES "snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_target_snapshot_id_fkey" FOREIGN KEY ("target_snapshot_id") REFERENCES "snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_source_execution_id_fkey" FOREIGN KEY ("source_execution_id") REFERENCES "run_executions"("run_execution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_comparison_chain_id_fkey" FOREIGN KEY ("comparison_chain_id") REFERENCES "comparison_chains"("comparison_chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "comparison_attempts_comparison_id_fkey" FOREIGN KEY ("comparison_id") REFERENCES "comparisons"("comparison_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_findings" ADD CONSTRAINT "comparison_findings_comparison_attempt_id_fkey" FOREIGN KEY ("comparison_attempt_id") REFERENCES "comparison_attempts"("comparison_attempt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_classification_events" ADD CONSTRAINT "comparison_classification_events_comparison_id_fkey" FOREIGN KEY ("comparison_id") REFERENCES "comparisons"("comparison_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_classification_events" ADD CONSTRAINT "comparison_classification_events_classified_by_fkey" FOREIGN KEY ("classified_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manually added raw SQL constraints (Prisma's declarative schema cannot
-- express CHECK constraints or partial indexes). Naming per
-- Database_Standard_v2.0.docx Section 15: ck_<table>_<column>.

-- CreateCheckConstraint
ALTER TABLE "run_executions" ADD CONSTRAINT "ck_run_executions_comparison_availability_reason_code" CHECK ("comparison_availability_reason_code" IS NULL OR "comparison_availability_reason_code" IN ('NO_BASELINE', 'NO_NEW_SNAPSHOT'));

-- CreateCheckConstraint
ALTER TABLE "comparisons" ADD CONSTRAINT "ck_comparisons_source_kind" CHECK ("source_kind" IN ('AUTO_EXECUTION', 'MANUAL_PAIR', 'BASELINE_LATEST', 'CHAIN_PAIR'));

-- CreateCheckConstraint: Snapshot A (baseline) and Snapshot B (target) of a
-- pair are never the same Snapshot.
ALTER TABLE "comparisons" ADD CONSTRAINT "ck_comparisons_baseline_target_distinct" CHECK ("baseline_snapshot_id" <> "target_snapshot_id");

-- CreateCheckConstraint: required and unique for AUTO_EXECUTION only (paired
-- with uq_comparisons_source_execution_id, which relies on PostgreSQL
-- treating multiple NULLs as distinct), NULL for every other source_kind.
ALTER TABLE "comparisons" ADD CONSTRAINT "ck_comparisons_source_execution_id" CHECK (
    ("source_kind" = 'AUTO_EXECUTION' AND "source_execution_id" IS NOT NULL)
    OR ("source_kind" <> 'AUTO_EXECUTION' AND "source_execution_id" IS NULL)
);

-- CreateCheckConstraint: required together for CHAIN_PAIR only, NULL
-- together otherwise.
ALTER TABLE "comparisons" ADD CONSTRAINT "ck_comparisons_chain_fields" CHECK (
    ("source_kind" = 'CHAIN_PAIR' AND "comparison_chain_id" IS NOT NULL AND "pair_ordinal" IS NOT NULL)
    OR ("source_kind" <> 'CHAIN_PAIR' AND "comparison_chain_id" IS NULL AND "pair_ordinal" IS NULL)
);

-- CreateCheckConstraint
ALTER TABLE "comparisons" ADD CONSTRAINT "ck_comparisons_pair_ordinal" CHECK ("pair_ordinal" IS NULL OR "pair_ordinal" > 0);

-- CreateCheckConstraint
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_processing_status" CHECK ("processing_status" IN ('QUEUED', 'RUNNING', 'BLOCKED', 'FAILED', 'COMPLETED'));

-- CreateCheckConstraint: Design Proposal — AnD Section 4.4 names the 4 gate
-- concepts (eligibility/input/output/persistence) without freezing tokens.
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_stopped_at_gate" CHECK ("stopped_at_gate" IS NULL OR "stopped_at_gate" IN ('ELIGIBILITY', 'INPUT', 'OUTPUT', 'PERSISTENCE'));

-- CreateCheckConstraint: reason_code domain per AnD Section 5. NO_BASELINE /
-- NO_NEW_SNAPSHOT are run_executions.comparison_availability_reason_code
-- values only, never valid here.
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_reason_code" CHECK ("reason_code" IS NULL OR "reason_code" IN ('CONTEXT_MISMATCH', 'ENVIRONMENT_MISMATCH', 'AUTH_CONTEXT_UNKNOWN', 'SNAPSHOT_INVALIDATED', 'SNAPSHOT_INCOMPLETE', 'INPUT_MISMATCH', 'UNSUPPORTED_FORMAT', 'UNSUPPORTED_ENCODING', 'PAYLOAD_UNAVAILABLE', 'ENGINE_ERROR', 'PERSISTENCE_ERROR'));

-- CreateCheckConstraint
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_input_check_outcome" CHECK ("input_check_outcome" IS NULL OR "input_check_outcome" IN ('COMPATIBLE', 'MISMATCH'));

-- CreateCheckConstraint
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_comparison_result" CHECK ("comparison_result" IS NULL OR "comparison_result" IN ('SAME', 'DIFFERENT'));

-- CreateCheckConstraint: COMPLETED always carries a SAME/DIFFERENT result;
-- every other status keeps comparison_result NULL.
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_completed_result" CHECK (
    ("processing_status" = 'COMPLETED' AND "comparison_result" IN ('SAME', 'DIFFERENT'))
    OR ("processing_status" <> 'COMPLETED' AND "comparison_result" IS NULL)
);

-- CreateCheckConstraint
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_attempt_number" CHECK ("attempt_number" > 0);

-- CreatePartialUniqueIndex: at most one COMPLETED attempt per Comparison.
-- This is a partial condition on a non-unique-domain column — Prisma's
-- declarative schema cannot express it, so it is added here only (not in
-- schema.prisma), following the existing ux_api_configurations_active
-- precedent.
CREATE UNIQUE INDEX "uq_comparison_attempts_completed_per_comparison" ON "comparison_attempts"("comparison_id") WHERE "processing_status" = 'COMPLETED';

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_phase" CHECK ("phase" IN ('INPUT', 'OUTPUT'));

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_component" CHECK ("component" IN ('METHOD', 'URL', 'REQUEST_HEADER', 'REQUEST_BODY', 'HTTP_STATUS', 'RESPONSE_HEADER', 'RESPONSE_BODY'));

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_difference_kind" CHECK ("difference_kind" IN ('PRESENCE', 'TYPE', 'VALUE', 'ORDER', 'LENGTH', 'RAW_BYTES'));

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_finding_ordinal" CHECK ("finding_ordinal" >= 0);

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_a_byte_offset" CHECK ("a_byte_offset" IS NULL OR "a_byte_offset" >= 0);

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_b_byte_offset" CHECK ("b_byte_offset" IS NULL OR "b_byte_offset" >= 0);

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_a_byte_length" CHECK ("a_byte_length" IS NULL OR "a_byte_length" >= 0);

-- CreateCheckConstraint
ALTER TABLE "comparison_findings" ADD CONSTRAINT "ck_comparison_findings_b_byte_length" CHECK ("b_byte_length" IS NULL OR "b_byte_length" >= 0);

-- CreateCheckConstraint
ALTER TABLE "comparison_classification_events" ADD CONSTRAINT "ck_comparison_classification_events_classification" CHECK ("classification" IN ('EXPECTED', 'UNEXPECTED'));

-- CreateCheckConstraint
ALTER TABLE "comparison_classification_events" ADD CONSTRAINT "ck_comparison_classification_events_revision" CHECK ("revision" > 0);
