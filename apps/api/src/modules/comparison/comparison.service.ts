import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
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

// API-CMP-001 (AnD API v0.2 §3): MANUAL_PAIR and BASELINE_LATEST both call
// createManualComparison once ComparisonQueryService has already resolved
// and permission-checked both Snapshots. scope is always Snapshot A's own
// project/api/environment columns (RS-CMP-016-01) — the caller never passes
// the request's raw path/body values, matching the Comparison model's doc
// comment that these columns describe A's scope only.
export interface ManualComparisonInput {
  scope: { projectId: string; apiId: string; environmentId: string };
  baselineSnapshotId: string;
  targetSnapshotId: string;
  sourceKind: "MANUAL_PAIR" | "BASELINE_LATEST";
  requestedByUserId: string;
  note?: string | null;
}

export interface CreateManualComparisonResult {
  comparisonId: string;
  comparisonAttemptId: string;
  queued: boolean;
}

export interface CreateChainInput {
  scope: { projectId: string; apiId: string; environmentId: string };
  requestedByUserId: string;
  // Ascending by completedAt — the caller has already resolved every
  // Snapshot spanning both requested endpoints. Every Snapshot in the
  // sequence is retained, including one invalidated mid-chain (RS-CMP-016) —
  // this method never filters the list, it only pairs adjacent entries.
  orderedSnapshotIds: string[];
  note?: string | null;
}

export interface CreateChainResult {
  comparisonChainId: string;
  selectedSnapshotCount: number;
  pairCount: number;
  // Only the pairs that came back QUEUED (not BLOCKED) need dispatching —
  // caller fire-and-forgets ComparisonEngineService.processAttempt for each.
  attemptsToQueue: string[];
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

export type StopAttemptOutcome = { ok: true } | { ok: false; code: "ATTEMPT_NOT_FOUND" | "ATTEMPT_NOT_ACTIVE" };

export interface BlockAttemptInput {
  stoppedAtGate: "ELIGIBILITY" | "INPUT" | "OUTPUT" | "PERSISTENCE" | null;
  reasonCode: ComparisonAttemptReasonCode;
  reasonDetailSafe?: string | null;
  // Only meaningful once the INPUT gate itself concluded a verdict; every
  // gate that stops before reaching INPUT (ELIGIBILITY) never evaluates it,
  // so this stays NULL there — ck_comparison_attempts_input_check_outcome
  // allows NULL freely regardless of processing_status.
  inputCheckOutcome?: "COMPATIBLE" | "MISMATCH" | null;
  // CMP-005's queryable per-finding INPUT diagnosis: unlike a FAILED attempt
  // (which must never expose a half-computed output Detail, so
  // FailAttemptInput deliberately has no equivalent field), a BLOCKED
  // attempt's INPUT findings are a complete, safe, final diagnosis of a real
  // mismatch — safe to persist as first-class ComparisonFinding rows rather
  // than only the flattened reasonDetailSafe string.
  findings?: ComparisonFindingInput[];
}

export interface FailAttemptInput {
  stoppedAtGate: "ELIGIBILITY" | "INPUT" | "OUTPUT" | "PERSISTENCE" | null;
  reasonCode: "ENGINE_ERROR" | "PERSISTENCE_ERROR";
  reasonDetailSafe?: string | null;
  // Set to "COMPATIBLE" only when the fault happened strictly after the
  // INPUT gate already concluded compatible (an OUTPUT-comparison crash or a
  // PERSISTENCE-stage failure) — never fabricated when input was never
  // reached.
  inputCheckOutcome?: "COMPATIBLE" | null;
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

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

