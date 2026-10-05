import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ComparisonFinding, Prisma } from "@prisma/client";

import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { BusinessException } from "../../common/exceptions/business.exception";
import { assertProjectActive } from "../api-environment/apis.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { HeaderPair } from "../run/run-dispatch.util";

import { ComparisonEngineService } from "./comparison-engine.service";
import { hasProjectAccess } from "./comparison-access.util";
import { deriveFindingSides, type SnapshotSideEvidence } from "./comparison-finding-evidence.util";
import {
  COMPARISON_ATTEMPT_STALE_MS,
  ComparisonAttemptTriggerKind,
  ComparisonAvailabilityReasonCode,
  ComparisonClassificationValue,
  ComparisonFindingPhase,
  ComparisonProcessingStatus,
  ComparisonResult,
  ComparisonSourceKind,
} from "./comparison.constants";
import { ComparisonService, ReevaluateAttemptOutcome, RetryComparisonOutcome } from "./comparison.service";
import { CreateClassificationEventDto } from "./dto/create-classification-event.dto";
import { CreateComparisonChainDto } from "./dto/create-comparison-chain.dto";
import { CreateComparisonDto } from "./dto/create-comparison.dto";
import { ListComparisonFindingsQueryDto } from "./dto/list-comparison-findings-query.dto";
import { ListComparisonsQueryDto } from "./dto/list-comparisons-query.dto";

// Distinct from Audit's PagedResult<T> (audit-query.service.ts, {page,
// pageSize, totalItems, totalPages}) — AnD API §2.1 fixes this module's
// pagination contract to hasMore = page * pageSize < totalItems instead.
export interface ComparisonPagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  hasMore: boolean;
}

export interface SnapshotSummaryDto {
  projectId: string;
  apiId: string;
  environmentId: string;
  executionCompletedAt: Date;
  // Wire name kept as latencyMs (documented deviation from the underlying
  // Snapshot.durationMs column — see PR description / deviation table).
  latencyMs: number | null;
  apiVersion: string;
  databaseVersion: string;
  isInvalidatedNow: boolean;
}

export interface ComparisonSummaryDto {
  comparisonId: string;
  projectId: string;
  apiId: string;
  environmentId: string;
  baselineSnapshotId: string;
  targetSnapshotId: string;
  sourceKind: ComparisonSourceKind;
  sourceExecutionId: string | null;
  comparisonChainId: string | null;
  pairOrdinal: number | null;
  processingStatus: ComparisonProcessingStatus;
  stoppedAtGate: string | null;
  reasonCode: string | null;
  reasonDetailSafe: string | null;
  inputCheckOutcome: "COMPATIBLE" | "MISMATCH" | null;
  result: ComparisonResult | null;
  // NULL until the latest attempt is COMPLETED (AnD §2.2) — never a
  // best-effort partial count from a still-running/blocked/failed attempt.
  outputDifferenceCount: number | null;
  classification: ComparisonClassificationValue | null;
  classificationRevision: number | null;
  // The classifying user's id — the doc lists this as a flat scalar
  // alongside classificationRevision/classifiedAt, so no label lookup is
  // fabricated here (see PR deviation notes).
  classifiedBy: string | null;
  classifiedAt: Date | null;
  baselineSnapshot: SnapshotSummaryDto;
  targetSnapshot: SnapshotSummaryDto;
  // B - A, only when both sides have a known latency; UNKNOWN/missing stays
  // null rather than a fabricated 0.
  latencyDeltaMs: number | null;
  apiVersionChanged: boolean | null;
  databaseVersionChanged: boolean | null;
  createdAt: Date;
  endedAt: Date | null;
}

export interface AppliedRuleSummaryDto {
  ruleManifestVersion: string;
  representationBoundary: string;
  // Count only — never the raw exclusion identifiers (AnD §2.1 "không nhận
  // arbitrary exclusions"/no raw policy payload in a client-facing summary).
  exclusionCount: number;
  // Output Ignore Rules actually applied to THIS attempt's OUTPUT diff
  // (ComparisonEngineService.processAttempt -> filterIgnoredFindings), not
  // "how many rules are enabled right now" — an attempt processed before a
  // rule existed stays 0 forever, even if rules are added later (spec §6).
  ignoreRuleCount: number;
}

export interface ComparisonDetailDto extends ComparisonSummaryDto {
  // Populated only once the latest attempt is terminal (COMPLETED/BLOCKED/
  // FAILED) — null while QUEUED/RUNNING, since no manifest was "applied" yet.
  appliedRuleSummary: AppliedRuleSummaryDto | null;
  latestAttemptNumber: number;
  findingsLink: string;
  attemptsLink: string;
}

export type FindingPresenceKind = "ABSENT" | "NULL" | "EMPTY" | "VALUE";
export type FindingDisplayKind = "object" | "array" | "string" | "number" | "boolean" | "null" | "raw" | "text";

export interface FindingSideDto {
  presenceKind: FindingPresenceKind;
  displayKind: FindingDisplayKind;
  // Detail is always re-derived from Snapshot by a permission-rechecking
  // endpoint (CMP-015/017/018) — ComparisonFinding never stores raw
  // value_a/value_b, so a list item never carries real bytes.
  safeText: string | null;
  hexPreview: string | null;
  isRedacted: boolean;
  hasMore: boolean;
}

export type FindingLocationDto = { path: string } | { aByteOffset: string | null; aByteLength: string | null; bByteOffset: string | null; bByteLength: string | null } | null;

