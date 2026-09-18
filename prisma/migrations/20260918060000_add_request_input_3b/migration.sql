-- Group 3B — Request Input implementation.
-- Additive migration only — prior migrations (20260911192701_init_user_auth,
-- 20260914180000_add_account_status_check,
-- 20260916031150_add_project_status_and_audit_logs,
-- 20260917040000_add_api_environment_core_3a) are NOT modified.
--
-- Source of truth: document/database/AnD_Database_Request_Input_3B.docx
-- (status: FINAL/FROZEN DB baseline) and document/database/Database_Standard_v2.0.docx.
--
-- Base SQL generated via `prisma migrate diff --from-config-datasource
-- --to-schema prisma/schema.prisma --script` against the live dev database,
-- then hand-adjusted to add what Prisma's declarative schema cannot express:
--   1. Two differently-cased partial/functional unique indexes on
--      request_parameter_definitions to satisfy DB-3B-PAR-01..04: QUERY
--      parameter names are unique per API case-sensitively; HEADER parameter
--      names are unique per API case-insensitively; the same spelling may be
--      used once as QUERY and once as HEADER because location is part of the
--      uniqueness boundary. A single Prisma `@@unique` cannot express two
--      different case sensitivities scoped by a discriminator column.
--   2. Raw SQL CHECK constraints (ck_request_parameter_definitions_location,
--      ck_request_body_definitions_body_type), named per
--      Database_Standard_v2.0.docx Section 15: ck_<table>_<column> — same
--      pattern as the four prior migrations.
--
-- No Path Parameter table is created (frozen Section 5 / DB-3B-PAR
-- decisions): api_configurations.path remains the sole source of truth for
-- Path Parameters — persisting a derived copy would create a duplicate
-- source of truth and an orphan/synchronization risk.
--
-- No column is added to api_environment_configs.full_url in this migration.
-- The frozen AnD (Section 10/16) confirms the "no query/fragment in
-- configured Full URL" rule is enforced at API/application layer in 3B —
-- datatype/column is unchanged and the already-applied 3A migration is not
-- edited. Pre-migration data was inspected: the current local dev database
-- has 1 api_environment_configs row and its full_url contains neither a
-- query component nor a fragment, so no existing row would violate this
-- validation semantics once the application-layer rule is enforced.
--
-- FK delete behavior is RESTRICT (not CASCADE), consistent with 3A: API rows
-- are soft-deleted, and losing Request Input Definition rows as a side
-- effect of any hard delete is not part of the frozen lifecycle design.

-- CreateTable
CREATE TABLE "request_parameter_definitions" (
    "request_parameter_definition_id" UUID NOT NULL,
    "api_id" UUID NOT NULL,
    "location" VARCHAR(20) NOT NULL,
    "parameter_name" VARCHAR(255) NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT,

    CONSTRAINT "request_parameter_definitions_pkey" PRIMARY KEY ("request_parameter_definition_id")
);

-- CreateTable
CREATE TABLE "request_body_definitions" (
    "request_body_definition_id" UUID NOT NULL,
    "api_id" UUID NOT NULL,
    "body_type" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT,

    CONSTRAINT "request_body_definitions_pkey" PRIMARY KEY ("request_body_definition_id")
);

-- CreateIndex
CREATE INDEX "idx_request_parameter_definitions_api_id_location" ON "request_parameter_definitions"("api_id", "location");

-- CreateIndex
CREATE UNIQUE INDEX "request_body_definitions_api_id_key" ON "request_body_definitions"("api_id");

-- AddForeignKey
ALTER TABLE "request_parameter_definitions" ADD CONSTRAINT "request_parameter_definitions_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_body_definitions" ADD CONSTRAINT "request_body_definitions_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manually added raw SQL constraints (Prisma's declarative schema cannot
-- express partial/functional unique indexes or CHECK constraints). Naming
-- per Database_Standard_v2.0.docx Section 15: ck_<table>_<column>.

-- CreateCaseSensitiveUniqueIndex: QUERY parameter name unique per API,
-- case-sensitive (DB-3B-PAR-01/02).
CREATE UNIQUE INDEX "ux_request_parameter_definitions_query" ON "request_parameter_definitions"("api_id", "parameter_name") WHERE "location" = 'QUERY';

-- CreateCaseInsensitiveUniqueIndex: HEADER parameter name unique per API,
-- case-insensitive — HTTP header names are treated case-insensitively
-- (DB-3B-PAR-03).
CREATE UNIQUE INDEX "ux_request_parameter_definitions_header_ci" ON "request_parameter_definitions"("api_id", LOWER("parameter_name")) WHERE "location" = 'HEADER';

-- CreateCheckConstraint
ALTER TABLE "request_parameter_definitions" ADD CONSTRAINT "ck_request_parameter_definitions_location" CHECK ("location" IN ('QUERY', 'HEADER'));

-- CreateCheckConstraint
ALTER TABLE "request_body_definitions" ADD CONSTRAINT "ck_request_body_definitions_body_type" CHECK ("body_type" IN ('JSON'));
