-- Group 5 — Snapshot & History implementation.
-- Additive migration only — prior migrations (20260911192701_init_user_auth,
-- 20260914180000_add_account_status_check,
-- 20260916031150_add_project_status_and_audit_logs,
-- 20260917040000_add_api_environment_core_3a,
-- 20260918060000_add_request_input_3b,
-- 20260921120000_add_authentication_3c,
-- 20260923140000_add_group_run) are NOT modified.
--
-- Source of truth: document/database/AnD_Database_Group_5_Snapshot_FINAL.docx
-- and REQ-SNP-001..008 (BA FINAL / Client Confirmed as applicable).
--
-- Base SQL hand-authored directly from prisma/schema.prisma (same structural
-- shape `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma --script` would produce against the live dev
-- database), then extended with what Prisma's declarative schema cannot
-- express:
--   1. Raw SQL CHECK constraints (ck_snapshots_auth_type,
--      ck_snapshots_http_status_code, ck_snapshots_response_completeness,
--      ck_snapshots_execution_outcome, ck_snapshot_save_attempts_attempt_status),
--      named per Database_Standard_v2.0.docx Section 15: ck_<table>_<column> —
--      same pattern as the six prior migrations.
--   2. ck_snapshots_http_status_code restricts to NULL or 200-299: a Snapshot
--      is only ever created for a strictly-2xx-eligible Execution
--      (REQ-SNP-001/004/006) — narrower than run_executions.execution_outcome's
--      broader RESPONSE_RECEIVED bucket, which also includes 3xx. This is a
--      redundant-by-design DB-level guarantee of an already-enforced
--      application rule, not a new business rule.
--   3. ck_snapshots_execution_outcome reuses run_executions' exact
--      execution_outcome value list (ck_run_executions_execution_outcome) —
--      a Snapshot's outcome is always RESPONSE_RECEIVED in practice (2xx-only
--      eligibility), but the full domain is kept for consistency with the
--      source column it copies from.
--
-- uq_snapshots_run_execution_id is the DB-level guarantee that at most one
-- Snapshot exists per API Execution (REQ-SNP-006 RS-SNP-006-05 Execution
-- Uniqueness). snapshot_payloads has no independent unique constraint beyond
-- its shared primary key (true 1:1 with snapshots) — it is written in the
-- same transaction as its parent snapshots row, so a Snapshot is never
-- recognized complete without its payload (SNP-004 BR-06 / EXC-02).
--
-- No `updated_at` column on any of the four new tables — all are
-- immutable/append-only once written (no application Update/Delete), same
-- convention as audit_logs.
--
-- FK delete behavior is RESTRICT (not CASCADE) throughout, consistent with
-- 3A/3B/3C/Run: Snapshot history must never be lost as a side effect of a
-- hard delete elsewhere (REQ-SNP-005 RS-SNP-005-05 Lifecycle Preservation,
-- BR-SNP-005-05 no cascade/orphan/reparent).
--
-- authentication_configurations gains context_version (Group 5 Q5 answer): a
-- stable identity/access-scope version, incremented on identity/access
-- change but not on same-identity credential rotation. It is copied onto
-- each Snapshot as auth_context_version at creation time and used (together
-- with api_id, environment_id, auth_type and a non-secret identity
-- discriminator) to compute the auth_context_key fingerprint frozen onto
-- that Snapshot — never the token/password value itself, and never rewritten
-- on past Snapshots when context_version later increments.

