import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { computeAuthContextKey } from "../snapshot/auth-context-fingerprint.util";
import { COMPARISON_ATTEMPT_RETRY_POLICY, ComparisonAttemptReasonCode, DEFAULT_APPLIED_RULE_MANIFEST } from "./comparison.constants";

export interface BaselineSelectionInput {
  projectId: string;
  apiId: string;
  environmentId: string;
  authType: string;
  authContextVersion: number;
  authIdentityLabel: string | null;
}

export interface BaselineSnapshotRef {
  snapshotId: string;
}

export interface AutomaticComparisonInput {
  runExecutionId: string;
  projectId: string;
  apiId: string;
  environmentId: string;
  baselineSnapshotId: string;
  targetSnapshotId: string;
}

export type RetryComparisonOutcome =
  | { ok: true; comparisonAttemptId: string; attemptNumber: number }
  | { ok: false; code: "COMPARISON_NOT_FOUND" | "ALREADY_COMPLETED" | "ATTEMPT_NOT_TERMINAL" | "REASON_NOT_RETRYABLE" | "CONCURRENT_RETRY" };

export interface ComparisonFindingInput {
  phase: "INPUT" | "OUTPUT";
  component: string;
  differenceKind: string;
  locationPath?: string | null;
  aByteOffset?: bigint | null;
  bByteOffset?: bigint | null;
  aByteLength?: bigint | null;
  bByteLength?: bigint | null;
  aValueKind?: string | null;
  bValueKind?: string | null;
  ruleCode: string;
  safeSummary?: string | null;
}

export type CompleteAttemptOutcome = { ok: true } | { ok: false; code: "ATTEMPT_NOT_FOUND" | "ATTEMPT_NOT_ACTIVE" };

export interface RecordClassificationInput {
  classification: "EXPECTED" | "UNEXPECTED";
  note?: string | null;
  classifiedByUserId: string;
  // null means "I believe this Comparison has not been classified yet"
  // (equivalent to expecting current revision 0) — same optimistic-
  // concurrency convention as an If-Match against a resource with no ETag yet.
  expectedRevision: number | null;
}

export type ClassificationOutcome =
  | { ok: true; revision: number }
  | { ok: false; code: "NOT_CLASSIFIABLE" | "REVISION_CONFLICT"; currentRevision: number };

