import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { Prisma, Run, RunExecution } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import type { PagedResult } from "../audit/audit-query.service";
import { assertProjectActive } from "../api-environment/apis.service";
import { CreateRunDto } from "./dto/create-run.dto";
import { ListRunsQueryDto } from "./dto/list-runs-query.dto";
import { ListApiRunExecutionsQueryDto } from "./dto/list-api-run-executions-query.dto";
import { evaluateEligibility } from "./run-eligibility.util";
import { resolveEffectiveUrl } from "../api-environment/full-url-resolution.util";
import { RunExecutionEngine, type PendingExecutionContext } from "./run-execution.engine";

export interface RunExecutionSummary {
  totalApis: number;
  responseReceivedCount: number;
  runErrorCount: number;
  skippedCount: number;
  unfinishedCount: number;
}

export interface RunExecutionListItem {
  executionId: string;
  apiId: string;
  executionOrder: number;
  executionStatus: string;
  executionOutcome: string | null;
  skipReasonCode: string | null;
  httpStatus: number | null;
  apiVersion: string;
  databaseVersion: string;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  // Phase 3 Test Case History & Run Again — frozen at dispatch time (null for
  // executions that never reached dispatch, e.g. SKIPPED/NOT_EXECUTED). See
  // RunExecution.authType/testCaseKey schema doc comments.
  testCaseKey: string | null;
  authType: string | null;
  // Advanced "Re-run this execution" lineage only — null for every ordinary
  // Run Again/Run API execution, see RunExecution.rerunOfExecutionId.
  rerunOfExecutionId: string | null;
}

export interface RunDetail {
  runId: string;
  projectId: string;
  environmentId: string;
  createdBy: string;
  runType: string;
  runStatus: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  note: string | null;
  summary: RunExecutionSummary;
  // The Test Account selected for this whole Run (null when the Environment's
  // authType is not LOGIN_FORM, or none was selected) — one value for every
  // execution in the Run, so surfaced once here rather than repeated per item.
  testAccountId: string | null;
  executions: RunExecutionListItem[];
}

export interface RunListItem {
  runId: string;
  runType: string;
  runStatus: string;
  // Only populated for SINGLE (its one execution's apiId) — UI-RUN-07's
  // "API or API count" column needs the actual API identity for Single Runs;
  // Batch already has that via summary.totalApis. Null for BATCH rather than
  // an array, since a Run list row is not the place to join N APIs.
  apiId: string | null;
  environmentId: string;
  createdBy: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  summary: RunExecutionSummary;
}

export interface SnapshotSaveInfo {
  state: "SAVED" | "NOT_CREATED" | "SAVE_FAILED" | "PENDING" | "UNKNOWN";
  snapshotId?: string;
  reasonCode?: string;
  message?: string;
}

// Group 6/7 Comparison AnD API v0.2 requirement "extend existing Run/Execution
// contract to expose baseline/availability/Comparison link, without a
// duplicate public Run endpoint" — same additive-optional-field precedent as
// snapshotSave above (AnD API Group 5 Snapshot §7). baselineSnapshotId/
// reasonCode are read straight from the Execution's own already-locked
// columns (never recomputed); comparisonId is populated only once the
// AUTO_EXECUTION Comparison this Execution sourced actually exists (it may
// not yet, e.g. Comparison creation happens after Snapshot save completes).
export interface ComparisonAvailabilityInfo {
  baselineSnapshotId: string | null;
  reasonCode: string | null;
  comparisonId: string | null;
}

export interface RunExecutionDetail {
  runId: string;
  executionId: string;
  apiId: string;
  environmentId: string;
  executionOrder: number;
  executionStatus: string;
  executionOutcome: string | null;
  actualRequest: {
    method: string;
    url: string;
    query: Prisma.JsonValue | null;
    headers: Prisma.JsonValue | null;
    body: string | null;
  } | null;
  httpResponse: {
    httpStatus: number | null;
    headers: Prisma.JsonValue | null;
    body: string | null;
    contentType: string | null;
    bodyKind: string | null;
    isTruncated: boolean;
    originalSizeBytes: number | null;
  } | null;
  executionError: { reasonCode: string; message: string | null } | null;
  skipReason: { reasonCode: string } | null;
  apiVersion: string;
  databaseVersion: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  // AnD API Group 5 Snapshot §7 "Existing Run API Extension" (SNP-001/006/007
  // · Approved proposal) — backward-compatible optional field, added without
  // touching executionOutcome/httpStatus above. See deriveSnapshotSave.
  snapshotSave: SnapshotSaveInfo | null;
  // Group 6/7 Comparison AnD API v0.2 Run-extension requirement — see
  // ComparisonAvailabilityInfo doc comment. See deriveComparisonAvailability.
  comparisonAvailability: ComparisonAvailabilityInfo | null;
  // Phase 3 Test Case History & Run Again — see RunExecutionListItem's
  // matching fields for testCaseKey/authType/rerunOfExecutionId; testAccountId
  // here is the parent Run's selected Test Account (Run.testAccountId).
  testCaseKey: string | null;
  authType: string | null;
  testAccountId: string | null;
  rerunOfExecutionId: string | null;
}

