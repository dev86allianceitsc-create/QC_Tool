-- Group 5 — Snapshot request/response headers (REQ-SNP-003 Section 5.C/5.D).
-- Additive-only migration on top of the already-applied
-- 20260924120000_add_group_5_snapshot migration, which is NOT modified.
--
-- AnD Database Group 5 Snapshot §4.1 lists request_headers/response_headers
-- as "Representation proposal" columns on `snapshots`, but the base Group 5
-- migration shipped without them (schema gap flagged during API-SNP-002
-- implementation). This migration closes that gap:
--   - request_headers stores the exact request headers sent on the wire at
--     dispatch time, UNMASKED — including the real Authorization value.
--     This is a deliberate divergence from run_executions.request_headers_safe
--     (which still masks Authorization, unchanged): Snapshot is scoped to
--     capture what was actually sent, not Run Result's redacted trace.
--   - response_headers stores the same unredacted shape as
--     run_executions.response_headers_safe.
-- Both are nullable JSONB with no default: any Snapshot created before this
-- migration keeps NULL for both columns (no backfill — there is no raw
-- header data left to recover for those historical rows).

-- AlterTable
ALTER TABLE "snapshots" ADD COLUMN "request_headers" JSONB;
ALTER TABLE "snapshots" ADD COLUMN "response_headers" JSONB;
