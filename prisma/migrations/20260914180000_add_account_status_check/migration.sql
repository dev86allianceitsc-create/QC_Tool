-- Additive migration only — the already-applied initial migration
-- (20260911192701_init_user_auth) is not modified.
--
-- Database AnD (document/database/AnD_Database.docx) Section 4.1 Column
-- Dictionary now marks the `account_status` domain as CONFIRMED:
--   Domain: INVITED, ACTIVE, INACTIVE, BLOCKED. CANCELLED is reviewed and not
--   approved in the current domain.
-- This adds the corresponding CHECK constraint, following the same naming
-- convention (ck_<table>_<column>) already used for ck_users_system_role in
-- the initial migration.

-- CreateCheckConstraint
ALTER TABLE "users" ADD CONSTRAINT "ck_users_account_status" CHECK ("account_status" IN ('INVITED', 'ACTIVE', 'INACTIVE', 'BLOCKED'));