export interface ApiRunExecutionListItem {
  runId: string;
  executionId: string;
  runType: string;
  environmentId: string;
  executionStatus: string;
  executionOutcome: string | null;
  httpStatus: number | null;
  apiVersion: string;
  databaseVersion: string;
  createdAt: Date;
  // Phase 3 Test Case History & Run Again — see RunExecutionDetail's matching
  // fields.
  testCaseKey: string | null;
  authType: string | null;
  testAccountId: string | null;
  rerunOfExecutionId: string | null;
  // Phase 3 §8 Test Case History drill-down — this row's own comparison
  // outcome, same derivation/precedence as TestCaseListItem.lastResult (see
  // deriveTestCaseLastResult): never conflates "no comparison" (UNAVAILABLE)
  // with "different test case" or with SAME/DIFFERENT.
  comparisonResult: "SAME" | "DIFFERENT" | "INITIAL_RUN" | "UNAVAILABLE";
  // The baseline Snapshot's completedAt this row was actually compared
  // against (null whenever comparisonResult is INITIAL_RUN/UNAVAILABLE with
  // no baseline at all) — resolved straight from baselineSnapshotId, no new
  // storage. See deriveComparedWithAt.
  comparedWithAt: Date | null;
  // The AUTO_EXECUTION Comparison this row's own execution sourced, when one
  // exists (same lookup as deriveComparisonAvailability) — lets a SAME/
  // DIFFERENT row's "View Differences" action open that Comparison directly
  // instead of the execution's own detail page. Null whenever comparisonResult
  // is not SAME/DIFFERENT.
  comparisonId: string | null;
}

