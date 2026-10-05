-- REVISION 3C-R02 — move Authentication from per-API+Environment to
-- per-Environment only, managed in Project Settings, with multiple named
-- Login Form Test Accounts. This deliberately reverses the credential
-- isolation boundary documented as REQ-SEC-002/REQ-AUTH-003 in the
-- 20260921120000_add_authentication_3c migration, per explicit new product
-- direction — Authentication is now shared by every API run against a given
-- Environment.
--
-- Dev-data note: Group 3C has not yet been approved, so this migration does
-- not attempt to preserve every API's distinct Authentication row. Where an
-- Environment currently has more than one differing row (one per API), only
-- the most-recently-updated row is kept; the rest are discarded as
-- acceptable dev-data churn.
--
-- Base SQL hand-authored directly from prisma/schema.prisma (same structural
-- shape `prisma migrate diff` would produce for the additive parts), plus
-- the destructive/data-migrating steps Prisma's schema diff cannot express.

-- Step 1: drop the old api_id-based FK/PK/CHECK before restructuring.
ALTER TABLE "authentication_configurations" DROP CONSTRAINT "authentication_configurations_api_id_fkey";
ALTER TABLE "authentication_configurations" DROP CONSTRAINT "authentication_configurations_environment_id_fkey";
ALTER TABLE "authentication_configurations" DROP CONSTRAINT "pk_authentication_configurations";
ALTER TABLE "authentication_configurations" DROP CONSTRAINT "ck_authentication_configurations_secret_exclusive";
DROP INDEX "idx_authentication_configurations_environment_id";

-- Step 2: collapse to at most one row per environment_id, keeping the
-- most-recently-updated row for any Environment that currently has more
-- than one (one per API) — see dev-data note above.
DELETE FROM "authentication_configurations"
WHERE ctid NOT IN (
    SELECT DISTINCT ON ("environment_id") ctid
    FROM "authentication_configurations"
    ORDER BY "environment_id", "updated_at" DESC, "api_id" DESC
);

-- Step 3: drop columns that no longer belong on this table — api_id (no
-- longer part of identity) and the LOGIN_FORM identity/secret (username,
-- password_*), which move to the new test_accounts table below.
ALTER TABLE "authentication_configurations" DROP COLUMN "api_id";
ALTER TABLE "authentication_configurations" DROP COLUMN "username";
ALTER TABLE "authentication_configurations" DROP COLUMN "password_ciphertext";
ALTER TABLE "authentication_configurations" DROP COLUMN "password_iv";
ALTER TABLE "authentication_configurations" DROP COLUMN "password_auth_tag";

-- Step 4: re-key on environment_id alone and restore the Environment FK.
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "pk_authentication_configurations" PRIMARY KEY ("environment_id");
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "authentication_configurations_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: test_accounts — named Login Form credentials saved per
-- Environment, selected by the user at Run time. Only meaningful while the
-- owning Environment's auth_type is LOGIN_FORM (application-enforced, not a
-- DB CHECK). Same AES-256-GCM at-rest scheme as the Bearer Token secret on
-- authentication_configurations.
CREATE TABLE "test_accounts" (
    "test_account_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "password_ciphertext" BYTEA NOT NULL,
    "password_iv" BYTEA NOT NULL,
    "password_auth_tag" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "test_accounts_pkey" PRIMARY KEY ("test_account_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_test_accounts_environment_id_label" ON "test_accounts"("environment_id", "label");

-- AddForeignKey
ALTER TABLE "test_accounts" ADD CONSTRAINT "test_accounts_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: runs — record which Test Account (if any) a Run used, for
-- history/audit display only. SetNull on delete so removing a Test Account
-- never blocks or rewrites a past Run.
ALTER TABLE "runs" ADD COLUMN "test_account_id" UUID;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_test_account_id_fkey" FOREIGN KEY ("test_account_id") REFERENCES "test_accounts"("test_account_id") ON DELETE SET NULL ON UPDATE CASCADE;
