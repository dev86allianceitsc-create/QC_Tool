-- Group 3A — API & Environment Core implementation.
-- Additive migration only — prior migrations (20260911192701_init_user_auth,
-- 20260914180000_add_account_status_check,
-- 20260916031150_add_project_status_and_audit_logs) are NOT modified.
--
-- Source of truth: document/database/AnD_Database_API_Environment_Core_3A.docx
-- (status: FINAL FOR 3A LOGICAL DESIGN) and document/database/Database_Standard_v2.0.docx.
--
-- Base SQL generated via `prisma migrate diff --from-config-datasource
-- --to-schema prisma/schema.prisma --script` against the live dev database,
-- then hand-adjusted to add what Prisma's declarative schema cannot express:
--   1. Partial unique index for active API identity (project_id, http_method,
--      path), scoped to deleted_at IS NULL — DEC-3A-DB-001 / REQ-FUN-002
--      FR-FUN-002-14/15/16: api_name is NOT part of the key, and a
--      soft-deleted row must not block reuse of the same Method+Path.
--   2. Case-insensitive-after-trim unique index for environment_name within
--      a Project — REQ-ENV-001 FR-ENV-001-05/06 — including INACTIVE rows
--      (application layer is responsible for trimming before persist; the
--      index itself only needs to fold case).
--   3. Raw SQL CHECK constraints (ck_api_configurations_creation_source,
--      ck_api_configurations_deleted_at, ck_environments_classification,
--      ck_environments_environment_status), named per
--      Database_Standard_v2.0.docx Section 15: ck_<table>_<column> — same
--      pattern as the three prior migrations. No CHECK is added for
--      http_method (no confirmed domain in the frozen AnD).
--
-- FK delete behavior is RESTRICT (not CASCADE) throughout, per the frozen
-- AnD's explicit instruction not to default to CASCADE where history must be
-- preserved (TBD-3A-DB-002 — exact downstream Run/Snapshot FK behavior is
-- deferred, but CASCADE is disallowed in the interim).

-- CreateTable
CREATE TABLE "api_configurations" (
    "api_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "api_name" VARCHAR(255) NOT NULL,
    "http_method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(2048) NOT NULL,
    "description" TEXT,
    "creation_source" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "note" TEXT,

    CONSTRAINT "api_configurations_pkey" PRIMARY KEY ("api_id")
);

-- CreateTable
CREATE TABLE "environments" (
    "environment_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_name" VARCHAR(100) NOT NULL,
    "classification" VARCHAR(20) NOT NULL,
    "allow_run" BOOLEAN NOT NULL,
    "environment_status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("environment_id")
);

-- CreateTable
CREATE TABLE "api_environment_configs" (
    "api_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "full_url" VARCHAR(4096) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT,

    CONSTRAINT "pk_api_environment_configs" PRIMARY KEY ("api_id","environment_id")
);

-- CreateIndex
CREATE INDEX "idx_api_configurations_project_deleted" ON "api_configurations"("project_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_environments_project_id" ON "environments"("project_id");

-- CreateIndex
CREATE INDEX "idx_api_environment_configs_environment_id" ON "api_environment_configs"("environment_id");

-- AddForeignKey
ALTER TABLE "api_configurations" ADD CONSTRAINT "api_configurations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_environment_configs" ADD CONSTRAINT "api_environment_configs_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_environment_configs" ADD CONSTRAINT "api_environment_configs_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manually added raw SQL constraints (Prisma's declarative schema cannot
-- express partial/functional unique indexes or CHECK constraints). Naming
-- per Database_Standard_v2.0.docx Section 15: ck_<table>_<column>.

-- CreatePartialUniqueIndex: active API identity = project + method + path,
-- excluding api_name, scoped to non-deleted rows only (DEC-3A-DB-001).
CREATE UNIQUE INDEX "ux_api_configurations_active" ON "api_configurations"("project_id", "http_method", "path") WHERE "deleted_at" IS NULL;

-- CreateCaseInsensitiveUniqueIndex: environment_name unique within a
-- Project, case-insensitive, including INACTIVE rows (REQ-ENV-001).
CREATE UNIQUE INDEX "ux_environments_project_name_ci" ON "environments"("project_id", LOWER("environment_name"));

-- CreateCheckConstraint
ALTER TABLE "api_configurations" ADD CONSTRAINT "ck_api_configurations_creation_source" CHECK ("creation_source" IN ('MANUAL', 'OPENAPI_IMPORT'));

-- CreateCheckConstraint
ALTER TABLE "api_configurations" ADD CONSTRAINT "ck_api_configurations_deleted_at" CHECK ("deleted_at" IS NULL OR "deleted_at" >= "created_at");

-- CreateCheckConstraint
ALTER TABLE "environments" ADD CONSTRAINT "ck_environments_classification" CHECK ("classification" IN ('PRODUCTION', 'NON_PRODUCTION'));

-- CreateCheckConstraint
ALTER TABLE "environments" ADD CONSTRAINT "ck_environments_environment_status" CHECK ("environment_status" IN ('ACTIVE', 'INACTIVE'));