-- AlterTable
ALTER TABLE "authentication_configurations" ADD COLUMN "context_version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "snapshots" (
    "snapshot_id" UUID NOT NULL,
    "run_execution_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "api_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "project_name_at_execution" VARCHAR(255) NOT NULL,
    "api_name_at_execution" VARCHAR(255) NOT NULL,
    "environment_name_at_execution" VARCHAR(100) NOT NULL,
    "auth_type" VARCHAR(20) NOT NULL,
    "auth_context_version" INTEGER NOT NULL,
    "auth_identity_label" VARCHAR(255),
    "auth_context_key" VARCHAR(64) NOT NULL,
    "initiated_by_user_id" UUID NOT NULL,
    "initiated_by_label" VARCHAR(320) NOT NULL,
    "http_method" VARCHAR(10) NOT NULL,
    "request_url" VARCHAR(4096) NOT NULL,
    "request_content_type" VARCHAR(255),
    "request_body_size_bytes" INTEGER,
    "http_status_code" INTEGER,
    "response_content_type" VARCHAR(255),
    "response_body_size_bytes" INTEGER,
    "response_completeness" VARCHAR(20) NOT NULL,
    "content_range_header" VARCHAR(255),
    "requested_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ NOT NULL,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "api_version" VARCHAR(100) NOT NULL,
    "database_version" VARCHAR(100) NOT NULL,
    "execution_outcome" VARCHAR(20) NOT NULL,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "snapshot_payloads" (
    "snapshot_id" UUID NOT NULL,
    "request_body" BYTEA,
    "response_body" BYTEA,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshot_payloads_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "snapshot_invalidations" (
    "invalidation_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "invalidated_by_user_id" UUID NOT NULL,
    "invalidated_by_label" VARCHAR(320) NOT NULL,
    "invalidated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshot_invalidations_pkey" PRIMARY KEY ("invalidation_id")
);

-- CreateTable
CREATE TABLE "snapshot_save_attempts" (
    "attempt_id" UUID NOT NULL,
    "run_execution_id" UUID NOT NULL,
    "attempt_status" VARCHAR(20) NOT NULL,
    "error_reason_code" VARCHAR(50),
    "error_detail" TEXT,
    "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshot_save_attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_snapshots_run_execution_id" ON "snapshots"("run_execution_id");

-- CreateIndex
CREATE INDEX "idx_snapshots_scope_completed_at" ON "snapshots"("api_id", "environment_id", "auth_context_key", "completed_at");

-- CreateIndex
CREATE INDEX "idx_snapshots_run_id" ON "snapshots"("run_id");

-- CreateIndex
CREATE INDEX "idx_snapshots_project_created_at" ON "snapshots"("project_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_snapshot_invalidations_snapshot_id" ON "snapshot_invalidations"("snapshot_id");

-- CreateIndex
CREATE INDEX "idx_snapshot_save_attempts_execution_time" ON "snapshot_save_attempts"("run_execution_id", "attempted_at");

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_run_execution_id_fkey" FOREIGN KEY ("run_execution_id") REFERENCES "run_executions"("run_execution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_payloads" ADD CONSTRAINT "snapshot_payloads_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_invalidations" ADD CONSTRAINT "snapshot_invalidations_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "snapshots"("snapshot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_invalidations" ADD CONSTRAINT "snapshot_invalidations_invalidated_by_user_id_fkey" FOREIGN KEY ("invalidated_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_save_attempts" ADD CONSTRAINT "snapshot_save_attempts_run_execution_id_fkey" FOREIGN KEY ("run_execution_id") REFERENCES "run_executions"("run_execution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manually added raw SQL constraints (Prisma's declarative schema cannot
-- express CHECK constraints). Naming per Database_Standard_v2.0.docx
-- Section 15: ck_<table>_<column>.

-- CreateCheckConstraint
ALTER TABLE "snapshots" ADD CONSTRAINT "ck_snapshots_auth_type" CHECK ("auth_type" IN ('NONE', 'LOGIN_FORM', 'BEARER_TOKEN'));

-- CreateCheckConstraint: a Snapshot is only ever created for a strictly
-- 2xx-eligible Execution (REQ-SNP-001/004/006) — narrower than
-- run_executions.http_status, which has no such restriction.
ALTER TABLE "snapshots" ADD CONSTRAINT "ck_snapshots_http_status_code" CHECK ("http_status_code" IS NULL OR ("http_status_code" >= 200 AND "http_status_code" < 300));

-- CreateCheckConstraint: FULL for an ordinary complete response body,
-- PARTIAL_206 for an eligible HTTP 206 range response (REQ-SNP-004
-- RS-SNP-004-12) — never presented as the full resource.
ALTER TABLE "snapshots" ADD CONSTRAINT "ck_snapshots_response_completeness" CHECK ("response_completeness" IN ('FULL', 'PARTIAL_206'));

-- CreateCheckConstraint: reuses run_executions' execution_outcome domain
-- (ck_run_executions_execution_outcome) since this column copies that
-- source value; in practice always RESPONSE_RECEIVED given 2xx-only
-- Snapshot eligibility.
ALTER TABLE "snapshots" ADD CONSTRAINT "ck_snapshots_execution_outcome" CHECK ("execution_outcome" IN ('RESPONSE_RECEIVED', 'RUN_ERROR', 'SKIPPED'));

-- CreateCheckConstraint
ALTER TABLE "snapshot_save_attempts" ADD CONSTRAINT "ck_snapshot_save_attempts_attempt_status" CHECK ("attempt_status" IN ('SUCCEEDED', 'FAILED'));