  // Shared by createManualComparison (one pair) and createComparisonChain (N
  // adjacent pairs): create the Comparison row, then double-check invalidation
  // of both sides one more time inside this same transaction — same race-
  // protection convention as tryCreateAutomaticComparison above, needed here
  // too since a manual/chain request's Snapshot IDs are always resolved
  // slightly before this transaction opens. Unlike tryCreateAutomaticComparison,
  // scope is never guaranteed to match between the two sides here (a manual
  // pair or a chain endpoint pair can legitimately span two different
  // Projects/APIs/Environments) — that mismatch is never checked here, it is
  // left entirely to ComparisonEngineService's own ELIGIBILITY gate once the
  // attempt runs, exactly like every other gate outcome.
  private async createComparisonAndFirstAttempt(
    tx: Prisma.TransactionClient,
    input: {
      scope: { projectId: string; apiId: string; environmentId: string };
      baselineSnapshotId: string;
      targetSnapshotId: string;
      sourceKind: "MANUAL_PAIR" | "BASELINE_LATEST" | "CHAIN_PAIR";
      requestedByUserId: string;
      comparisonChainId?: string;
      pairOrdinal?: number;
      note?: string | null;
    },
  ): Promise<{ comparisonId: string; comparisonAttemptId: string; queued: boolean }> {
    const comparison = await tx.comparison.create({
      data: {
        projectId: input.scope.projectId,
        apiId: input.scope.apiId,
        environmentId: input.scope.environmentId,
        baselineSnapshotId: input.baselineSnapshotId,
        targetSnapshotId: input.targetSnapshotId,
        sourceKind: input.sourceKind,
        requestedByUserId: input.requestedByUserId,
        comparisonChainId: input.comparisonChainId ?? null,
        pairOrdinal: input.pairOrdinal ?? null,
        note: input.note ?? null,
      },
    });

    const [baselineInvalidation, targetInvalidation] = await Promise.all([
      tx.snapshotInvalidation.findUnique({ where: { snapshotId: input.baselineSnapshotId } }),
      tx.snapshotInvalidation.findUnique({ where: { snapshotId: input.targetSnapshotId } }),
    ]);

    if (baselineInvalidation || targetInvalidation) {
      const now = new Date();
      const attempt = await tx.comparisonAttempt.create({
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
      return { comparisonId: comparison.comparisonId, comparisonAttemptId: attempt.comparisonAttemptId, queued: false };
    }

    const attempt = await tx.comparisonAttempt.create({
      data: {
        comparisonId: comparison.comparisonId,
        attemptNumber: 1,
        processingStatus: "QUEUED",
        appliedRuleManifest: DEFAULT_APPLIED_RULE_MANIFEST,
      },
    });
    return { comparisonId: comparison.comparisonId, comparisonAttemptId: attempt.comparisonAttemptId, queued: true };
  }

  // API-CMP-001: persistence for MANUAL_PAIR and BASELINE_LATEST alike, once
  // ComparisonQueryService has resolved both Snapshots and confirmed access
  // to both. Always creates a Comparison — the 200 "no pair constructed"
  // outcome is decided entirely by the caller before ever reaching this
  // method, so this method never returns a no-op result.
  async createManualComparison(input: ManualComparisonInput): Promise<CreateManualComparisonResult> {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.createComparisonAndFirstAttempt(tx, {
        scope: input.scope,
        baselineSnapshotId: input.baselineSnapshotId,
        targetSnapshotId: input.targetSnapshotId,
        sourceKind: input.sourceKind,
        requestedByUserId: input.requestedByUserId,
        note: input.note,
      });

      await this.auditWriter.record(
        {
          eventType: "COMPARISON_CREATED",
          result: "SUCCESS",
          actorUserId: input.requestedByUserId,
          targetType: "COMPARISON",
          targetId: result.comparisonId,
          projectId: input.scope.projectId,
          afterData: {
            sourceKind: input.sourceKind,
            baselineSnapshotId: input.baselineSnapshotId,
            targetSnapshotId: input.targetSnapshotId,
          },
        },
        tx,
      );

      return result;
    });
  }

