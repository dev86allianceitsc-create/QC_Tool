-- Output Ignore Rules.
-- Additive migration only — no prior migration is modified.
--
-- Source: user-specified feature scope, "Output Ignore Rules end-to-end",
-- continuing Phase 3 Comparison (Group 6/7). Hand-authored directly from
-- prisma/schema.prisma's new IgnoreRule model, same convention as
-- 20260925090000_add_comparison_group_6_7 and 20261001120000_add_test_case_identity.
--
-- Scope of this migration:
--   One new table: ignore_rules. Affects Comparison OUTPUT-gate body-diff
--   findings only (comparison_findings rows with a non-null location_path)
--   — never Test Case identity/test_case_key, request input, baseline
--   selection, Environment, authentication, or Test Account. Those remain
--   entirely owned by run_executions.test_case_key (20261001120000) and are
--   not referenced here.
--
-- Key DB-level decisions (see prisma/schema.prisma's IgnoreRule doc comment
-- for full per-column rationale):
--   - FK delete behavior is RESTRICT throughout, same convention as
--     20260925090000_add_comparison_group_6_7 ("Comparison history must
--     never be lost as a side effect of a hard delete elsewhere");
--     api_configurations rows are soft-deleted in normal operation
--     (deleted_at), so this rarely blocks anything in practice.
--   - uq_ignore_rules_api_id_path is a plain UNIQUE constraint on
--     (api_id, path), not a raw partial index: PostgreSQL already treats
--     multiple NULLs in a UNIQUE column as distinct, so PROJECT-scope rows
--     (api_id NULL) never collide with each other under this constraint —
--     it only dedups API-scoped rules.
--   - ux_ignore_rules_project_scope_path IS a raw partial unique index
--     (`WHERE scope = 'PROJECT'`), because PROJECT-scope dedup is a partial
--     condition Prisma's declarative schema cannot express — added here
--     only (not in schema.prisma), following the existing
--     ux_api_configurations_active precedent.
--   - ck_ignore_rules_scope_api_id enforces scope='API' <=> api_id NOT NULL
--     (and therefore scope='PROJECT' <=> api_id IS NULL) at the DB level,
--     not just in application code.

-- CreateTable
CREATE TABLE "ignore_rules" (
    "ignore_rule_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "api_id" UUID,
    "scope" VARCHAR(20) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ignore_rules_pkey" PRIMARY KEY ("ignore_rule_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_ignore_rules_api_id_path" ON "ignore_rules"("api_id", "path");

-- CreateIndex
CREATE INDEX "idx_ignore_rules_project_scope_enabled" ON "ignore_rules"("project_id", "scope", "enabled");

-- CreateIndex
CREATE INDEX "idx_ignore_rules_api_id_enabled" ON "ignore_rules"("api_id", "enabled");

-- CreateIndex: PROJECT-scope duplicate prevention (api_id is always NULL for
-- these rows — see ck_ignore_rules_scope_api_id below — so the WHERE clause
-- doubles as "this row is PROJECT-scoped").
CREATE UNIQUE INDEX "ux_ignore_rules_project_scope_path" ON "ignore_rules"("project_id", "path") WHERE "scope" = 'PROJECT';

-- AddForeignKey
ALTER TABLE "ignore_rules" ADD CONSTRAINT "ignore_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignore_rules" ADD CONSTRAINT "ignore_rules_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignore_rules" ADD CONSTRAINT "fk_ignore_rules_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manually added raw SQL constraints (Prisma's declarative schema cannot
-- express CHECK constraints or partial indexes). Naming per
-- Database_Standard_v2.0.docx Section 15: ck_<table>_<column>.

-- CreateCheckConstraint
ALTER TABLE "ignore_rules" ADD CONSTRAINT "ck_ignore_rules_scope" CHECK ("scope" IN ('API', 'PROJECT'));

-- CreateCheckConstraint: scope='API' requires api_id NOT NULL; scope='PROJECT'
-- requires api_id IS NULL.
ALTER TABLE "ignore_rules" ADD CONSTRAINT "ck_ignore_rules_scope_api_id" CHECK (
    ("scope" = 'API' AND "api_id" IS NOT NULL)
    OR ("scope" = 'PROJECT' AND "api_id" IS NULL)
);