export interface ComparisonFindingItemDto {
  findingId: string;
  phase: ComparisonFindingPhase;
  component: string;
  differenceKind: string;
  findingOrdinal: number;
  location: FindingLocationDto;
  a: FindingSideDto;
  b: FindingSideDto;
  ruleCode: string;
  ruleVersion: string;
  safeSummary: string | null;
}

export interface ComparisonFindingsResult {
  comparisonId: string;
  phase: ComparisonFindingPhase | null;
  result: ComparisonResult | null;
  processingStatus: ComparisonProcessingStatus;
  items: ComparisonFindingItemDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  hasMore: boolean;
}

export interface ComparisonAttemptListItemDto {
  comparisonAttemptId: string;
  attemptNumber: number;
  triggerKind: ComparisonAttemptTriggerKind;
  processingStatus: ComparisonProcessingStatus;
  stoppedAtGate: string | null;
  reasonCode: string | null;
  reasonDetailSafe: string | null;
  inputCheckOutcome: "COMPATIBLE" | "MISMATCH" | null;
  result: ComparisonResult | null;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface ComparisonChainPairDto {
  pairOrdinal: number;
  comparison: ComparisonSummaryDto;
}

export interface ComparisonChainDetailDto {
  comparisonChainId: string;
  projectId: string;
  apiId: string;
  environmentId: string;
  requestedAt: Date;
  selectedSnapshotCount: number;
  pairs: ComparisonChainPairDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  hasMore: boolean;
}

export interface ClassificationEventItemDto {
  classificationEventId: string;
  revision: number;
  classification: ComparisonClassificationValue;
  note: string | null;
  classifiedBy: string;
  classifiedAt: Date;
}

export interface CreateComparisonResult {
  comparisonId: string;
  comparisonAttemptId: string;
  processingStatus: "QUEUED" | "BLOCKED";
}

// API-CMP-001 BASELINE_LATEST "no pair constructed" outcome — HTTP 200, no
// write to Execution, no resource created (AnD API §3 CMP-001 Success).
export interface ComparisonAvailabilityResult {
  comparisonId: null;
  availabilityReasonCode: ComparisonAvailabilityReasonCode;
  latestSnapshotId: string | null;
}

export interface CreateChainResultDto {
  comparisonChainId: string;
  selectedSnapshotCount: number;
  pairCount: number;
}

export interface RetryComparisonResultDto {
  comparisonAttemptId: string;
  attemptNumber: number;
  processingStatus: "QUEUED";
}

// Re-evaluate always awaits the engine before responding (see
// ComparisonQueryService.reevaluateComparison), so unlike
// RetryComparisonResultDto's always-QUEUED shape, this reports the new
// attempt's real terminal processingStatus/result.
export interface ReevaluateComparisonResultDto {
  comparisonAttemptId: string;
  attemptNumber: number;
  processingStatus: ComparisonProcessingStatus;
  result: ComparisonResult | null;
}

export interface ClassificationEventResultDto {
  classificationEventId: string;
  revision: number;
  classification: ComparisonClassificationValue;
  note: string | null;
  classifiedBy: string;
  classifiedAt: Date;
}

const SNAPSHOT_SUMMARY_SELECT = {
  projectId: true,
  apiId: true,
  environmentId: true,
  completedAt: true,
  durationMs: true,
  apiVersion: true,
  databaseVersion: true,
  invalidation: { select: { invalidationId: true } },
} as const;

type SnapshotSummaryRow = Prisma.SnapshotGetPayload<{ select: typeof SNAPSHOT_SUMMARY_SELECT }>;

const COMPARISON_SUMMARY_INCLUDE = {
  baselineSnapshot: { select: SNAPSHOT_SUMMARY_SELECT },
  targetSnapshot: { select: SNAPSHOT_SUMMARY_SELECT },
  attempts: { orderBy: { attemptNumber: "desc" as const }, take: 1, include: { _count: { select: { findings: true } } } },
  classificationEvents: { orderBy: { revision: "desc" as const }, take: 1 },
};

type ComparisonSummaryRow = Prisma.ComparisonGetPayload<{ include: typeof COMPARISON_SUMMARY_INCLUDE }>;

function toSnapshotSummary(s: SnapshotSummaryRow): SnapshotSummaryDto {
  return {
    projectId: s.projectId,
    apiId: s.apiId,
    environmentId: s.environmentId,
    executionCompletedAt: s.completedAt,
    latencyMs: s.durationMs,
    apiVersion: s.apiVersion,
    databaseVersion: s.databaseVersion,
    isInvalidatedNow: s.invalidation !== null,
  };
}

function computeLatencyDelta(baselineMs: number | null, targetMs: number | null): number | null {
  if (baselineMs === null || targetMs === null) return null;
  return targetMs - baselineMs;
}

function computeVersionChanged(a: string, b: string): boolean | null {
  if (a === "UNKNOWN" || b === "UNKNOWN") return null;
  return a !== b;
}

function getRuleVersion(manifest: Prisma.JsonValue | null): string {
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    const v = (manifest as { ruleManifestVersion?: unknown }).ruleManifestVersion;
    if (typeof v === "number" || typeof v === "string") return String(v);
  }
  return "1";
}

function buildAppliedRuleSummary(manifest: Prisma.JsonValue | null): AppliedRuleSummaryDto | null {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return null;
  const m = manifest as { ruleManifestVersion?: unknown; exclusions?: unknown; representationBoundary?: unknown; ignoreRules?: unknown };
  return {
    ruleManifestVersion: getRuleVersion(manifest),
    representationBoundary: typeof m.representationBoundary === "string" ? m.representationBoundary : "DEFAULT",
    exclusionCount: Array.isArray(m.exclusions) ? m.exclusions.length : 0,
    ignoreRuleCount: Array.isArray(m.ignoreRules) ? m.ignoreRules.length : 0,
  };
}