// Group 6/7 Comparison persistence (REQ-CMP-001..018, AnD Database v0.3).
// Every method here is safe for RunExecutionEngine to call and swallow-or-log
// on failure — never allowed to affect a RunExecution's own status, same
// isolation convention as SnapshotService.
@Injectable()
export class ComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  // CMP-003/013 (AnD Section 4.1): the most recent non-invalidated Snapshot in
  // the same Project/API/Environment/auth-context scope, or null when none
  // exists yet. Called once, right before dispatch — the result is persisted
  // immediately by the caller (RunExecution.baselineSnapshotId/
  // baselineSelectedAt) and never reselected afterward, even if a newer
  // Snapshot appears later (RS-CMP-016-09).
  async selectBaselineSnapshot(input: BaselineSelectionInput): Promise<BaselineSnapshotRef | null> {
    const identityDiscriminator = input.authType === "LOGIN_FORM" ? (input.authIdentityLabel ?? "") : "";
    const authContextKey = computeAuthContextKey(input.apiId, input.environmentId, input.authType, input.authContextVersion, identityDiscriminator);

    return this.prisma.snapshot.findFirst({
      where: {
        projectId: input.projectId,
        apiId: input.apiId,
        environmentId: input.environmentId,
        authContextKey,
        invalidation: null,
      },
      orderBy: [{ completedAt: "desc" }, { snapshotId: "desc" }],
      select: { snapshotId: true },
    });
  }

  // CMP-013-09/RS-CMP-016-08: at most one AUTO_EXECUTION Comparison per
  // RunExecution (uq_comparisons_source_execution_id enforces this at the DB
  // layer; the P2002 branch below makes a duplicate/retried dispatch event a
  // benign no-op, same convention as SnapshotService.tryCreateSnapshot's own
  // idempotent-retry handling). The caller (RunExecutionEngine) already
  // guarantees the baseline and target are two distinct Snapshots sharing
  // this Execution's own Project/API/Environment/auth-context scope by
  // construction, so scope can never mismatch here — the only condition that
  // can still have changed between CMP-003's baseline lock and this call is
  // invalidation (RS-CMP-014-08/BR-CMP-014-07), which is why that is the only
  // live re-check performed, inside the same transaction that creates the
  // Comparison and its first attempt.
  async tryCreateAutomaticComparison(input: AutomaticComparisonInput): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const comparison = await tx.comparison.create({
          data: {
            projectId: input.projectId,
            apiId: input.apiId,
            environmentId: input.environmentId,
            baselineSnapshotId: input.baselineSnapshotId,
            targetSnapshotId: input.targetSnapshotId,
            sourceKind: "AUTO_EXECUTION",
            sourceExecutionId: input.runExecutionId,
          },
        });

        const [baselineInvalidation, targetInvalidation] = await Promise.all([
          tx.snapshotInvalidation.findUnique({ where: { snapshotId: input.baselineSnapshotId } }),
          tx.snapshotInvalidation.findUnique({ where: { snapshotId: input.targetSnapshotId } }),
        ]);

        if (baselineInvalidation || targetInvalidation) {
          const now = new Date();
          await tx.comparisonAttempt.create({
            data: {
              comparisonId: comparison.comparisonId,
              attemptNumber: 1,
              processingStatus: "BLOCKED",
              stoppedAtGate: "ELIGIBILITY",
              reasonCode: "SNAPSHOT_INVALIDATED",
              appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST,
              startedAt: now,
              endedAt: now,
            },
          });
          return;
        }

        await tx.comparisonAttempt.create({
          data: {
            comparisonId: comparison.comparisonId,
            attemptNumber: 1,
            processingStatus: "QUEUED",
            appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST,
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return;
      }
      throw err;
    }
  }

  // RS-CMP-014-09/BR-CMP-014-08: a terminal (non-COMPLETED) attempt may get a
  // new attempt appended per COMPARISON_ATTEMPT_RETRY_POLICY. A COMPLETED
  // attempt is by construction always the latest for its Comparison (no
  // further attempt is ever created once one exists — see ALREADY_COMPLETED
  // below), so checking only the latest attempt's status is sufficient to
  // detect it. `payloadNowReadable` is the caller's explicit affirmation (no
  // policy/engine layer exists yet to determine this itself, DB-VERIFY-03)
  // that a "conditional" reason's underlying bytes are now fully
  // readable/comparable — defaults to false, never assumed true.
  async retryComparisonAttempt(comparisonId: string, opts: { payloadNowReadable?: boolean } = {}): Promise<RetryComparisonOutcome> {
    try {
      return await this.prisma.$transaction(async (tx): Promise<RetryComparisonOutcome> => {
        const latest = await tx.comparisonAttempt.findFirst({
          where: { comparisonId },
          orderBy: { attemptNumber: "desc" },
        });
        if (!latest) {
          return { ok: false, code: "COMPARISON_NOT_FOUND" };
        }
        if (latest.processingStatus === "COMPLETED") {
          // uq_comparison_attempts_completed_per_comparison: at most one
          // COMPLETED attempt ever exists; a completed Comparison is never
          // reopened by a retry.
          return { ok: false, code: "ALREADY_COMPLETED" };
        }
        if (latest.processingStatus === "QUEUED" || latest.processingStatus === "RUNNING") {
          return { ok: false, code: "ATTEMPT_NOT_TERMINAL" };
        }

        const reasonCode = latest.reasonCode as ComparisonAttemptReasonCode | null;
        const policy = reasonCode ? COMPARISON_ATTEMPT_RETRY_POLICY[reasonCode] : undefined;
        const retryable = policy === "always" || (policy === "conditional" && opts.payloadNowReadable === true);
        if (!retryable) {
          return { ok: false, code: "REASON_NOT_RETRYABLE" };
        }

        const created = await tx.comparisonAttempt.create({
          data: {
            comparisonId,
            attemptNumber: latest.attemptNumber + 1,
            processingStatus: "QUEUED",
            appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST,
          },
        });
        return { ok: true, comparisonAttemptId: created.comparisonAttemptId, attemptNumber: created.attemptNumber };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // uq_comparison_attempts_comparison_id_attempt_number race — two
        // concurrent retries both read the same "latest" attempt as their
        // base. Surfaced as a clean conflict rather than a raw DB error.
        return { ok: false, code: "CONCURRENT_RETRY" };
      }
      throw err;
    }
  }

  // Atomic Result+Detail publish (CMP-007/008/CMP-015..018): a QUEUED/RUNNING
  // attempt transitions to COMPLETED with its SAME/DIFFERENT result and every
  // finding in the same transaction — never a partial state where a result
  // exists without its findings or vice versa. Reaching COMPLETED necessarily
  // implies the input gate was COMPATIBLE (an incompatible input terminates
  // via a different, earlier BLOCKED path — never this method), so
  // inputCheckOutcome is set here too rather than left NULL. Terminal
  // attempts (BLOCKED/FAILED/COMPLETED) are never overwritten.
  async completeAttempt(comparisonAttemptId: string, result: "SAME" | "DIFFERENT", findings: ComparisonFindingInput[]): Promise<CompleteAttemptOutcome> {
    return this.prisma.$transaction(async (tx): Promise<CompleteAttemptOutcome> => {
      const attempt = await tx.comparisonAttempt.findUnique({ where: { comparisonAttemptId } });
      if (!attempt) {
        return { ok: false, code: "ATTEMPT_NOT_FOUND" };
      }
      if (attempt.processingStatus !== "QUEUED" && attempt.processingStatus !== "RUNNING") {
        return { ok: false, code: "ATTEMPT_NOT_ACTIVE" };
      }

      await tx.comparisonAttempt.update({
        where: { comparisonAttemptId },
        data: { processingStatus: "COMPLETED", comparisonResult: result, inputCheckOutcome: "COMPATIBLE", endedAt: new Date() },
      });

      const ordinals = new Map<string, number>();
      for (const finding of findings) {
        const ordinal = ordinals.get(finding.phase) ?? 0;
        ordinals.set(finding.phase, ordinal + 1);
        await tx.comparisonFinding.create({
          data: {
            comparisonAttemptId,
            phase: finding.phase,
            component: finding.component,
            findingOrdinal: ordinal,
            differenceKind: finding.differenceKind,
            locationPath: finding.locationPath ?? null,
            aByteOffset: finding.aByteOffset ?? null,
            bByteOffset: finding.bByteOffset ?? null,
            aByteLength: finding.aByteLength ?? null,
            bByteLength: finding.bByteLength ?? null,
            aValueKind: finding.aValueKind ?? null,
            bValueKind: finding.bValueKind ?? null,
            ruleCode: finding.ruleCode,
            safeSummary: finding.safeSummary ?? null,
          },
        });
      }

      return { ok: true };
    });
  }

  // CMP-002 (Should): append-only, only ever accepted once the Comparison has
  // a COMPLETED/DIFFERENT attempt, guarded by an optimistic expectedRevision
  // check backed by uq_comparison_classification_events_comparison_id_revision
  // — never an update to a prior event (AnD Section 4.6: absence means "not
  // yet classified", there is no CLEAR value).
  async recordClassification(comparisonId: string, input: RecordClassificationInput): Promise<ClassificationOutcome> {
    try {
      return await this.prisma.$transaction(async (tx): Promise<ClassificationOutcome> => {
        const completedDifferent = await tx.comparisonAttempt.findFirst({
          where: { comparisonId, processingStatus: "COMPLETED", comparisonResult: "DIFFERENT" },
          select: { comparisonAttemptId: true },
        });
        const latestEvent = await tx.comparisonClassificationEvent.findFirst({
          where: { comparisonId },
          orderBy: { revision: "desc" },
          select: { revision: true },
        });
        const currentRevision = latestEvent?.revision ?? 0;

        if (!completedDifferent) {
          return { ok: false, code: "NOT_CLASSIFIABLE", currentRevision };
        }
        const expected = input.expectedRevision ?? 0;
        if (expected !== currentRevision) {
          return { ok: false, code: "REVISION_CONFLICT", currentRevision };
        }

        const created = await tx.comparisonClassificationEvent.create({
          data: {
            comparisonId,
            revision: currentRevision + 1,
            classification: input.classification,
            note: input.note ?? null,
            classifiedByUserId: input.classifiedByUserId,
          },
        });
        return { ok: true, revision: created.revision };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // uq_comparison_classification_events_comparison_id_revision race —
        // two concurrent classification requests both passed the optimistic
        // expectedRevision check against the same prior revision.
        const latestEvent = await this.prisma.comparisonClassificationEvent.findFirst({
          where: { comparisonId },
          orderBy: { revision: "desc" },
          select: { revision: true },
        });
        return { ok: false, code: "REVISION_CONFLICT", currentRevision: latestEvent?.revision ?? 0 };
      }
      throw err;
    }
  }
}
