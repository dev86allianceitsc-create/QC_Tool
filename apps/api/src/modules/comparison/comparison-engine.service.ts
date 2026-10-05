import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { HeaderPair } from "../run/run-dispatch.util";
import { IgnoreRulesService } from "../ignore-rules/ignore-rules.service";
import { filterIgnoredFindings } from "../ignore-rules/ignore-rule-path-matcher.util";
import { checkComparisonEligibility, EligibilitySnapshotInput } from "./comparison-eligibility.util";
import { checkInputCompatibility, InputGateSnapshotInput } from "./comparison-input-gate.util";
import { checkOutputDifferences, OutputGateSnapshotInput } from "./comparison-output-gate.util";
import { ComparisonFindingInput, ComparisonService } from "./comparison.service";

type SnapshotWithRelations = Prisma.SnapshotGetPayload<{ include: { payload: true; invalidation: true } }>;
type Gate = "ELIGIBILITY" | "INPUT" | "OUTPUT";

// Group 6/7 Comparison — engine orchestrator (REQ-CMP-005/006/007/008/010).
// Runs the gate pipeline in the exact spec order and stops at the first gate
// that fails (BR-CMP-014-09, exactly one reason ever recorded): ELIGIBILITY
// (comparison-eligibility.util.ts) -> INPUT (comparison-input-gate.util.ts)
// -> OUTPUT (comparison-output-gate.util.ts), persisting the outcome through
// ComparisonService. ComparisonService's own "never overwrite a terminal
// attempt" guard (ATTEMPT_NOT_ACTIVE) makes a duplicate/concurrent
// processAttempt call for the same comparisonAttemptId a safe no-op past
// that point, so this method needs no idempotency check of its own.
//
// Deliberately has no notion of permission or viewer: callers
// (RunExecutionEngine for AUTO_EXECUTION, a future retry endpoint for manual
// retries) decide WHEN to run this; AuthZ for exposing the *result* happens
// later, at read time, in the query/controller layer — same isolation
// convention as ComparisonService and SnapshotService ("safe to call and
// swallow-or-log on failure — never allowed to affect a RunExecution's own
// status").
@Injectable()
export class ComparisonEngineService {
  private readonly logger = new Logger(ComparisonEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comparisonService: ComparisonService,
    private readonly ignoreRulesService: IgnoreRulesService,
  ) {}