const TERMINAL_PROCESSING_STATUSES: ComparisonProcessingStatus[] = ["COMPLETED", "BLOCKED", "FAILED"];

function toComparisonSummary(row: ComparisonSummaryRow): ComparisonSummaryDto {
  // Every Comparison always has >= 1 attempt, created in the same
  // transaction as the Comparison row itself (createComparisonAndFirstAttempt) —
  // same non-null invariant already relied on by ComparisonEngineService.
  const latest = row.attempts[0]!;
  const latestEvent = row.classificationEvents[0] ?? null;
  const baselineSummary = toSnapshotSummary(row.baselineSnapshot);
  const targetSummary = toSnapshotSummary(row.targetSnapshot);

  return {
    comparisonId: row.comparisonId,
    projectId: row.projectId,
    apiId: row.apiId,
    environmentId: row.environmentId,
    baselineSnapshotId: row.baselineSnapshotId,
    targetSnapshotId: row.targetSnapshotId,
    sourceKind: row.sourceKind as ComparisonSourceKind,
    sourceExecutionId: row.sourceExecutionId,
    comparisonChainId: row.comparisonChainId,
    pairOrdinal: row.pairOrdinal,
    processingStatus: latest.processingStatus as ComparisonProcessingStatus,
    stoppedAtGate: latest.stoppedAtGate,
    reasonCode: latest.reasonCode,
    reasonDetailSafe: latest.reasonDetailSafe,
    inputCheckOutcome: latest.inputCheckOutcome as "COMPATIBLE" | "MISMATCH" | null,
    result: latest.comparisonResult as ComparisonResult | null,
    outputDifferenceCount: latest.processingStatus === "COMPLETED" ? latest._count.findings : null,
    classification: (latestEvent?.classification as ComparisonClassificationValue | undefined) ?? null,
    classificationRevision: latestEvent?.revision ?? null,
    classifiedBy: latestEvent?.classifiedByUserId ?? null,
    classifiedAt: latestEvent?.createdAt ?? null,
    baselineSnapshot: baselineSummary,
    targetSnapshot: targetSummary,
    latencyDeltaMs: computeLatencyDelta(baselineSummary.latencyMs, targetSummary.latencyMs),
    apiVersionChanged: computeVersionChanged(baselineSummary.apiVersion, targetSummary.apiVersion),
    databaseVersionChanged: computeVersionChanged(baselineSummary.databaseVersion, targetSummary.databaseVersion),
    createdAt: row.createdAt,
    endedAt: latest.endedAt,
  };
}

function buildLocation(locationPath: string | null, aOffset: bigint | null, aLength: bigint | null, bOffset: bigint | null, bLength: bigint | null): FindingLocationDto {
  if (locationPath !== null) return { path: locationPath };
  if (aOffset !== null || aLength !== null || bOffset !== null || bLength !== null) {
    return {
      aByteOffset: aOffset !== null ? aOffset.toString() : null,
      aByteLength: aLength !== null ? aLength.toString() : null,
      bByteOffset: bOffset !== null ? bOffset.toString() : null,
      bByteLength: bLength !== null ? bLength.toString() : null,
    };
  }
  return null;
}

// CMP-005 Finding Detail (AnD Section 4.5): presence/display kind and any
// preview text are re-derived at read time from the Snapshot pair the
// Comparison already references, keyed by the evidence this finding row
// persisted (locationPath / byte offsets+lengths / value kinds) — see
// comparison-finding-evidence.util.ts for the full derivation contract and
// its redaction policy. This is a pure historical read: it never re-runs
// the engine and never changes the persisted finding or attempt.
function toFindingItem(row: ComparisonFinding, ruleVersion: string, evidenceA: SnapshotSideEvidence, evidenceB: SnapshotSideEvidence): ComparisonFindingItemDto {
  const sides = deriveFindingSides(row, evidenceA, evidenceB);
  return {
    findingId: row.comparisonFindingId,
    phase: row.phase as ComparisonFindingPhase,
    component: row.component,
    differenceKind: row.differenceKind,
    findingOrdinal: row.findingOrdinal,
    location: buildLocation(row.locationPath, row.aByteOffset, row.aByteLength, row.bByteOffset, row.bByteLength),
    a: sides.a,
    b: sides.b,
    ruleCode: row.ruleCode,
    ruleVersion,
    safeSummary: row.safeSummary,
  };
}

function toHeaderPairs(json: Prisma.JsonValue | null | undefined): HeaderPair[] {
  return Array.isArray(json) ? (json as unknown as HeaderPair[]) : [];
}

interface SnapshotEvidenceRow {
  httpMethod: string;
  requestUrl: string;
  httpStatusCode: number | null;
  requestHeaders: Prisma.JsonValue;
  responseHeaders: Prisma.JsonValue;
}

interface SnapshotPayloadEvidenceRow {
  requestBody: Uint8Array | null;
  responseBody: Uint8Array | null;
}

function toSnapshotSideEvidence(row: SnapshotEvidenceRow | null, payload: SnapshotPayloadEvidenceRow | null): SnapshotSideEvidence {
  return {
    httpMethod: row?.httpMethod ?? null,
    requestUrl: row?.requestUrl ?? null,
    httpStatusCode: row?.httpStatusCode ?? null,
    requestHeaders: toHeaderPairs(row?.requestHeaders),
    responseHeaders: toHeaderPairs(row?.responseHeaders),
    requestBody: payload?.requestBody ?? null,
    responseBody: payload?.responseBody ?? null,
  };
}

