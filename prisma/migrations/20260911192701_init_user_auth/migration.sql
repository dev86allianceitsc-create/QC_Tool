-- Database Phase B — User & Authentication implementation.
-- Generated via `prisma migrate diff --from-empty --to-schema=prisma/schema.prisma --script`
-- (no live/shadow database connection was used — see prisma/migrations note).
-- Scope: users, user_sessions, projects, project_memberships ONLY. audit_logs excluded.
--
-- Raw SQL CHECK constraints below (3) were added manually per the approved task
-- instructions; they are NOT part of prisma/schema.prisma and will not be
-- reproduced by `prisma migrate diff` from the schema alone.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "google_subject_id" VARCHAR(255),
    "system_role" VARCHAR(20) NOT NULL,
    "account_status" VARCHAR(30) NOT NULL,
    "activated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revocation_reason" VARCHAR(255),
    "note" TEXT,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "projects" (
    "project_id" UUID NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "project_memberships" (
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "pk_project_memberships" PRIMARY KEY ("user_id","project_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_id_key" ON "users"("google_subject_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manually added raw SQL CHECK constraints (Task 6). Naming per
-- Database_Standard_v2.0.docx: ck_<table>_<column>.
-- Only these 3 constraints are confirmed; account_status CHECK, project_name
-- UNIQUE, and any audit-related constraint are intentionally NOT added (TBD).

-- CreateCheckConstraint
ALTER TABLE "users" ADD CONSTRAINT "ck_users_system_role" CHECK ("system_role" IN ('ADMIN', 'USER'));

-- CreateCheckConstraint
ALTER TABLE "user_sessions" ADD CONSTRAINT "ck_user_sessions_expires_at" CHECK ("expires_at" > "created_at");

-- CreateCheckConstraint
ALTER TABLE "user_sessions" ADD CONSTRAINT "ck_user_sessions_revoked_at" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at");
