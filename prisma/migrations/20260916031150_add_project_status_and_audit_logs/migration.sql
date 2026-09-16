-- Database Phase C — Project Management & Audit Log implementation.
-- Additive migration only — prior migrations (20260911192701_init_user_auth,
-- 20260914180000_add_account_status_check) are NOT modified.
--
-- Source of truth: document/database/AnD_Database_Project_Audit.docx
-- (status: IMPLEMENTATION READY - reviewed and frozen for current scope) and
-- document/database/Database_Standard_v2.0.docx.
--
-- Base SQL generated via `prisma migrate diff --from-config-datasource
-- --to-schema prisma/schema.prisma --script` against the live dev database,
-- then hand-adjusted for two things Prisma's declarative schema/diff cannot
-- express:
--   1. Expand-contract the new NOT NULL projects.project_status column
--      (Database Standard v2.0 Section 28, "prefer expand-contract migration")
--      so the ALTER TABLE does not fail against already-seeded project rows:
--      add nullable, backfill existing rows to the ACTIVE initial business
--      value, then set NOT NULL. This is a one-time backfill for pre-existing
--      rows, not a SQL DEFAULT — new inserts must still set project_status
--      explicitly (Database AnD Section 4 Notes; Database Standard v2.0
--      Section 14), same pattern already used for users.account_status.
--   2. Raw SQL CHECK constraints (ck_projects_project_status,
--      ck_projects_deleted_at, ck_audit_logs_result), named per
--      Database_Standard_v2.0.docx Section 15: ck_<table>_<column> — same
--      pattern as the two prior migrations. No CHECK is added for
--      audit_logs.event_type (taxonomy not yet frozen, per explicit
--      instruction) and no index is created on audit_logs.result (per
--      explicit instruction).

-- AlterTable: projects — add description, project_status, deleted_at
ALTER TABLE "projects"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "project_status" VARCHAR(20),
  ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Backfill pre-existing rows to the ACTIVE initial business value before
-- the column is made NOT NULL (expand-contract; see header note).
UPDATE "projects" SET "project_status" = 'ACTIVE' WHERE "project_status" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "project_status" SET NOT NULL;

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "audit_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "result" VARCHAR(20) NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_display" VARCHAR(320),
    "target_type" VARCHAR(50),
    "target_id" VARCHAR(255),
    "target_display" VARCHAR(320),
    "project_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "request_id" VARCHAR(100),
    "detail" TEXT,
    "note" TEXT,

    CONSTRAINT "pk_audit_logs" PRIMARY KEY ("audit_id")
);

-- CreateIndex
CREATE INDEX "idx_audit_logs_occurred_at" ON "audit_logs"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_project_time" ON "audit_logs"("project_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor_time" ON "audit_logs"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_event_time" ON "audit_logs"("event_type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_project_memberships_project_id" ON "project_memberships"("project_id");

-- CreateIndex
CREATE INDEX "idx_projects_status_deleted" ON "projects"("project_status", "deleted_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_logs_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_logs_project_id" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manually added raw SQL CHECK constraints (Prisma's declarative schema
-- cannot express CHECK). Naming per Database_Standard_v2.0.docx Section 15:
-- ck_<table>_<column>.

-- CreateCheckConstraint
ALTER TABLE "projects" ADD CONSTRAINT "ck_projects_project_status" CHECK ("project_status" IN ('ACTIVE', 'INACTIVE'));

-- CreateCheckConstraint
ALTER TABLE "projects" ADD CONSTRAINT "ck_projects_deleted_at" CHECK ("deleted_at" IS NULL OR "deleted_at" >= "created_at");

-- CreateCheckConstraint
ALTER TABLE "audit_logs" ADD CONSTRAINT "ck_audit_logs_result" CHECK ("result" IN ('SUCCESS', 'FAILURE', 'DENIED'));