// Group 6/7 Comparison API surface (API-CMP-001..010, AnD API v0.2). Named
// "Query" to match SnapshotQueryService's precedent, which also owns one
// mutation (invalidateSnapshot) alongside its reads — createComparison/
// createComparisonChain/retryComparison/createClassificationEvent are this
// module's equivalent mutations. ComparisonService itself stays a pure
// persistence layer shared with RunExecutionEngine; every request-shape
// concern (permission pre-checks, 400/404/422 branching, DTO-to-response
// mapping, engine dispatch) lives here instead.
@Injectable()
export class ComparisonQueryService {
  private readonly logger = new Logger(ComparisonQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comparisonService: ComparisonService,
    private readonly comparisonEngineService: ComparisonEngineService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  private dispatch(comparisonAttemptId: string): void {
    this.comparisonEngineService.processAttempt(comparisonAttemptId).catch((err: unknown) => {
      this.logger.error(`Failed to dispatch comparison attempt ${comparisonAttemptId}`, err instanceof Error ? err.stack : String(err));
    });
  }

  // API-CMP-001. selectionMode discriminates PAIR (an explicit A/B pair) from
  // BASELINE_LATEST (server resolves A from the current baseline, B from the
  // latest non-invalidated Snapshot in scope). Both branches always create a
  // Comparison + first attempt when a pair exists — RS-CMP-016's "check
  // permission for BOTH Snapshot A and B, then gate on scope/eligibility" is
  // never short-circuited into a client-facing 422 here; a scope mismatch
  // surfaces later as a normal BLOCKED attempt via the engine's own
  // ELIGIBILITY gate.
  async createComparison(projectId: string, dto: CreateComparisonDto, actorUserId: string): Promise<CreateComparisonResult | ComparisonAvailabilityResult> {
    await assertProjectActive(this.prisma, projectId);
    this.validateSelectionModeExclusivity(dto);

    if (dto.selectionMode === "PAIR") {
      return this.createPairComparison(projectId, dto, actorUserId);
    }
    return this.createBaselineLatestComparison(projectId, dto, actorUserId);
  }

  // @ValidateIf on the DTO only expresses "required when this branch is
  // selected" — the complementary "forbidden when the other branch is
  // selected" half of "cả hai nhánh trộn" (400 VALIDATION_ERROR) has no
  // built-in decorator (see CreateComparisonDto's own doc comment) and is
  // enforced here instead, before either branch reads its fields.
  private validateSelectionModeExclusivity(dto: CreateComparisonDto): void {
    if (dto.selectionMode === "PAIR") {
      if (dto.apiId !== undefined || dto.environmentId !== undefined || dto.authContextRef !== undefined) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "apiId, environmentId and authContextRef are forbidden when selectionMode is PAIR");
      }
    } else if (dto.baselineSnapshotId !== undefined || dto.targetSnapshotId !== undefined) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "baselineSnapshotId and targetSnapshotId are forbidden when selectionMode is BASELINE_LATEST");
    }
  }

  private async createPairComparison(projectId: string, dto: CreateComparisonDto, actorUserId: string): Promise<CreateComparisonResult> {
    const baselineSnapshotId = dto.baselineSnapshotId!;
    const targetSnapshotId = dto.targetSnapshotId!;

    const [a, b] = await Promise.all([
      this.prisma.snapshot.findUnique({ where: { snapshotId: baselineSnapshotId }, select: { snapshotId: true, projectId: true, apiId: true, environmentId: true } }),
      this.prisma.snapshot.findUnique({ where: { snapshotId: targetSnapshotId }, select: { snapshotId: true, projectId: true, apiId: true, environmentId: true } }),
    ]);
    const [aAccess, bAccess] = await Promise.all([
      a ? hasProjectAccess(this.prisma, actorUserId, a.projectId) : Promise.resolve(false),
      b ? hasProjectAccess(this.prisma, actorUserId, b.projectId) : Promise.resolve(false),
    ]);
    // Missing-vs-denied collapses to the same 404 — cross-project existence
    // must never leak via a differently worded error (AnD API §2.1).
    if (!a || !b || !aAccess || !bAccess) {
      await this.auditWriter.record({
        eventType: "COMPARISON_ACCESS_DENIED",
        result: "DENIED",
        actorUserId,
        targetType: "SNAPSHOT",
        targetId: null,
        projectId,
      });
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Snapshot does not exist");
    }

    if (baselineSnapshotId === targetSnapshotId) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "baselineSnapshotId and targetSnapshotId must be distinct");
    }
    // Comparison.projectId/apiId/environmentId describe Snapshot A's scope
    // only (schema doc comment) — the path projectId must match A, never B.
    if (a.projectId !== projectId) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "baselineSnapshotId must belong to the Project in the path");
    }

    const result = await this.comparisonService.createManualComparison({
      scope: { projectId: a.projectId, apiId: a.apiId, environmentId: a.environmentId },
      baselineSnapshotId,
      targetSnapshotId,
      sourceKind: "MANUAL_PAIR",
      requestedByUserId: actorUserId,
    });

    if (result.queued) this.dispatch(result.comparisonAttemptId);

    return { comparisonId: result.comparisonId, comparisonAttemptId: result.comparisonAttemptId, processingStatus: result.queued ? "QUEUED" : "BLOCKED" };
  }

  // BASELINE_LATEST 3-step resolution (AnD API §3 CMP-001 Success): no
  // matching Snapshot, no baseline recorded for it, or that baseline since
  // invalidated all return HTTP 200 with an availability reason and never
  // write to Execution or create any resource.
  private async createBaselineLatestComparison(projectId: string, dto: CreateComparisonDto, actorUserId: string): Promise<CreateComparisonResult | ComparisonAvailabilityResult> {
    const apiId = dto.apiId!;
    const environmentId = dto.environmentId!;
    const authContextRef = dto.authContextRef!;

    const candidate = await this.prisma.snapshot.findFirst({
      where: { projectId, apiId, environmentId, authContextKey: authContextRef, invalidation: null },
      orderBy: [{ completedAt: "desc" }, { snapshotId: "desc" }],
      include: { runExecution: { select: { baselineSnapshotId: true } } },
    });
    if (!candidate) {
      return { comparisonId: null, availabilityReasonCode: "NO_LATEST_SNAPSHOT", latestSnapshotId: null };
    }

    const baselineSnapshotId = candidate.runExecution.baselineSnapshotId;
    if (!baselineSnapshotId) {
      return { comparisonId: null, availabilityReasonCode: "NO_BASELINE", latestSnapshotId: candidate.snapshotId };
    }

    const baselineInvalidation = await this.prisma.snapshotInvalidation.findUnique({ where: { snapshotId: baselineSnapshotId } });
    if (baselineInvalidation) {
      return { comparisonId: null, availabilityReasonCode: "BASELINE_INVALIDATED", latestSnapshotId: candidate.snapshotId };
    }

    // Baseline was chosen at dispatch time under this same projectId/apiId/
    // environmentId scope (ComparisonService.selectBaselineSnapshot), so no
    // further cross-Snapshot permission check is needed beyond the route's
    // own ProjectAccessGuard against the path projectId.
    const result = await this.comparisonService.createManualComparison({
      scope: { projectId, apiId, environmentId },
      baselineSnapshotId,
      targetSnapshotId: candidate.snapshotId,
      sourceKind: "BASELINE_LATEST",
      requestedByUserId: actorUserId,
    });

    if (result.queued) this.dispatch(result.comparisonAttemptId);

    return { comparisonId: result.comparisonId, comparisonAttemptId: result.comparisonAttemptId, processingStatus: result.queued ? "QUEUED" : "BLOCKED" };
  }

  // API-CMP-002. Only the two chain endpoints are client-supplied — every
  // Snapshot in between (including one invalidated mid-chain, RS-CMP-016) is
  // resolved and frozen server-side, ordered by completedAt then snapshotId.
  async createComparisonChain(projectId: string, dto: CreateComparisonChainDto, actorUserId: string): Promise<CreateChainResultDto> {
    await assertProjectActive(this.prisma, projectId);

    const snapshotSelect = { snapshotId: true, projectId: true, apiId: true, environmentId: true, authContextKey: true, completedAt: true } as const;
    const [start, end] = await Promise.all([
      this.prisma.snapshot.findUnique({ where: { snapshotId: dto.startSnapshotId }, select: snapshotSelect }),
      this.prisma.snapshot.findUnique({ where: { snapshotId: dto.endSnapshotId }, select: snapshotSelect }),
    ]);
    const [startAccess, endAccess] = await Promise.all([
      start ? hasProjectAccess(this.prisma, actorUserId, start.projectId) : Promise.resolve(false),
      end ? hasProjectAccess(this.prisma, actorUserId, end.projectId) : Promise.resolve(false),
    ]);
    if (!start || !end || !startAccess || !endAccess) {
      await this.auditWriter.record({
        eventType: "COMPARISON_ACCESS_DENIED",
        result: "DENIED",
        actorUserId,
        targetType: "SNAPSHOT",
        targetId: null,
        projectId,
      });
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Snapshot does not exist");
    }

    if (start.snapshotId === end.snapshotId) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "startSnapshotId and endSnapshotId must be distinct");
    }
    if (start.projectId !== end.projectId || start.apiId !== end.apiId || start.environmentId !== end.environmentId || start.authContextKey !== end.authContextKey) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "Chain start and end Snapshots must share the same Project/API/Environment/auth context");
    }

    const [minCompletedAt, maxCompletedAt] = start.completedAt <= end.completedAt ? [start.completedAt, end.completedAt] : [end.completedAt, start.completedAt];
    const range = await this.prisma.snapshot.findMany({
      where: {
        projectId: start.projectId,
        apiId: start.apiId,
        environmentId: start.environmentId,
        authContextKey: start.authContextKey,
        completedAt: { gte: minCompletedAt, lte: maxCompletedAt },
      },
      orderBy: [{ completedAt: "asc" }, { snapshotId: "asc" }],
      select: { snapshotId: true },
    });
    if (range.length < 2) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "Fewer than 2 Snapshots resolved for this chain");
    }

    const result = await this.comparisonService.createComparisonChain({
      scope: { projectId: start.projectId, apiId: start.apiId, environmentId: start.environmentId },
      requestedByUserId: actorUserId,
      orderedSnapshotIds: range.map((s) => s.snapshotId),
    });

    for (const attemptId of result.attemptsToQueue) this.dispatch(attemptId);

    return { comparisonChainId: result.comparisonChainId, selectedSnapshotCount: result.selectedSnapshotCount, pairCount: result.pairCount };
  }

  // API-CMP-003. `result` matches exactly (at most one COMPLETED attempt
  // ever exists per Comparison). `processingStatus` matches any attempt,
  // which is exact for QUEUED/RUNNING/COMPLETED (each can only ever be the
  // latest attempt by construction) but can surface a stale BLOCKED/FAILED
  // attempt that a later retry has since superseded — documented limitation,
  // not fixed here (see PR deviation notes).
  async listComparisons(projectId: string, query: ListComparisonsQueryDto): Promise<ComparisonPagedResult<ComparisonSummaryDto>> {
    const project = await this.prisma.project.findFirst({ where: { projectId, deletedAt: null } });
    if (!project) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ComparisonWhereInput = { projectId };
    if (query.apiId) where.apiId = query.apiId;
    if (query.sourceKind) where.sourceKind = query.sourceKind;

    const andConditions: Prisma.ComparisonWhereInput[] = [];
    if (query.snapshotId) {
      andConditions.push({ OR: [{ baselineSnapshotId: query.snapshotId }, { targetSnapshotId: query.snapshotId }] });
    }
    if (query.executionId) {
      andConditions.push({
        OR: [
          { sourceExecutionId: query.executionId },
          { baselineSnapshot: { runExecutionId: query.executionId } },
          { targetSnapshot: { runExecutionId: query.executionId } },
        ],
      });
    }
    if (query.result) andConditions.push({ attempts: { some: { comparisonResult: query.result } } });
    if (query.processingStatus) andConditions.push({ attempts: { some: { processingStatus: query.processingStatus } } });
    if (andConditions.length > 0) where.AND = andConditions;

    const [rows, totalItems] = await Promise.all([
      this.prisma.comparison.findMany({
        where,
        include: COMPARISON_SUMMARY_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { comparisonId: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.comparison.count({ where }),
    ]);

    return { items: rows.map(toComparisonSummary), page, pageSize, totalItems, hasMore: page * pageSize < totalItems };
  }

  // API-CMP-004.
  async getComparison(comparisonId: string): Promise<ComparisonDetailDto> {
    const row = await this.prisma.comparison.findUnique({ where: { comparisonId }, include: COMPARISON_SUMMARY_INCLUDE });
    if (!row) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comparison does not exist");
    }

    const summary = toComparisonSummary(row);
    const latest = row.attempts[0]!;
    const terminal = TERMINAL_PROCESSING_STATUSES.includes(latest.processingStatus as ComparisonProcessingStatus);

    // Self-heal: a non-terminal attempt this old was never going to still be
    // legitimately in flight (in-process gate computation, no external I/O)
    // — it was orphaned by a dropped fire-and-forget dispatch (e.g. an API
    // process restart mid-flight) or an engine crash. Re-dispatching is safe
    // even if it's a false positive: processAttempt/completeAttempt/
    // failAttempt all refuse to touch an attempt that isn't QUEUED/RUNNING.
    if (!terminal) {
      const referenceTime = (latest.startedAt ?? latest.createdAt).getTime();
      if (Date.now() - referenceTime >= COMPARISON_ATTEMPT_STALE_MS) {
        this.dispatch(latest.comparisonAttemptId);
      }
    }

    return {
      ...summary,
      appliedRuleSummary: terminal ? buildAppliedRuleSummary(latest.appliedRuleManifest) : null,
      latestAttemptNumber: latest.attemptNumber,
      findingsLink: `/api/v1/comparisons/${comparisonId}/findings`,
      attemptsLink: `/api/v1/comparisons/${comparisonId}/attempts`,
    };
  }

  // API-CMP-005. Always the latest attempt (CMP-005's own findings are a
  // property of "the current state of this Comparison", never a specific
  // historical attempt) — the phase filter and stable ordering are the only
  // query surface, matching every documented "empty when not applicable"
  // rule without any extra branching (e.g. INPUT is naturally empty for a
  // COMPLETED attempt, since completeAttempt never writes INPUT findings).
  async listComparisonFindings(comparisonId: string, query: ListComparisonFindingsQueryDto): Promise<ComparisonFindingsResult> {
    const [comparison, latestAttempt] = await Promise.all([
      this.prisma.comparison.findUnique({ where: { comparisonId }, select: { baselineSnapshotId: true, targetSnapshotId: true } }),
      this.prisma.comparisonAttempt.findFirst({
        where: { comparisonId },
        orderBy: { attemptNumber: "desc" },
        select: { comparisonAttemptId: true, processingStatus: true, comparisonResult: true, appliedRuleManifest: true },
      }),
    ]);
    if (!comparison || !latestAttempt) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comparison does not exist");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ComparisonFindingWhereInput = { comparisonAttemptId: latestAttempt.comparisonAttemptId };
    if (query.phase) where.phase = query.phase;

    const [rows, totalItems] = await Promise.all([
      this.prisma.comparisonFinding.findMany({
        where,
        orderBy: [{ phase: "asc" }, { findingOrdinal: "asc" }, { comparisonFindingId: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.comparisonFinding.count({ where }),
    ]);

    const [evidenceA, evidenceB] = await this.loadFindingEvidence(comparison.baselineSnapshotId, comparison.targetSnapshotId, rows);

    const ruleVersion = getRuleVersion(latestAttempt.appliedRuleManifest);
    return {
      comparisonId,
      phase: query.phase ?? null,
      result: latestAttempt.comparisonResult as ComparisonResult | null,
      processingStatus: latestAttempt.processingStatus as ComparisonProcessingStatus,
      items: rows.map((r) => toFindingItem(r, ruleVersion, evidenceA, evidenceB)),
      page,
      pageSize,
      totalItems,
      hasMore: page * pageSize < totalItems,
    };
  }

  // Fetches only what this page of findings can actually use: header/status
  // columns are cheap and always fetched, but SnapshotPayload's body bytes
  // are only pulled when a REQUEST_BODY/RESPONSE_BODY finding is actually on
  // this page, since a body can be large and most pages are header-only.
  private async loadFindingEvidence(baselineSnapshotId: string, targetSnapshotId: string, rows: ComparisonFinding[]): Promise<[SnapshotSideEvidence, SnapshotSideEvidence]> {
    const needsBody = rows.some((r) => r.component === "REQUEST_BODY" || r.component === "RESPONSE_BODY");
    const headerSelect = { httpMethod: true, requestUrl: true, httpStatusCode: true, requestHeaders: true, responseHeaders: true } satisfies Prisma.SnapshotSelect;

    const [a, b, payloadA, payloadB] = await Promise.all([
      this.prisma.snapshot.findUnique({ where: { snapshotId: baselineSnapshotId }, select: headerSelect }),
      this.prisma.snapshot.findUnique({ where: { snapshotId: targetSnapshotId }, select: headerSelect }),
      needsBody ? this.prisma.snapshotPayload.findUnique({ where: { snapshotId: baselineSnapshotId }, select: { requestBody: true, responseBody: true } }) : null,
      needsBody ? this.prisma.snapshotPayload.findUnique({ where: { snapshotId: targetSnapshotId }, select: { requestBody: true, responseBody: true } }) : null,
    ]);
    return [toSnapshotSideEvidence(a, payloadA), toSnapshotSideEvidence(b, payloadB)];
  }

  // API-CMP-006. Full retry history, oldest first.
  async listComparisonAttempts(comparisonId: string, query: PaginationQueryDto): Promise<ComparisonPagedResult<ComparisonAttemptListItemDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [rows, totalItems] = await Promise.all([
      this.prisma.comparisonAttempt.findMany({
        where: { comparisonId },
        orderBy: { attemptNumber: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.comparisonAttempt.count({ where: { comparisonId } }),
    ]);

    return {
      items: rows.map((r) => ({
        comparisonAttemptId: r.comparisonAttemptId,
        attemptNumber: r.attemptNumber,
        triggerKind: r.triggerKind as ComparisonAttemptTriggerKind,
        processingStatus: r.processingStatus as ComparisonProcessingStatus,
        stoppedAtGate: r.stoppedAtGate,
        reasonCode: r.reasonCode,
        reasonDetailSafe: r.reasonDetailSafe,
        inputCheckOutcome: r.inputCheckOutcome as "COMPATIBLE" | "MISMATCH" | null,
        result: r.comparisonResult as ComparisonResult | null,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
      })),
      page,
      pageSize,
      totalItems,
      hasMore: page * pageSize < totalItems,
    };
  }

  // API-CMP-007. No request body (empty POST per AnD API §3) — payloadNowReadable
  // is never accepted from the client (ComparisonService.retryComparisonAttempt's
  // own doc comment: no policy/engine layer exists yet to determine this,
  // DB-VERIFY-03), so a "conditional" reason code is never retryable through
  // this endpoint today.
  async retryComparison(comparisonId: string, actorUserId: string): Promise<RetryComparisonResultDto> {
    const outcome = await this.comparisonService.retryComparisonAttempt(comparisonId);
    if (!outcome.ok) {
      if (outcome.code === "COMPARISON_NOT_FOUND") {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comparison does not exist");
      }
      throw new BusinessException(HttpStatus.CONFLICT, outcome.code, RETRY_CONFLICT_MESSAGES[outcome.code]);
    }

    this.dispatch(outcome.comparisonAttemptId);
    await this.auditWriter.record({
      eventType: "COMPARISON_RETRY_REQUESTED",
      result: "SUCCESS",
      actorUserId,
      targetType: "COMPARISON",
      targetId: comparisonId,
      afterData: { comparisonAttemptId: outcome.comparisonAttemptId, attemptNumber: outcome.attemptNumber },
    });

    return { comparisonAttemptId: outcome.comparisonAttemptId, attemptNumber: outcome.attemptNumber, processingStatus: "QUEUED" };
  }

  // Re-evaluate (user-specified feature, not a numbered API-CMP-0xx item in
  // the original AnD doc set). Deliberately AWAITS processAttempt instead of
  // using this.dispatch's fire-and-forget pattern: unlike a real run, the
  // engine does zero external I/O for a REEVALUATION attempt (no API-under-
  // test call, purely stored Snapshots + whatever Ignore Rules are active
  // now), so the new attempt is already terminal by the time this returns —
  // the whole point is that Comparison Detail can show the new result
  // immediately with one refetch, no polling.
  async reevaluateComparison(comparisonId: string, actorUserId: string): Promise<ReevaluateComparisonResultDto> {
    const outcome = await this.comparisonService.reevaluateComparisonAttempt(comparisonId);
    if (!outcome.ok) {
      if (outcome.code === "COMPARISON_NOT_FOUND") {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comparison does not exist");
      }
      throw new BusinessException(HttpStatus.CONFLICT, outcome.code, REEVALUATE_CONFLICT_MESSAGES[outcome.code]);
    }

    await this.comparisonEngineService.processAttempt(outcome.comparisonAttemptId);

    const attempt = await this.prisma.comparisonAttempt.findUniqueOrThrow({
      where: { comparisonAttemptId: outcome.comparisonAttemptId },
      select: { processingStatus: true, comparisonResult: true },
    });
    await this.auditWriter.record({
      eventType: "COMPARISON_REEVALUATED",
      result: "SUCCESS",
      actorUserId,
      targetType: "COMPARISON",
      targetId: comparisonId,
      afterData: { comparisonAttemptId: outcome.comparisonAttemptId, attemptNumber: outcome.attemptNumber, processingStatus: attempt.processingStatus, result: attempt.comparisonResult },
    });

    return {
      comparisonAttemptId: outcome.comparisonAttemptId,
      attemptNumber: outcome.attemptNumber,
      processingStatus: attempt.processingStatus as ComparisonProcessingStatus,
      result: attempt.comparisonResult as ComparisonResult | null,
    };
  }

  // API-CMP-008.
  async getComparisonChain(comparisonChainId: string, query: PaginationQueryDto): Promise<ComparisonChainDetailDto> {
    const chain = await this.prisma.comparisonChain.findUnique({
      where: { comparisonChainId },
      select: { comparisonChainId: true, projectId: true, apiId: true, environmentId: true, createdAt: true, _count: { select: { comparisons: true } } },
    });
    if (!chain) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Comparison chain does not exist");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const pairs = await this.prisma.comparison.findMany({
      where: { comparisonChainId },
      include: COMPARISON_SUMMARY_INCLUDE,
      orderBy: { pairOrdinal: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const totalItems = chain._count.comparisons;

    return {
      comparisonChainId: chain.comparisonChainId,
      projectId: chain.projectId,
      apiId: chain.apiId,
      environmentId: chain.environmentId,
      requestedAt: chain.createdAt,
      // N Snapshots produce N-1 adjacent pairs.
      selectedSnapshotCount: totalItems + 1,
      pairs: pairs.map((p) => ({ pairOrdinal: p.pairOrdinal!, comparison: toComparisonSummary(p) })),
      page,
      pageSize,
      totalItems,
      hasMore: page * pageSize < totalItems,
    };
  }

  // API-CMP-009 (CMP-002, Should). Append-only; expectedRevision is the
  // caller's optimistic-concurrency token (null == "not classified yet").
  async createClassificationEvent(comparisonId: string, dto: CreateClassificationEventDto, actorUserId: string): Promise<ClassificationEventResultDto> {
    const outcome = await this.comparisonService.recordClassification(comparisonId, {
      classification: dto.classification,
      note: dto.note,
      classifiedByUserId: actorUserId,
      expectedRevision: dto.expectedRevision,
    });
    if (!outcome.ok) {
      const message =
        outcome.code === "NOT_CLASSIFIABLE"
          ? "This Comparison is not classifiable — no COMPLETED/DIFFERENT attempt exists yet"
          : `Revision conflict — current revision is ${outcome.currentRevision}`;
      throw new BusinessException(HttpStatus.CONFLICT, outcome.code, message);
    }

    const created = await this.prisma.comparisonClassificationEvent.findUniqueOrThrow({
      where: { comparisonId_revision: { comparisonId, revision: outcome.revision } },
    });
    await this.auditWriter.record({
      eventType: "COMPARISON_CLASSIFIED",
      result: "SUCCESS",
      actorUserId,
      targetType: "COMPARISON",
      targetId: comparisonId,
      afterData: { classification: created.classification, revision: created.revision },
    });

    return {
      classificationEventId: created.comparisonClassificationEventId,
      revision: created.revision,
      classification: created.classification as ComparisonClassificationValue,
      note: created.note,
      classifiedBy: created.classifiedByUserId,
      classifiedAt: created.createdAt,
    };
  }

  // API-CMP-010. Full classification history, newest revision first.
  async listClassificationEvents(comparisonId: string, query: PaginationQueryDto): Promise<ComparisonPagedResult<ClassificationEventItemDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [rows, totalItems] = await Promise.all([
      this.prisma.comparisonClassificationEvent.findMany({
        where: { comparisonId },
        orderBy: { revision: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.comparisonClassificationEvent.count({ where: { comparisonId } }),
    ]);

    return {
      items: rows.map((r) => ({
        classificationEventId: r.comparisonClassificationEventId,
        revision: r.revision,
        classification: r.classification as ComparisonClassificationValue,
        note: r.note,
        classifiedBy: r.classifiedByUserId,
        classifiedAt: r.createdAt,
      })),
      page,
      pageSize,
      totalItems,
      hasMore: page * pageSize < totalItems,
    };
  }
}

type RetryFailureCode = Exclude<Extract<RetryComparisonOutcome, { ok: false }>["code"], "COMPARISON_NOT_FOUND">;

const RETRY_CONFLICT_MESSAGES: Record<RetryFailureCode, string> = {
  ALREADY_COMPLETED: "This Comparison already has a COMPLETED attempt and can never be retried",
  ATTEMPT_NOT_TERMINAL: "The latest attempt is still QUEUED or RUNNING",
  REASON_NOT_RETRYABLE: "The latest attempt's reason code is not retryable",
  CONCURRENT_RETRY: "A concurrent retry request was already accepted for this Comparison",
};

type ReevaluateFailureCode = Exclude<Extract<ReevaluateAttemptOutcome, { ok: false }>["code"], "COMPARISON_NOT_FOUND">;

const REEVALUATE_CONFLICT_MESSAGES: Record<ReevaluateFailureCode, string> = {
  LATEST_ATTEMPT_NOT_COMPLETED: "Re-evaluate requires the latest attempt to already be COMPLETED",
  CONCURRENT_REEVALUATION: "A concurrent re-evaluation request was already accepted for this Comparison",
};
