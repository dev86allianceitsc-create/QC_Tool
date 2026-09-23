-- Group Run — Run Execution implementation.
-- Additive migration only — prior migrations (20260911192701_init_user_auth,
-- 20260914180000_add_account_status_check,
-- 20260916031150_add_project_status_and_audit_logs,
-- 20260917040000_add_api_environment_core_3a,
-- 20260918060000_add_request_input_3b,
-- 20260921120000_add_authentication_3c) are NOT modified.
--
-- Source of truth: document/requirement/04_Run (REQ-RUN-001..009, FINAL) and
-- document/database/AnD_Database_Group_Run Section 17 corrected schema
-- (DB-C01..C10 — treated as authoritative over the earlier uncorrected
-- section) and Database_Standard_v2.0.docx.
--
-- Base SQL hand-authored directly from prisma/schema.prisma (same structural
-- shape `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma --script` would produce against the live dev
-- database), then extended with what Prisma's declarative schema cannot
-- express:
--   1. Raw SQL CHECK constraints (ck_runs_run_type, ck_runs_run_status,
--      ck_run_executions_execution_status, ck_run_executions_execution_outcome,
--      ck_run_executions_skip_reason_code, ck_run_executions_error_reason_code,
--      ck_run_executions_response_body_kind,
--      ck_run_executions_execution_order), named per
--      Database_Standard_v2.0.docx Section 15: ck_<table>_<column> — same
--      pattern as the five prior migrations.
--   2. ck_run_executions_skip_reason_code allows MISSING_REQUIRED_INPUT as a
--      Design Proposal value: the business reason-code contract for the
--      "Batch required-input review/confirm skip" UX-agreed flow is not
--      finalized (DC-01, UI_Requirement_Mapping_Group_Run Section 6). The
--      only currently CONFIRMED trigger is MISSING_FULL_URL (REQ-RUN-001
--      RS-001-08). This CHECK may be narrowed/extended by a future
--      controlled migration once DC-01 is resolved — not a data migration,
--      just the allowed-values list.
--
-- Batch max-API-count (DB-C01) is intentionally NOT a DB CHECK — enforced at
-- application/service layer, consistent with the corrected Section 17.
--
-- No secret credential value is ever written here. request_*_safe /
-- response_*_safe columns hold only the already-redacted/masked trace
-- (REQ-RUN-008 RS-008-15); decrypting the real credential (credential-crypto.ts
-- decryptSecret) happens only in memory at dispatch time and is never
-- persisted.
--
-- FK delete behavior is RESTRICT (not CASCADE) throughout, consistent with
-- 3A/3B/3C: Run and RunExecution are immutable history once a row reaches a
-- terminal status, and losing that history as a side effect of any hard
-- delete elsewhere is not part of the frozen lifecycle design.

-- CreateTable
CREATE TABLE "runs" (
    "run_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "run_type" VARCHAR(20) NOT NULL,
    "run_status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "note" TEXT,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "run_executions" (
    "run_execution_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "api_id" UUID NOT NULL,
    "execution_order" INTEGER NOT NULL,
    "execution_status" VARCHAR(20) NOT NULL,
    "execution_outcome" VARCHAR(20),
    "skip_reason_code" VARCHAR(50),
    "error_reason_code" VARCHAR(50),
    "error_message_safe" TEXT,
    "api_version" VARCHAR(100) NOT NULL,
    "database_version" VARCHAR(100) NOT NULL,
    "request_method" VARCHAR(10),
    "request_url_safe" VARCHAR(4096),
    "request_query_safe" JSONB,
    "request_headers_safe" JSONB,
    "request_body_safe" TEXT,
    "request_content_type" VARCHAR(255),
    "request_sent_at" TIMESTAMPTZ,
    "http_status" INTEGER,
    "response_headers_safe" JSONB,
    "response_body_safe" TEXT,
    "response_content_type" VARCHAR(255),
    "response_body_kind" VARCHAR(20),
    "response_body_is_truncated" BOOLEAN NOT NULL,
    "response_body_size_bytes" INTEGER,
    "response_body_stored_bytes" INTEGER,
    "response_received_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,
    "note" TEXT,

    CONSTRAINT "run_executions_pkey" PRIMARY KEY ("run_execution_id")
);

-- CreateIndex
CREATE INDEX "idx_runs_project_id_created_at" ON "runs"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_run_executions_api_id_created_at" ON "run_executions"("api_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_run_executions_run_id_api_id" ON "run_executions"("run_id", "api_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_run_executions_run_id_execution_order" ON "run_executions"("run_id", "execution_order");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_executions" ADD CONSTRAINT "run_executions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_executions" ADD CONSTRAINT "run_executions_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manually added raw SQL constraints (Prisma's declarative schema cannot
-- express CHECK constraints). Naming per Database_Standard_v2.0.docx
-- Section 15: ck_<table>_<column>.

-- CreateCheckConstraint
ALTER TABLE "runs" ADD CONSTRAINT "ck_runs_run_type" CHECK ("run_type" IN ('SINGLE', 'BATCH'));

-- CreateCheckConstraint: Run/Batch-level rollup only — SKIPPED/NOT_EXECUTED
-- exist solely at the RunExecution level (REQ-RUN-007).
ALTER TABLE "runs" ADD CONSTRAINT "ck_runs_run_status" CHECK ("run_status" IN ('PENDING', 'RUNNING', 'COMPLETED', 'INTERRUPTED'));

-- CreateCheckConstraint
ALTER TABLE "run_executions" ADD CONSTRAINT "ck_run_executions_execution_order" CHECK ("execution_order" >= 1);

-- CreateCheckConstraint
ALTER TABLE "run_executions" ADD CONSTRAINT "ck_run_executions_execution_status" CHECK ("execution_status" IN ('PENDING', 'RUNNING', 'COMPLETED', 'SKIPPED', 'INTERRUPTED', 'NOT_EXECUTED'));

-- CreateCheckConstraint
ALTER TABLE "run_executions" ADD CONSTRAINT "ck_run_executions_execution_outcome" CHECK ("execution_outcome" IN ('RESPONSE_RECEIVED', 'RUN_ERROR', 'SKIPPED'));

-- CreateCheckConstraint: MISSING_FULL_URL is CONFIRMED (REQ-RUN-001
-- RS-001-08). MISSING_REQUIRED_INPUT is a Design Proposal — see header note;
-- DC-01 contract not finalized.
ALTER TABLE "run_executions" ADD CONSTRAINT "ck_run_executions_skip_reason_code" CHECK ("skip_reason_code" IN ('MISSING_FULL_URL', 'MISSING_REQUIRED_INPUT'));

-- CreateCheckConstraint: HTTP_ERROR covers HTTP 4xx/5xx (REQ-RUN-002); the
-- other five values cover transport failures with no HTTP response
-- (REQ-RUN-003).
ALTER TABLE "run_executions" ADD CONSTRAINT "ck_run_executions_error_reason_code" CHECK ("error_reason_code" IN ('TIMEOUT', 'DNS_ERROR', 'TLS_ERROR', 'CONNECTION_ERROR', 'UNKNOWN_EXECUTION_ERROR', 'HTTP_ERROR'));

-- CreateCheckConstraint: binary/file responses persist metadata only, never
-- the body (REQ-RUN-008 RS-008-18); JSON and other text are both TEXT
-- (BR-11).
ALTER TABLE "run_executions" ADD CONSTRAINT "ck_run_executions_response_body_kind" CHECK ("response_body_kind" IN ('TEXT', 'BINARY'));
