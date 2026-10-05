-- Phase 3 — Test Case History & Run Again.
-- Additive migration only — all prior migrations are NOT modified.
--
-- Introduces a derived Test Case Identity fingerprint (test_case_key =
-- sha256(apiId, environmentId, authType, testAccountId, normalized raw
-- Request Input) — see apps/api/src/modules/run/test-case-identity.util.ts)
-- frozen onto both run_executions and snapshots at dispatch/creation time.
-- Deliberately excludes auth_context_key/auth_context_version: an
-- Authentication Configuration edit or secret rotation must never silently
-- fork a user's continuous Test Case history. auth_context_key on snapshots
-- is unchanged and keeps serving Comparison eligibility/safety exactly as
-- today — test_case_key (identity/grouping, "is this the same test") and
-- auth_context_key (safety, "is this specific pair safe to compare") are
-- now two clearly separate concerns, never conflated.
--
-- Scope of this migration:
--   1. run_executions gains request_input_snapshot (raw submitted
--      CreateRunDto request values, frozen once at Run creation regardless
--      of eventual dispatch outcome — makes "Run Again" possible without
--      reconstructing input from the lossy, already-resolved trace
--      columns), auth_type + test_case_key (frozen at dispatch time, same
--      point request_trace is built; null for PENDING/SKIPPED/
--      INTERRUPTED/NOT_EXECUTED and for pre-migration rows), and
--      rerun_of_execution_id (self-relation, lineage/audit only — set
--      solely by the advanced "Re-run this execution" action, never by
--      ordinary Run Again, whose chaining is derived purely from
--      test_case_key).
--   2. snapshots gains test_account_id (captured from the same
--      DispatchRunContext.testAccountId used to freeze
--      run_executions.test_case_key — needed by the Comparison eligibility
--      Test-Account check, independent of test_case_key) and test_case_key
--      (frozen the same way as run_executions.test_case_key).
--   3. idx_snapshots_scope_completed_at (apiId, environmentId,
--      authContextKey, completedAt) is replaced by
--      idx_snapshots_test_case_key_completed_at (testCaseKey, completedAt
--      DESC): baseline selection (selectBaselineSnapshot) now scopes purely
--      by {projectId, testCaseKey}, with no authContextKey filter, so the
--      old composite index is unused by it.
--   4. ck_comparisons_source_kind widened to add RERUN_EXECUTION (the
--      advanced "Re-run this execution" action's own source_kind — ordinary
--      Run Again keeps using AUTO_EXECUTION, since it fires through the
--      same tryCreateAutomaticComparison call site as any fresh dispatch).
--   5. ck_comparison_attempts_reason_code widened to add
--      TEST_ACCOUNT_MISMATCH (ELIGIBILITY-stage, Login Form Test Account
--      revert) and CONFIG_DRIFT_DETECTED (INPUT-stage, used in place of
--      INPUT_MISMATCH specifically for AUTO_EXECUTION/RERUN_EXECUTION pairs
--      — those already share a test_case_key by construction, so a real
--      INPUT gate mismatch there means the resolved request drifted
--      despite identical raw input, never "different test case").
--
-- All new columns are nullable; no backfill is attempted for
-- request_input_snapshot/auth_type/test_case_key on existing rows — raw
-- input was never stored for pre-migration Executions, so a faithful
-- backfill is not possible, and a fabricated one would be worse than none.
-- Pre-migration Executions simply do not participate in the new Test Case
-- grouping/auto-chaining until they are run again post-migration.

-- AlterTable
ALTER TABLE "run_executions"
  ADD COLUMN "request_input_snapshot" JSONB,
  ADD COLUMN "auth_type" VARCHAR(20),
  ADD COLUMN "test_case_key" VARCHAR(64),
  ADD COLUMN "rerun_of_execution_id" UUID;

-- AlterTable
ALTER TABLE "snapshots"
  ADD COLUMN "test_account_id" UUID,
  ADD COLUMN "test_case_key" VARCHAR(64);

-- CreateIndex
CREATE INDEX "idx_run_executions_test_case_key_sent_at" ON "run_executions"("test_case_key", "request_sent_at" DESC);

-- DropIndex: superseded by idx_snapshots_test_case_key_completed_at —
-- baseline selection no longer filters by authContextKey (kept independent
-- of Test Case Identity, see header comment above).
DROP INDEX "idx_snapshots_scope_completed_at";

-- CreateIndex
CREATE INDEX "idx_snapshots_test_case_key_completed_at" ON "snapshots"("test_case_key", "completed_at" DESC);

-- AddForeignKey
ALTER TABLE "run_executions" ADD CONSTRAINT "run_executions_rerun_of_execution_id_fkey" FOREIGN KEY ("rerun_of_execution_id") REFERENCES "run_executions"("run_execution_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_test_account_id_fkey" FOREIGN KEY ("test_account_id") REFERENCES "test_accounts"("test_account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manually widened raw SQL CHECK constraints (Prisma's declarative schema
-- cannot express CHECK constraints — same drop-then-recreate convention as
-- 20260930160000_widen_api_creation_source_curl_import).

-- CreateCheckConstraint
ALTER TABLE "comparisons" DROP CONSTRAINT "ck_comparisons_source_kind";
ALTER TABLE "comparisons" ADD CONSTRAINT "ck_comparisons_source_kind" CHECK ("source_kind" IN ('AUTO_EXECUTION', 'MANUAL_PAIR', 'BASELINE_LATEST', 'CHAIN_PAIR', 'RERUN_EXECUTION'));

-- CreateCheckConstraint
ALTER TABLE "comparison_attempts" DROP CONSTRAINT "ck_comparison_attempts_reason_code";
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_reason_code" CHECK ("reason_code" IS NULL OR "reason_code" IN ('CONTEXT_MISMATCH', 'ENVIRONMENT_MISMATCH', 'AUTH_CONTEXT_UNKNOWN', 'SNAPSHOT_INVALIDATED', 'SNAPSHOT_INCOMPLETE', 'INPUT_MISMATCH', 'UNSUPPORTED_FORMAT', 'UNSUPPORTED_ENCODING', 'PAYLOAD_UNAVAILABLE', 'ENGINE_ERROR', 'PERSISTENCE_ERROR', 'TEST_ACCOUNT_MISMATCH', 'CONFIG_DRIFT_DETECTED'));
