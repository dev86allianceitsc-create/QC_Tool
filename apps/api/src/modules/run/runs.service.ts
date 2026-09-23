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
  async createRun(projectId: string, dto: CreateRunDto, actorUserId: string): Promise<RunDetail> {
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
        const reasonCode = evaluateEligibility(api.path, config, paramDefsByApiId.get(exec.apiId) ?? [], {
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
        data: { projectId, environmentId: dto.environmentId, createdBy: actorUserId, runType: dto.runType, runStatus: "PENDING" },
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
      items: rows.map((r) => ({
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
      })),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
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
      executions: executions.map((e) => this.toExecutionListItem(e)),
    };
  }
}