  async processAttempt(comparisonAttemptId: string): Promise<void> {
    let stoppedAtGate: Gate = "ELIGIBILITY";
    try {
      const pair = await this.loadSnapshotPair(comparisonAttemptId);
      if (!pair) {
        // The attempt, its Comparison, or either Snapshot could not be
        // found. Previously this returned silently, leaving the attempt
        // stuck QUEUED forever (no terminal state, no log) since nothing
        // else in this fire-and-forget pipeline would ever revisit it —
        // mark it FAILED instead so it surfaces and, if re-dispatched later,
        // is skipped as terminal rather than stalling again.
        this.logger.error(`Comparison attempt ${comparisonAttemptId}: could not load attempt/comparison/snapshot pair`);
        await this.markFailed(comparisonAttemptId, "ELIGIBILITY", "ENGINE_ERROR", "Comparison attempt, its Comparison, or a referenced Snapshot could not be found", null);
        return;
      }
      const { a, b, sourceKind } = pair;

      const eligibility = checkComparisonEligibility(toEligibilityInput(a), toEligibilityInput(b));
      if (!eligibility.eligible) {
        await this.comparisonService.blockAttempt(comparisonAttemptId, {
          stoppedAtGate,
          reasonCode: eligibility.reasonCode,
          reasonDetailSafe: eligibility.reasonDetailSafe,
        });
        return;
      }

      stoppedAtGate = "INPUT";
      const inputFindings = checkInputCompatibility(toInputGateInput(a), toInputGateInput(b));
      if (inputFindings.length > 0) {
        // Phase 3 Test Case History & Run Again: for an automatic comparison
        // (AUTO_EXECUTION/RERUN_EXECUTION), baseline selection (concept A)
        // already guarantees both sides share the same testCaseKey, so a
        // user-facing "input differs" RESULT would be misleading — the only
        // way raw input legitimately differs is a different Test Case, which
        // never reaches this stage. A non-empty finding here can only mean
        // the *resolved* request drifted despite identical raw input (e.g.
        // the API's Full URL was edited between the baseline and now) — a
        // defensive anomaly/safety check (concept B), reported as
        // CONFIG_DRIFT_DETECTED ("comparison unavailable"), never as
        // INPUT_MISMATCH. Manual/chain pairs (no testCaseKey guarantee at
        // all) keep the original INPUT_MISMATCH result unchanged.
        const isAutomatic = sourceKind === "AUTO_EXECUTION" || sourceKind === "RERUN_EXECUTION";
        await this.comparisonService.blockAttempt(comparisonAttemptId, {
          stoppedAtGate,
          reasonCode: isAutomatic ? "CONFIG_DRIFT_DETECTED" : "INPUT_MISMATCH",
          reasonDetailSafe: isAutomatic
            ? "Resolved request differs from the baseline despite matching test case identity (configuration likely changed)"
            : summarizeFindings(inputFindings),
          inputCheckOutcome: "MISMATCH",
          findings: inputFindings,
        });
        return;
      }

      stoppedAtGate = "OUTPUT";
      const outputFindings = checkOutputDifferences(toOutputGateInput(a), toOutputGateInput(b));

      // Output Ignore Rules: filtered strictly after the real OUTPUT diff is
      // computed, never before — raw Snapshots/responses and the diff engine
      // itself are untouched (spec §1). Scoped to this pair's own
      // project/api, using whatever rule set is enabled right now; an older
      // completed attempt's own stored findings/result are never revisited
      // (spec §6).
      const activeIgnoreRules = await this.ignoreRulesService.listActiveRulesForScope(a.projectId, a.apiId);
      const { remaining: outputFindingsAfterIgnoreRules, applied: appliedIgnoreRules } = filterIgnoredFindings(outputFindings, activeIgnoreRules);
      const result = outputFindingsAfterIgnoreRules.length > 0 ? "DIFFERENT" : "SAME";

      try {
        await this.comparisonService.completeAttempt(comparisonAttemptId, result, outputFindingsAfterIgnoreRules, appliedIgnoreRules);
      } catch (persistErr) {
        // The comparison itself already succeeded (result and findings are
        // fully computed) — only the durable publish failed. Reported
        // distinctly from a generic ENGINE_ERROR so an operator can tell
        // "the engine crashed" apart from "the answer was known but not
        // saved" (RS-CMP-014-xx: an error after a partial comparison must
        // still become FAILED with Result NULL, never a half-published Detail).
        this.logger.error(`Comparison attempt ${comparisonAttemptId}: failed to persist ${result} result`, persistErr instanceof Error ? persistErr.stack : String(persistErr));
        await this.markFailed(comparisonAttemptId, "PERSISTENCE", "PERSISTENCE_ERROR", "Comparison result computed but could not be saved", "COMPATIBLE");
      }
    } catch (err) {
      this.logger.error(`Comparison attempt ${comparisonAttemptId}: crashed at ${stoppedAtGate} gate`, err instanceof Error ? err.stack : String(err));
      await this.markFailed(comparisonAttemptId, stoppedAtGate, "ENGINE_ERROR", "Unexpected error while processing this Comparison attempt", stoppedAtGate === "OUTPUT" ? "COMPATIBLE" : null);
    }
  }

  private async markFailed(
    comparisonAttemptId: string,
    stoppedAtGate: Gate | "PERSISTENCE",
    reasonCode: "ENGINE_ERROR" | "PERSISTENCE_ERROR",
    reasonDetailSafe: string,
    inputCheckOutcome: "COMPATIBLE" | null,
  ): Promise<void> {
    await this.comparisonService.failAttempt(comparisonAttemptId, { stoppedAtGate, reasonCode, reasonDetailSafe, inputCheckOutcome }).catch((markFailedErr) => {
      this.logger.error(`Comparison attempt ${comparisonAttemptId}: could not be marked FAILED`, markFailedErr instanceof Error ? markFailedErr.stack : String(markFailedErr));
    });
  }