  // API-CMP-002: one ComparisonChain plus one Comparison+attempt per adjacent
  // pair in orderedSnapshotIds, all in a single transaction. A Snapshot
  // invalidated mid-chain is never skipped (RS-CMP-016 "a chain retains every
  // Snapshot in sequence including ones invalidated in the middle") — its two
  // touching pairs simply come back BLOCKED from the shared helper above,
  // same as any other invalidated pair.
  async createComparisonChain(input: CreateChainInput): Promise<CreateChainResult> {
    return this.prisma.$transaction(async (tx) => {
      const chain = await tx.comparisonChain.create({
        data: {
          projectId: input.scope.projectId,
          apiId: input.scope.apiId,
          environmentId: input.scope.environmentId,
          requestedByUserId: input.requestedByUserId,
          note: input.note ?? null,
        },
      });

      const attemptsToQueue: string[] = [];
      for (let i = 0; i < input.orderedSnapshotIds.length - 1; i++) {
        const result = await this.createComparisonAndFirstAttempt(tx, {
          scope: input.scope,
          baselineSnapshotId: input.orderedSnapshotIds[i],
          targetSnapshotId: input.orderedSnapshotIds[i + 1],
          sourceKind: "CHAIN_PAIR",
          requestedByUserId: input.requestedByUserId,
          comparisonChainId: chain.comparisonChainId,
          pairOrdinal: i + 1,
        });
        if (result.queued) {
          attemptsToQueue.push(result.comparisonAttemptId);
        }
      }

      await this.auditWriter.record(
        {
          eventType: "COMPARISON_CHAIN_CREATED",
          result: "SUCCESS",
          actorUserId: input.requestedByUserId,
          targetType: "COMPARISON_CHAIN",
          targetId: chain.comparisonChainId,
          projectId: input.scope.projectId,
          afterData: {
            selectedSnapshotCount: input.orderedSnapshotIds.length,
            pairCount: input.orderedSnapshotIds.length - 1,
          },
        },
        tx,
      );

      return {
        comparisonChainId: chain.comparisonChainId,
        selectedSnapshotCount: input.orderedSnapshotIds.length,
        pairCount: input.orderedSnapshotIds.length - 1,
        attemptsToQueue,
      };
    });
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

      await this.createFindingRows(tx, comparisonAttemptId, findings);

      return { ok: true };
    });
  }

  // Shared by completeAttempt (OUTPUT findings on a COMPLETED attempt) and
  // stopAttempt (OPTIONAL INPUT findings on a BLOCKED attempt) — same
  // per-phase-ordinal-starting-at-0 convention either way.
  private async createFindingRows(tx: Prisma.TransactionClient, comparisonAttemptId: string, findings: ComparisonFindingInput[]): Promise<void> {
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
  }

  // RS-CMP-014-06/BR-CMP-014-05..07: a validly-identified pair that fails a
  // gate (ELIGIBILITY, INPUT, or an OUTPUT-stage data-unavailability such as
  // PAYLOAD_UNAVAILABLE) still produces a terminal attempt carrying a reason
  // — comparisonResult is left untouched (still its create-time NULL,
  // enforced by ck_comparison_attempts_completed_result) and no
  // ComparisonFinding rows are ever written for a BLOCKED attempt. Mirrors
  // completeAttempt's fetch-check-update shape and never-overwrite-terminal-
  // state guard.
  async blockAttempt(comparisonAttemptId: string, input: BlockAttemptInput): Promise<StopAttemptOutcome> {
    return this.stopAttempt(comparisonAttemptId, "BLOCKED", input);
  }

  // An unexpected technical fault — an engine crash or a failure while
  // persisting an already-computed result — never lets a half-finished
  // output Detail become visible: comparisonResult stays NULL and no
  // findings are ever written for a FAILED attempt, same guarantee as
  // blockAttempt.
  async failAttempt(comparisonAttemptId: string, input: FailAttemptInput): Promise<StopAttemptOutcome> {
    return this.stopAttempt(comparisonAttemptId, "FAILED", input);
  }

  private async stopAttempt(comparisonAttemptId: string, processingStatus: "BLOCKED" | "FAILED", input: BlockAttemptInput | FailAttemptInput): Promise<StopAttemptOutcome> {
    return this.prisma.$transaction(async (tx): Promise<StopAttemptOutcome> => {
      const attempt = await tx.comparisonAttempt.findUnique({ where: { comparisonAttemptId } });
      if (!attempt) {
        return { ok: false, code: "ATTEMPT_NOT_FOUND" };
      }
      if (attempt.processingStatus !== "QUEUED" && attempt.processingStatus !== "RUNNING") {
        return { ok: false, code: "ATTEMPT_NOT_ACTIVE" };
      }

      await tx.comparisonAttempt.update({
        where: { comparisonAttemptId },
        data: {
          processingStatus,
          stoppedAtGate: input.stoppedAtGate,
          reasonCode: input.reasonCode,
          reasonDetailSafe: input.reasonDetailSafe ?? null,
          inputCheckOutcome: input.inputCheckOutcome ?? null,
          endedAt: new Date(),
        },
      });

      // Only BlockAttemptInput ever carries findings (see its own doc
      // comment) — FailAttemptInput has no such field, so this is always []
      // for a FAILED attempt.
      const findings = "findings" in input ? (input.findings ?? []) : [];
      if (findings.length > 0) {
        await this.createFindingRows(tx, comparisonAttemptId, findings);
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