// Phase 3 Test Case History & Run Again (§7/§8) — one card per distinct
// testCaseKey for this API, backing the Run History tab's grouped view.
// lastResult follows the same derivation precedence as
// RunsService.deriveTestCaseLastResult: INITIAL_RUN (no baseline existed yet,
// concept A had nothing to chain to), SAME/DIFFERENT (concept C — the only
// two values ever shown as an automatic comparison's actual outcome), or
// UNAVAILABLE (a baseline candidate existed but no Comparison ever completed
// against it — blocked at ELIGIBILITY/INPUT (concept B), no target Snapshot
// was produced, or it is still in flight). Never conflates "no comparison
// result yet" with "different test case" — a card's identity is testCaseKey
// alone.
export interface TestCaseListItem {
  testCaseKey: string;
  apiId: string;
  environmentId: string;
  environmentName: string;
  authType: string | null;
  testAccountId: string | null;
  testAccountLabel: string | null;
  // The latest execution's raw submitted Request Input (RunExecution.
  // requestInputSnapshot) — rendering is a frontend concern, not reshaped
  // here.
  inputSummary: Prisma.JsonValue | null;
  lastRunAt: Date;
  lastExecutionId: string;
  lastResult: "SAME" | "DIFFERENT" | "INITIAL_RUN" | "UNAVAILABLE";
  runCount: number;
  // Stable display ordinal — ranked by this Test Case's first-ever run, which
  // never changes once set. Deliberately independent of lastRunAt (the list
  // itself still sorts most-recently-run first, below): a card's number must
  // never shift just because it, or any other card, was Run Again.
  testCaseNumber: number;
}

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
    private readonly executionEngine: RunExecutionEngine,
  ) {}

  // API-RUN-001 createRun. Single rejects the whole request with 422 when
  // its one execution is ineligible (no Run is created); Batch instead
  // accepts and marks each ineligible child SKIPPED while eligible children
  // proceed (REQ-RUN-001 RS-001-08; AnD API doc: "do not treat an individual
  // SKIPPED as rejection of entire accepted Batch"). Dispatch is kicked off
  // fire-and-forget after the transaction commits — the response returns
  // immediately with the created Run/executions; callers poll getRun /
  // getRunExecution for live status.
  // extra is populated only by reRunExecution (§5, advanced) — ordinary
  // createRun callers (the HTTP endpoint, and runAgain below) never pass it.
  // Kept as a trailing optional parameter rather than a second method so the
  // ~140-line validation/transaction body here is never duplicated.
  async createRun(projectId: string, dto: CreateRunDto, actorUserId: string, extra?: { rerunOfExecutionId?: string; forcedBaselineSourceExecutionId?: string }): Promise<RunDetail> {
    if (dto.runType === "SINGLE" && dto.executions.length !== 1) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "A Single Run must contain exactly one execution");
    }
    const apiIds = dto.executions.map((e) => e.apiId);
    if (new Set(apiIds).size !== apiIds.length) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "executions[].apiId must not contain duplicates");
    }

    const { run, executions, pending } = await this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const environment = await tx.environment.findFirst({ where: { environmentId: dto.environmentId, projectId } });
      if (!environment) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Environment does not exist");
      }
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }
      if (!environment.allowRun) {
        throw new BusinessException(HttpStatus.FORBIDDEN, "RUN_NOT_ALLOWED", "This Environment does not allow Run");
      }

      if (dto.testAccountId) {
        const testAccount = await tx.testAccount.findFirst({ where: { testAccountId: dto.testAccountId, environmentId: dto.environmentId } });
        if (!testAccount) {
          throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Test Account does not exist in this Environment");
        }
      }

      const apis = await tx.apiConfiguration.findMany({ where: { apiId: { in: apiIds }, projectId, deletedAt: null } });
      if (apis.length !== apiIds.length) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "One or more API does not exist in this Project");
      }
      const apiById = new Map(apis.map((a) => [a.apiId, a]));

      const [configs, paramDefs] = await Promise.all([
        tx.apiEnvironmentConfig.findMany({ where: { apiId: { in: apiIds }, environmentId: dto.environmentId } }),
        tx.requestParameterDefinition.findMany({ where: { apiId: { in: apiIds } } }),
      ]);
      const configByApiId = new Map(configs.map((c) => [c.apiId, c]));
      const paramDefsByApiId = new Map<string, typeof paramDefs>();
      for (const def of paramDefs) {
        const list = paramDefsByApiId.get(def.apiId) ?? [];
        list.push(def);
        paramDefsByApiId.set(def.apiId, list);
      }

      const evaluations = dto.executions.map((exec, idx) => {
        const api = apiById.get(exec.apiId)!;
        const config = configByApiId.get(exec.apiId) ?? null;
        const effectiveUrl = resolveEffectiveUrl(config?.fullUrl, environment.baseUrl, api.path).url;
        const reasonCode = evaluateEligibility(api.path, effectiveUrl, paramDefsByApiId.get(exec.apiId) ?? [], {
          pathValues: exec.requestValues.pathValues ?? {},
          queryValues: exec.requestValues.queryValues ?? {},
          headerValues: exec.requestValues.headerValues ?? {},
        });
        return { exec, order: idx + 1, reasonCode };
      });

      if (dto.runType === "SINGLE" && evaluations[0].reasonCode) {
        const message =
          evaluations[0].reasonCode === "MISSING_FULL_URL"
            ? "This API has no Full URL configured for the selected Environment"
            : "One or more required input is missing";
        throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", message);
      }

      const createdRun = await tx.run.create({
        data: {
          projectId,
          environmentId: dto.environmentId,
          testAccountId: dto.testAccountId ?? null,
          createdBy: actorUserId,
          runType: dto.runType,
          runStatus: "PENDING",
        },
      });

      await tx.runExecution.createMany({
        data: evaluations.map(({ exec, order, reasonCode }) => ({
          runId: createdRun.runId,
          apiId: exec.apiId,
          executionOrder: order,
          executionStatus: reasonCode ? "SKIPPED" : "PENDING",
          executionOutcome: reasonCode ? "SKIPPED" : null,
          skipReasonCode: reasonCode,
          apiVersion: exec.apiVersion?.trim() || "UNKNOWN",
          databaseVersion: exec.databaseVersion?.trim() || "UNKNOWN",
          responseBodyIsTruncated: false,
          // Phase 3 Test Case History & Run Again — frozen once here,
          // regardless of eligibility/eventual dispatch outcome, as the
          // literal raw input "Run Again" replays later (see schema doc
          // comment on RunExecution.requestInputSnapshot).
          requestInputSnapshot: {
            pathValues: exec.requestValues.pathValues ?? {},
            queryValues: exec.requestValues.queryValues ?? {},
            headerValues: exec.requestValues.headerValues ?? {},
            bodyValue: exec.requestValues.bodyValue ?? "",
          } satisfies Prisma.JsonObject,
          // §5 advanced "Re-run this execution" lineage/audit only — null for
          // every ordinary Run Again/Run API execution.
          rerunOfExecutionId: extra?.rerunOfExecutionId ?? null,
        })),
      });

      const createdExecutions = await tx.runExecution.findMany({ where: { runId: createdRun.runId }, orderBy: { executionOrder: "asc" } });

      await this.auditWriter.record(
        {
          eventType: "RUN_CREATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "RUN",
          targetId: createdRun.runId,
          targetDisplay: `${dto.runType} Run on ${environment.environmentName}`,
          projectId,
          afterData: { runType: dto.runType, environmentId: dto.environmentId, apiCount: apiIds.length },
        },
        tx,
      );

      const pendingExecutions: PendingExecutionContext[] = evaluations
        .filter((e) => !e.reasonCode)
        .map((e) => ({
          runExecutionId: createdExecutions.find((row) => row.apiId === e.exec.apiId)!.runExecutionId,
          apiId: e.exec.apiId,
          requestValues: {
            pathValues: e.exec.requestValues.pathValues ?? {},
            queryValues: e.exec.requestValues.queryValues ?? {},
            headerValues: e.exec.requestValues.headerValues ?? {},
            bodyValue: e.exec.requestValues.bodyValue ?? "",
          },
          forcedBaselineSourceExecutionId: extra?.forcedBaselineSourceExecutionId ?? null,
        }));

      return { run: createdRun, executions: createdExecutions, pending: pendingExecutions };
    });

    this.executionEngine.dispatchRun(run.runId, run.environmentId, pending).catch((err: unknown) => {
      this.logger.error(`Run execution engine failed for run ${run.runId}`, err instanceof Error ? err.stack : String(err));
    });

    return this.toRunDetail(run, executions);
  }

  async listRuns(projectId: string, query: ListRunsQueryDto): Promise<PagedResult<RunListItem>> {
    const project = await this.prisma.project.findFirst({ where: { projectId, deletedAt: null } });
    if (!project) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.RunWhereInput = { projectId };
    if (query.environmentId) {
      where.environmentId = query.environmentId;
    }
    if (query.runType) {
      where.runType = query.runType;
    }
    if (query.runStatus) {
      where.runStatus = query.runStatus;
    }
    if (query.apiId) {
      where.executions = { some: { apiId: query.apiId } };
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }

    const [rows, totalItems] = await Promise.all([
      this.prisma.run.findMany({
        where,
        include: { executions: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.run.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        runId: r.runId,
        runType: r.runType,
        runStatus: r.runStatus,
        apiId: r.runType === "SINGLE" ? (r.executions[0]?.apiId ?? null) : null,
        environmentId: r.environmentId,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        summary: this.computeSummary(r.executions),
      })),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  async getRun(projectId: string, runId: string): Promise<RunDetail> {
    const run = await this.prisma.run.findFirst({
      where: { runId, projectId },
      include: { executions: { orderBy: { executionOrder: "asc" } } },
    });
    if (!run) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Run does not exist");
    }
    return this.toRunDetail(run, run.executions);
  }

  async getRunExecution(projectId: string, runId: string, executionId: string): Promise<RunExecutionDetail> {
    const run = await this.prisma.run.findFirst({ where: { runId, projectId } });
    if (!run) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Run does not exist");
    }
    const exec = await this.prisma.runExecution.findFirst({ where: { runExecutionId: executionId, runId } });
    if (!exec) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Run Execution does not exist");
    }

    return {
      runId: run.runId,
      executionId: exec.runExecutionId,
      apiId: exec.apiId,
      environmentId: run.environmentId,
      executionOrder: exec.executionOrder,
      executionStatus: exec.executionStatus,
      executionOutcome: exec.executionOutcome,
      actualRequest: exec.requestMethod
        ? {
            method: exec.requestMethod,
            url: exec.requestUrlSafe ?? "",
            query: exec.requestQuerySafe,
            headers: exec.requestHeadersSafe,
            body: exec.requestBodySafe,
          }
        : null,
      httpResponse: exec.responseReceivedAt
        ? {
            httpStatus: exec.httpStatus,
            headers: exec.responseHeadersSafe,
            body: exec.responseBodySafe,
            contentType: exec.responseContentType,
            bodyKind: exec.responseBodyKind,
            isTruncated: exec.responseBodyIsTruncated,
            originalSizeBytes: exec.responseBodySizeBytes,
          }
        : null,
      executionError: exec.errorReasonCode ? { reasonCode: exec.errorReasonCode, message: exec.errorMessageSafe } : null,
      skipReason: exec.skipReasonCode ? { reasonCode: exec.skipReasonCode } : null,
      apiVersion: exec.apiVersion,
      databaseVersion: exec.databaseVersion,
      createdAt: exec.createdAt,
      startedAt: exec.startedAt,
      endedAt: exec.endedAt,
      durationMs: exec.durationMs,
      snapshotSave: await this.deriveSnapshotSave(exec),
      comparisonAvailability: await this.deriveComparisonAvailability(exec),
      testCaseKey: exec.testCaseKey,
      authType: exec.authType,
      testAccountId: run.testAccountId,
      rerunOfExecutionId: exec.rerunOfExecutionId,
    };
  }

  async listApiRunExecutions(projectId: string, apiId: string, query: ListApiRunExecutionsQueryDto): Promise<PagedResult<ApiRunExecutionListItem>> {
    const api = await this.prisma.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
    if (!api) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist in this Project");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.RunExecutionWhereInput = { apiId };
    if (query.environmentId) {
      where.run = { environmentId: query.environmentId };
    }
    if (query.testCaseKey) {
      where.testCaseKey = query.testCaseKey;
    }

    const [rows, totalItems] = await Promise.all([
      this.prisma.runExecution.findMany({
        where,
        include: { run: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.runExecution.count({ where }),
    ]);

    return {
      items: await Promise.all(
        rows.map(async (r) => ({
          runId: r.runId,
          executionId: r.runExecutionId,
          runType: r.run.runType,
          environmentId: r.run.environmentId,
          executionStatus: r.executionStatus,
          executionOutcome: r.executionOutcome,
          httpStatus: r.httpStatus,
          apiVersion: r.apiVersion,
          databaseVersion: r.databaseVersion,
          createdAt: r.createdAt,
          testCaseKey: r.testCaseKey,
          authType: r.authType,
          testAccountId: r.run.testAccountId,
          rerunOfExecutionId: r.rerunOfExecutionId,
          comparisonResult: await this.deriveTestCaseLastResult(r),
          comparedWithAt: await this.deriveComparedWithAt(r),
          comparisonId: (await this.deriveComparisonAvailability(r))?.comparisonId ?? null,
        })),
      ),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  // Phase 3 Test Case History & Run Again (§7/§8) — one row per distinct
  // testCaseKey, each the group's latest execution (idx_run_executions_
  // test_case_key_sent_at backs both the distinct-on ordering here and the
  // groupBy count below). requestSentAt is never null whenever testCaseKey is
  // set — run-execution.engine.ts's dispatchOne builds both in the same
  // requestTrace object, spread into every terminal update alongside
  // testCaseKey — so ordering by it (rather than createdAt) is safe and
  // matches the index. Not paginated: cardinality is one row per logical test
  // case for a single API, not per execution.
  async listTestCases(projectId: string, apiId: string): Promise<TestCaseListItem[]> {
    const api = await this.prisma.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
    if (!api) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist in this Project");
    }

    const where: Prisma.RunExecutionWhereInput = { apiId, testCaseKey: { not: null } };
    const latestPerKey = await this.prisma.runExecution.findMany({
      where,
      distinct: ["testCaseKey"],
      orderBy: [{ testCaseKey: "asc" }, { requestSentAt: "desc" }],
      include: { run: { include: { environment: true, testAccount: true } } },
    });
    if (latestPerKey.length === 0) {
      return [];
    }

    const testCaseKeys = latestPerKey.map((exec) => exec.testCaseKey!);
    const runCounts = await this.prisma.runExecution.groupBy({
      by: ["testCaseKey"],
      where: { ...where, testCaseKey: { in: testCaseKeys } },
      _count: { testCaseKey: true },
      _min: { requestSentAt: true },
    });
    const runCountByKey = new Map(runCounts.map((row) => [row.testCaseKey!, row._count.testCaseKey]));
    // _min.requestSentAt is this Test Case's first-ever run — unlike lastRunAt
    // (the latest execution's own requestSentAt, which moves on every Run
    // Again), this never changes once a testCaseKey has run at least once, so
    // it is the basis for the stable testCaseNumber below, not list position.
    const firstRunAtByKey = new Map(runCounts.map((row) => [row.testCaseKey!, row._min.requestSentAt!]));

    const items = await Promise.all(
      latestPerKey.map(async (exec) => ({
        testCaseKey: exec.testCaseKey!,
        apiId: exec.apiId,
        environmentId: exec.run.environmentId,
        environmentName: exec.run.environment.environmentName,
        authType: exec.authType,
        testAccountId: exec.run.testAccountId,
        testAccountLabel: exec.run.testAccount?.label ?? null,
        inputSummary: exec.requestInputSnapshot,
        lastRunAt: exec.requestSentAt ?? exec.createdAt,
        lastExecutionId: exec.runExecutionId,
        lastResult: await this.deriveTestCaseLastResult(exec),
        runCount: runCountByKey.get(exec.testCaseKey!) ?? 1,
        firstRunAt: firstRunAtByKey.get(exec.testCaseKey!) ?? exec.requestSentAt ?? exec.createdAt,
      })),
    );

    // Bug fix (Run Again reshuffling "Test Case N"): the number must be
    // assigned by first-run order, computed once per testCaseKey here, and
    // then carried through regardless of how the list below gets sorted for
    // display. Ties (identical firstRunAt) broken by testCaseKey so the
    // ranking is fully deterministic.
    const numberByKey = new Map(
      [...items]
        .sort(
          (a, b) =>
            a.firstRunAt.getTime() - b.firstRunAt.getTime() || a.testCaseKey.localeCompare(b.testCaseKey),
        )
        .map((item, index) => [item.testCaseKey, index + 1] as const),
    );

    return items
      .map(({ firstRunAt, ...item }) => ({ ...item, testCaseNumber: numberByKey.get(item.testCaseKey)! }))
      .sort((a, b) => b.lastRunAt.getTime() - a.lastRunAt.getTime());
  }

  // AnD API Group 5 Snapshot §7 Run Extension: reasonCode domain beyond what
  // the DB already enforces (MISSING_FULL_URL/MISSING_REQUIRED_INPUT from
  // skipReasonCode; TIMEOUT/DNS_ERROR/TLS_ERROR/CONNECTION_ERROR/
  // UNKNOWN_EXECUTION_ERROR/HTTP_ERROR from errorReasonCode; PAYLOAD_TOO_LARGE/
  // UNKNOWN_ERROR from SnapshotSaveAttempt.errorReasonCode) is left "chờ
  // API/Run mapping" by the doc. NON_2XX_RESPONSE/INTERRUPTED/NOT_EXECUTED
  // below are Claude-derived additions — the real gap they cover is
  // executionOutcome RESPONSE_RECEIVED with a 3xx httpStatus, which Snapshot
  // eligibility (strict 200-299, REQ-SNP-002) never even attempts to save.
  // `message` is intentionally never populated here: SnapshotSaveAttempt's
  // UNKNOWN_ERROR errorDetail is raw err.message text (unlike
  // executionError.message, which is the already-sanitized errorMessageSafe
  // column), so surfacing it as an API-facing "safe description" would risk
  // leaking internal error text. Flagged to the user, not silently assumed.
  private async deriveSnapshotSave(exec: RunExecution): Promise<SnapshotSaveInfo | null> {
    const snapshot = await this.prisma.snapshot.findUnique({
      where: { runExecutionId: exec.runExecutionId },
      select: { snapshotId: true },
    });
    if (snapshot) {
      return { state: "SAVED", snapshotId: snapshot.snapshotId };
    }

    if (exec.executionStatus === "PENDING" || exec.executionStatus === "RUNNING") {
      // Save has not even been attempted yet — nothing to report.
      return null;
    }
    if (exec.executionStatus === "SKIPPED") {
      return { state: "NOT_CREATED", reasonCode: exec.skipReasonCode ?? undefined };
    }
    if (exec.executionStatus === "INTERRUPTED") {
      return { state: "NOT_CREATED", reasonCode: "INTERRUPTED" };
    }
    if (exec.executionStatus === "NOT_EXECUTED") {
      return { state: "NOT_CREATED", reasonCode: "NOT_EXECUTED" };
    }

    // executionStatus === "COMPLETED" from here on.
    if (exec.executionOutcome === "RUN_ERROR") {
      return { state: "NOT_CREATED", reasonCode: exec.errorReasonCode ?? undefined };
    }
    if (exec.executionOutcome === "RESPONSE_RECEIVED") {
      if (exec.httpStatus === null || exec.httpStatus < 200 || exec.httpStatus >= 300) {
        return { state: "NOT_CREATED", reasonCode: "NON_2XX_RESPONSE" };
      }

      // Eligible (2xx) but no Snapshot row — check what the save attempt says.
      const attempt = await this.prisma.snapshotSaveAttempt.findFirst({
        where: { runExecutionId: exec.runExecutionId },
        orderBy: { attemptedAt: "desc" },
      });
      if (!attempt) {
        // Attempt log itself may not have been written (e.g. DB unavailable
        // at that moment) — must not be conflated with a confirmed error.
        return { state: "UNKNOWN" };
      }
      if (attempt.attemptStatus === "FAILED") {
        return { state: "SAVE_FAILED", reasonCode: attempt.errorReasonCode ?? undefined };
      }
      // attemptStatus SUCCEEDED but no Snapshot row is a contradiction the
      // write path should never produce (both created in one transaction).
      return { state: "UNKNOWN" };
    }

    return { state: "UNKNOWN" };
  }

  // baselineSnapshotId/reasonCode come straight from the Execution row — set
  // once, before dispatch, never reselected (Comparison AnD Section 4.1).
  // comparisonId looks up the AUTO_EXECUTION Comparison keyed by this
  // Execution's unique sourceExecutionId; null until/unless that Comparison
  // has actually been created (e.g. still pending Snapshot save, or no
  // baseline/target was ever available).
  private async deriveComparisonAvailability(exec: RunExecution): Promise<ComparisonAvailabilityInfo | null> {
    if (exec.executionStatus !== "COMPLETED" && exec.executionStatus !== "RUNNING") {
      return null;
    }

    const comparison = await this.prisma.comparison.findUnique({
      where: { sourceExecutionId: exec.runExecutionId },
      select: { comparisonId: true },
    });

    return {
      baselineSnapshotId: exec.baselineSnapshotId,
      reasonCode: exec.comparisonAvailabilityReasonCode,
      comparisonId: comparison?.comparisonId ?? null,
    };
  }

  // Phase 3 Test Case History & Run Again (§8) — the Test Case card's
  // lastResult, built on top of deriveComparisonAvailability (same
  // Execution-level columns, no re-derivation of baseline/availability
  // logic). INITIAL_RUN and UNAVAILABLE are concept-A/B outcomes; SAME/
  // DIFFERENT is the only pair ever read from a Comparison's own result
  // (concept C) — never conflated with "no comparison" or "blocked".
  private async deriveTestCaseLastResult(exec: RunExecution): Promise<TestCaseListItem["lastResult"]> {
    const availability = await this.deriveComparisonAvailability(exec);
    if (!availability) {
      return "UNAVAILABLE";
    }
    if (availability.reasonCode === "NO_BASELINE") {
      return "INITIAL_RUN";
    }
    if (!availability.comparisonId) {
      return "UNAVAILABLE";
    }

    const latestAttempt = await this.prisma.comparisonAttempt.findFirst({
      where: { comparisonId: availability.comparisonId },
      orderBy: { attemptNumber: "desc" },
      select: { processingStatus: true, comparisonResult: true },
    });
    if (latestAttempt?.processingStatus === "COMPLETED" && (latestAttempt.comparisonResult === "SAME" || latestAttempt.comparisonResult === "DIFFERENT")) {
      return latestAttempt.comparisonResult;
    }
    return "UNAVAILABLE";
  }

  // Phase 3 Test Case History & Run Again (§8 drill-down) — "Compared with:
  // <timestamp>" resolves straight from the Execution's own locked
  // baselineSnapshotId (set once, never reselected, per deriveComparisonAvailability's
  // doc comment) to that Snapshot's completedAt. Null whenever no baseline
  // was ever selected for this row (concept A found nothing, or this row
  // never reached comparison at all) — never fabricated from comparedWithAt
  // being merely unset.
  private async deriveComparedWithAt(exec: RunExecution): Promise<Date | null> {
    const availability = await this.deriveComparisonAvailability(exec);
    if (!availability?.baselineSnapshotId) {
      return null;
    }
    const baseline = await this.prisma.snapshot.findUnique({
      where: { snapshotId: availability.baselineSnapshotId },
      select: { completedAt: true },
    });
    return baseline?.completedAt ?? null;
  }

  private computeSummary(executions: RunExecution[]): RunExecutionSummary {
    return {
      totalApis: executions.length,
      responseReceivedCount: executions.filter((e) => e.executionOutcome === "RESPONSE_RECEIVED").length,
      runErrorCount: executions.filter((e) => e.executionOutcome === "RUN_ERROR").length,
      skippedCount: executions.filter((e) => e.executionOutcome === "SKIPPED").length,
      unfinishedCount: executions.filter((e) => e.executionStatus === "PENDING" || e.executionStatus === "RUNNING").length,
    };
  }

  private toExecutionListItem(e: RunExecution): RunExecutionListItem {
    return {
      executionId: e.runExecutionId,
      apiId: e.apiId,
      executionOrder: e.executionOrder,
      executionStatus: e.executionStatus,
      executionOutcome: e.executionOutcome,
      skipReasonCode: e.skipReasonCode,
      httpStatus: e.httpStatus,
      apiVersion: e.apiVersion,
      databaseVersion: e.databaseVersion,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      durationMs: e.durationMs,
      testCaseKey: e.testCaseKey,
      authType: e.authType,
      rerunOfExecutionId: e.rerunOfExecutionId,
    };
  }

  private toRunDetail(run: Run, executions: RunExecution[]): RunDetail {
    return {
      runId: run.runId,
      projectId: run.projectId,
      environmentId: run.environmentId,
      createdBy: run.createdBy,
      runType: run.runType,
      runStatus: run.runStatus,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      note: run.note,
      summary: this.computeSummary(executions),
      testAccountId: run.testAccountId,
      executions: executions.map((e) => this.toExecutionListItem(e)),
    };
  }

  // Plan §4 "Run Again" — a thin convenience over createRun: look up a Test
  // Case's most recent execution's saved input and resubmit it unchanged.
  // Baseline selection then happens exactly like any fresh dispatch (same
  // testCaseKey ⇒ selectBaselineSnapshot naturally finds this execution's own
  // Snapshot as the new one's baseline) — no new dispatch mode, no lineage
  // column, no new sourceKind. Ordinary "Run API" and "Run Again" are the same
  // backend path by construction.
  async runAgain(projectId: string, apiId: string, executionId: string, actorUserId: string): Promise<RunDetail> {
    const execution = await this.prisma.runExecution.findFirst({
      where: { runExecutionId: executionId, apiId, run: { projectId } },
      include: { run: true },
    });
    if (!execution) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Run Execution does not exist");
    }
    if (!execution.requestInputSnapshot) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "NO_SAVED_INPUT",
        "This execution has no saved Request Input to run again (it predates this feature)",
      );
    }

    const dto = this.buildReplayDto(execution, apiId, execution.requestInputSnapshot as Prisma.JsonObject);
    return this.createRun(projectId, dto, actorUserId);
  }

  // Plan §5 "Re-run this execution" (advanced) — same input-resolution as
  // runAgain, but forces the comparison baseline to this specific source
  // execution's own produced Snapshot (see RunExecutionEngine.
  // resolveForcedBaseline) instead of letting testCaseKey auto-select the
  // latest one, and records rerunOfExecutionId for lineage/audit display.
  // Scope: only post-migration source executions (requestInputSnapshot
  // present) are replayable — see §9/requestInputSnapshot doc comment: no
  // faithful raw-input backfill exists for pre-migration rows, and since this
  // migration has not yet shipped to any running environment, no such row can
  // exist in practice. Reconstructing a request from the frozen *resolved*
  // trace instead (lossy, and its headers are already redaction-masked for
  // display) was judged worse than refusing, so NOT_REPLAYABLE covers both
  // "never dispatched" and "pre-migration" cases uniformly.
  async reRunExecution(projectId: string, apiId: string, executionId: string, actorUserId: string): Promise<RunDetail> {
    const execution = await this.prisma.runExecution.findFirst({
      where: { runExecutionId: executionId, apiId, run: { projectId } },
      include: { run: true },
    });
    if (!execution) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Run Execution does not exist");
    }
    if (!execution.requestInputSnapshot) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "NOT_REPLAYABLE",
        "This execution has nothing replayable saved (it was never dispatched, or predates this feature)",
      );
    }

    const dto = this.buildReplayDto(execution, apiId, execution.requestInputSnapshot as Prisma.JsonObject);
    return this.createRun(projectId, dto, actorUserId, {
      rerunOfExecutionId: executionId,
      forcedBaselineSourceExecutionId: executionId,
    });
  }

  // Shared by runAgain/reRunExecution — both resubmit the exact same saved
  // Request Input through createRun's one validation/dispatch path (plan §4:
  // "factor into one small private helper so both paths share it instead of
  // duplicating ~15 lines"); they differ only in the optional `extra` they
  // pass to createRun, not in how the DTO itself is built.
  private buildReplayDto(execution: RunExecution & { run: Run }, apiId: string, snapshot: Prisma.JsonObject): CreateRunDto {
    const requestInput = snapshot as unknown as {
      pathValues?: Record<string, string>;
      queryValues?: Record<string, string>;
      headerValues?: Record<string, string>;
      bodyValue?: string;
    };
    return {
      runType: "SINGLE",
      environmentId: execution.run.environmentId,
      testAccountId: execution.run.testAccountId ?? undefined,
      executions: [
        {
          apiId,
          requestValues: {
            pathValues: requestInput.pathValues ?? {},
            queryValues: requestInput.queryValues ?? {},
            headerValues: requestInput.headerValues ?? {},
            bodyValue: requestInput.bodyValue ?? "",
          },
          apiVersion: execution.apiVersion,
          databaseVersion: execution.databaseVersion,
        },
      ],
    };
  }
}
