-- Group 3C — Authentication & Version implementation.
-- Additive migration only — prior migrations (20260911192701_init_user_auth,
-- 20260914180000_add_account_status_check,
-- 20260916031150_add_project_status_and_audit_logs,
-- 20260917040000_add_api_environment_core_3a,
-- 20260918060000_add_request_input_3b) are NOT modified.
--
-- Source of truth: document/requirement/03_API_Configuration/3C_Authentication_Version
-- (REQ-SEC-002 CONFIRMED — credential isolation, Admin-only mutation, secret
-- masking; REQ-AUTH-001/002/003 REVISED DRAFT — LOGIN_FORM/BEARER_TOKEN field
-- contracts, per API x Environment scope, auth-type-change clears old
-- secret) and the approved implementation plan (2026-09-21, session
-- decisions: AES-256-GCM app-level encryption key; Login URL is
-- syntax-only-validated, no SSRF/private-IP blocking).
--
-- Base SQL generated via `prisma migrate diff --from-config-datasource
-- --to-schema prisma/schema.prisma --script` against the live dev database,
-- then hand-adjusted to add what Prisma's declarative schema cannot express:
--   1. Raw SQL CHECK constraint (ck_authentication_configurations_auth_type),
--      named per Database_Standard_v2.0.docx Section 15: ck_<table>_<column>
--      — same pattern as the four prior migrations.
--   2. A CHECK constraint (ck_authentication_configurations_secret_exclusive)
--      enforcing that the LOGIN_FORM password secret and the BEARER_TOKEN
--      secret are never populated at the same time — only the secret
--      belonging to the currently selected auth_type may be present
--      (REQ-AUTH-003 CL-3C-02: changing auth_type removes the old type's
--      credential in the same mutation).
--
-- No column stores a plaintext secret. password_ciphertext/iv/auth_tag and
-- bearer_token_ciphertext/iv/auth_tag hold AES-256-GCM output only; the key
-- lives outside the database (app-level CREDENTIAL_ENCRYPTION_KEY env var).
--
-- FK delete behavior is RESTRICT (not CASCADE), consistent with 3A/3B: API
-- and Environment rows are soft-deleted/lifecycle-managed, and losing
-- Authentication Configuration rows as a side effect of any hard delete is
-- not part of the frozen lifecycle design.

-- CreateTable
CREATE TABLE "authentication_configurations" (
    "api_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "auth_type" VARCHAR(20) NOT NULL,
    "login_url" VARCHAR(2048),
    "username" VARCHAR(255),
    "username_field" VARCHAR(100),
    "password_field" VARCHAR(100),
    "token_response_path" VARCHAR(200),
    "password_ciphertext" BYTEA,
    "password_iv" BYTEA,
    "password_auth_tag" BYTEA,
    "bearer_token_ciphertext" BYTEA,
    "bearer_token_iv" BYTEA,
    "bearer_token_auth_tag" BYTEA,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT,

    CONSTRAINT "pk_authentication_configurations" PRIMARY KEY ("api_id","environment_id")
);

-- CreateIndex
CREATE INDEX "idx_authentication_configurations_environment_id" ON "authentication_configurations"("environment_id");

-- AddForeignKey
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "authentication_configurations_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_configurations"("api_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "authentication_configurations_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("environment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manually added raw SQL constraints (Prisma's declarative schema cannot
-- express CHECK constraints). Naming per Database_Standard_v2.0.docx
-- Section 15: ck_<table>_<column>.

-- CreateCheckConstraint
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "ck_authentication_configurations_auth_type" CHECK ("auth_type" IN ('NONE', 'LOGIN_FORM', 'BEARER_TOKEN'));

-- CreateCheckConstraint: only the secret belonging to the currently selected
-- auth_type may be populated — password ciphertext and bearer token
-- ciphertext are mutually exclusive (REQ-AUTH-003 CL-3C-02).
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "ck_authentication_configurations_secret_exclusive" CHECK (NOT ("password_ciphertext" IS NOT NULL AND "bearer_token_ciphertext" IS NOT NULL));
