-- Comparison Attempt Re-evaluation.
-- Additive migration only — no prior migration is modified.
--
-- Source: user-specified feature scope, "auditable Re-evaluate of a
-- completed Comparison using the existing stored Snapshots and whatever
-- Ignore Rules are active right now, without calling the API-under-test
-- again, while leaving the original COMPLETED attempt untouched." Continues
-- Phase 3 Comparison (Group 6/7), following the 20261001130000_add_ignore_rules
-- and 20261001120000_add_test_case_identity hand-authored-migration
-- conventions.
--
-- Scope of this migration:
--   1. comparison_attempts gains trigger_kind (INITIAL | RETRY |
--      REEVALUATION), backfilled for existing rows purely from
--      attempt_number (attempt #1 was always the first/INITIAL attempt;
--      every later existing attempt could only have been produced by the
--      pre-existing Retry action, since REEVALUATION did not exist before
--      this migration), then locked NOT NULL with a CHECK constraint — same
--      add-column/backfill/lock-NOT-NULL sequencing already used by
--      20261001120000_add_test_case_identity for run_executions/snapshots
--      columns (though those stayed nullable; trigger_kind differs because a
--      correct, lossless backfill value is derivable for every existing row,
--      so NOT NULL is safe to lock immediately in this same migration).
--   2. uq_comparison_attempts_completed_per_comparison is narrowed (dropped
--      and recreated, not merely altered — Postgres has no ALTER INDEX for a
--      predicate change) to keep guaranteeing at most one COMPLETED attempt
--      from a real run (INITIAL or RETRY) per Comparison — the original
--      completed attempt's Result stays final/immutable — while allowing any
--      number of COMPLETED REEVALUATION attempts to accumulate over time as
--      Ignore Rules change. Every existing read path already derives a
--      Comparison's current status/result/findings from the latest attempt
--      (orderBy attemptNumber desc), never from "the one COMPLETED attempt",
--      so this is safe; the one call site that assumed the old invariant
--      (ComparisonService.recordClassification) is corrected in the same
--      change set as this migration, not left relying on the narrowed index.

-- AlterTable
ALTER TABLE "comparison_attempts" ADD COLUMN "trigger_kind" VARCHAR(20);

-- Backfill: attempt #1 is always INITIAL; every pre-existing later attempt
-- was only ever producible via the (pre-REEVALUATION) Retry action.
UPDATE "comparison_attempts" SET "trigger_kind" = CASE WHEN "attempt_number" = 1 THEN 'INITIAL' ELSE 'RETRY' END;

ALTER TABLE "comparison_attempts" ALTER COLUMN "trigger_kind" SET NOT NULL;

-- CreateCheckConstraint
ALTER TABLE "comparison_attempts" ADD CONSTRAINT "ck_comparison_attempts_trigger_kind" CHECK ("trigger_kind" IN ('INITIAL', 'RETRY', 'REEVALUATION'));

-- DropIndex / CreateIndex: narrow the completed-attempt uniqueness to real
-- runs only (trigger_kind <> 'REEVALUATION') — see header comment above.
DROP INDEX "uq_comparison_attempts_completed_per_comparison";

CREATE UNIQUE INDEX "uq_comparison_attempts_completed_per_comparison" ON "comparison_attempts"("comparison_id") WHERE "processing_status" = 'COMPLETED' AND "trigger_kind" <> 'REEVALUATION';