  private async loadSnapshotPair(comparisonAttemptId: string): Promise<{ a: SnapshotWithRelations; b: SnapshotWithRelations; sourceKind: string } | null> {
    const attempt = await this.prisma.comparisonAttempt.findUnique({
      where: { comparisonAttemptId },
      select: { comparisonId: true },
    });
    if (!attempt) {
      return null;
    }

    const comparison = await this.prisma.comparison.findUnique({
      where: { comparisonId: attempt.comparisonId },
      select: { baselineSnapshotId: true, targetSnapshotId: true, sourceKind: true },
    });
    if (!comparison) {
      return null;
    }

    const [a, b] = await Promise.all([
      this.prisma.snapshot.findUnique({ where: { snapshotId: comparison.baselineSnapshotId }, include: { payload: true, invalidation: true } }),
      this.prisma.snapshot.findUnique({ where: { snapshotId: comparison.targetSnapshotId }, include: { payload: true, invalidation: true } }),
    ]);
    if (!a || !b) {
      return null;
    }

    return { a, b, sourceKind: comparison.sourceKind };
  }
}

function toEligibilityInput(s: SnapshotWithRelations): EligibilitySnapshotInput {
  return {
    projectId: s.projectId,
    apiId: s.apiId,
    environmentId: s.environmentId,
    authContextKey: s.authContextKey,
    isInvalidated: s.invalidation !== null,
    hasPayload: s.payload !== null,
    hasRequestHeaders: s.requestHeaders !== null,
    hasResponseHeaders: s.responseHeaders !== null,
    authType: s.authType,
    testAccountId: s.testAccountId,
  };
}

// Only ever called once checkComparisonEligibility has already confirmed
// hasRequestHeaders — a null value here would mean the Snapshot predates
// header capture, which ELIGIBILITY's SNAPSHOT_INCOMPLETE check already
// rules out before the INPUT gate runs. toHeaderPairs still falls back to
// [] rather than trusting that defensively, since a null value reaching
// compareHeaderPairs unguarded would throw.
function toInputGateInput(s: SnapshotWithRelations): InputGateSnapshotInput {
  return {
    httpMethod: s.httpMethod,
    requestUrl: s.requestUrl,
    requestHeaders: toHeaderPairs(s.requestHeaders),
    requestBody: s.payload?.requestBody ?? null,
  };
}

// Only ever called once checkComparisonEligibility has already confirmed
// hasPayload/hasResponseHeaders. httpStatusCode is guaranteed non-null for
// any Snapshot with a payload — see OutputGateSnapshotInput's doc comment in
// comparison-output-gate.util.ts for the SnapshotService invariant this
// relies on.
function toOutputGateInput(s: SnapshotWithRelations): OutputGateSnapshotInput {
  return {
    httpStatusCode: s.httpStatusCode!,
    responseHeaders: toHeaderPairs(s.responseHeaders),
    responseBody: s.payload?.responseBody ?? null,
  };
}

function toHeaderPairs(headers: Prisma.JsonValue | null): HeaderPair[] {
  return (headers ?? []) as unknown as HeaderPair[];
}

// Each finding's safeSummary was already vetted safe to echo by the gate
// that produced it (comparison-input-gate.util.ts), so joining them is still
// safe — this is only ever used for a BLOCKED attempt's reasonDetailSafe,
// never for a ComparisonFinding row (blockAttempt persists no findings).
function summarizeFindings(findings: ComparisonFindingInput[]): string {
  const summaries = findings.map((f) => f.safeSummary).filter((s): s is string => !!s);
  return summaries.length > 0 ? summaries.join("; ") : "Actual request input differs between Snapshot A and B";
}
