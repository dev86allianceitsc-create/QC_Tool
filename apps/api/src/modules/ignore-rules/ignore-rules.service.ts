import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuditWriterService } from "../audit/audit-writer.service";
import { assertProjectActive, isUniqueConstraintError } from "../api-environment/apis.service";
import { IgnoreRuleRef } from "./ignore-rule-path-matcher.util";
import { CreateIgnoreRuleDto, IgnoreRuleScope } from "./dto/create-ignore-rule.dto";
import { BulkCreateIgnoreRulesDto } from "./dto/bulk-create-ignore-rules.dto";
import { UpdateIgnoreRuleDto } from "./dto/update-ignore-rule.dto";
import { ListIgnoreRulesQueryDto } from "./dto/list-ignore-rules-query.dto";

export interface IgnoreRuleResult {
  ignoreRuleId: string;
  projectId: string;
  apiId: string | null;
  apiName: string | null;
  apiMethod: string | null;
  apiPath: string | null;
  scope: IgnoreRuleScope;
  path: string;
  enabled: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkCreateIgnoreRulesResult {
  created: IgnoreRuleResult[];
  skippedCount: number;
}

type IgnoreRuleWithApi = Prisma.IgnoreRuleGetPayload<{
  include: { api: { select: { apiName: true; httpMethod: true; path: true } } };
}>;

const API_SELECT = { api: { select: { apiName: true, httpMethod: true, path: true } } } as const;

// ignore_rules CRUD — Project Settings' Ignore Rules view + the bulk-create
// entry point from View Differences' "Ignore selected (N)" (spec §4/§5).
// Modeled directly on TestAccountService's $transaction/assertProjectActive/
// isUniqueConstraintError/auditWriter.record shape (see that file). The one
// addition beyond that template is listActiveRulesForScope — not
// controller-facing, consumed only by ComparisonEngineService's OUTPUT stage.
@Injectable()
export class IgnoreRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async list(projectId: string, query: ListIgnoreRulesQueryDto): Promise<IgnoreRuleResult[]> {
    await assertProjectExists(this.prisma, projectId);

    const where: Prisma.IgnoreRuleWhereInput = { projectId };
    if (query.apiId !== undefined) where.apiId = query.apiId;
    if (query.scope !== undefined) where.scope = query.scope;
    if (query.enabled !== undefined) where.enabled = query.enabled;

    const rows = await this.prisma.ignoreRule.findMany({
      where,
      include: API_SELECT,
      orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((row) => this.toResult(row));
  }

  async create(projectId: string, dto: CreateIgnoreRuleDto, actorUserId: string): Promise<IgnoreRuleResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const apiId = await this.resolveTargetApiId(tx, projectId, dto.scope, dto.apiId);

      let created: IgnoreRuleWithApi;
      try {
        created = await tx.ignoreRule.create({
          data: {
            projectId,
            apiId,
            scope: dto.scope,
            path: dto.path,
            enabled: true,
            note: dto.note ?? null,
            createdByUserId: actorUserId,
          },
          include: API_SELECT,
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new BusinessException(HttpStatus.CONFLICT, "IGNORE_RULE_ALREADY_EXISTS", "An Ignore Rule for this path already exists in this scope");
        }
        throw err;
      }

      await this.auditWriter.record(
        {
          eventType: "IGNORE_RULE_CREATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "IGNORE_RULE",
          targetId: created.ignoreRuleId,
          targetDisplay: created.path,
          projectId,
          afterData: { scope: created.scope, apiId: created.apiId, path: created.path },
        },
        tx,
      );

      return this.toResult(created);
    });
  }

  // "Ignore selected (N)" from View Differences (spec §5) — one transaction,
  // one audit entry for the whole selection. Uses createMany+skipDuplicates
  // (ON CONFLICT DO NOTHING at the DB layer) rather than a per-path
  // create()+catch loop: a caught P2002 inside a Postgres transaction leaves
  // the transaction aborted for every statement that follows it, which would
  // break every path after the first duplicate. IDs are pre-generated
  // client-side (ignore_rule_id has no DB-level DEFAULT — see schema.prisma)
  // so the actually-inserted rows can be re-selected by id afterward.
  async bulkCreate(projectId: string, dto: BulkCreateIgnoreRulesDto, actorUserId: string): Promise<BulkCreateIgnoreRulesResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const apiId = await this.resolveTargetApiId(tx, projectId, dto.scope, dto.apiId);

      const dedupedPaths = Array.from(new Set(dto.paths));
      const candidateIds = dedupedPaths.map(() => randomUUID());

      await tx.ignoreRule.createMany({
        data: dedupedPaths.map((path, i) => ({
          ignoreRuleId: candidateIds[i],
          projectId,
          apiId,
          scope: dto.scope,
          path,
          enabled: true,
          createdByUserId: actorUserId,
        })),
        skipDuplicates: true,
      });

      const createdRows = await tx.ignoreRule.findMany({
        where: { ignoreRuleId: { in: candidateIds } },
        include: API_SELECT,
        orderBy: { createdAt: "asc" },
      });
      const created = createdRows.map((row) => this.toResult(row));
      const skippedCount = dedupedPaths.length - created.length;

      if (created.length > 0) {
        await this.auditWriter.record(
          {
            eventType: "IGNORE_RULES_BULK_CREATED",
            result: "SUCCESS",
            actorUserId,
            targetType: "IGNORE_RULE",
            targetId: null,
            targetDisplay: `${created.length} rule(s)`,
            projectId,
            afterData: { scope: dto.scope, apiId, paths: created.map((r) => r.path), skippedCount },
          },
          tx,
        );
      }

      return { created, skippedCount };
    });
  }

  async update(projectId: string, ignoreRuleId: string, dto: UpdateIgnoreRuleDto, actorUserId: string): Promise<IgnoreRuleResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const existing = await tx.ignoreRule.findFirst({ where: { ignoreRuleId, projectId } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ignore Rule does not exist");
      }

      const updated = await tx.ignoreRule.update({
        where: { ignoreRuleId },
        data: { enabled: dto.enabled },
        include: API_SELECT,
      });

      await this.auditWriter.record(
        {
          eventType: dto.enabled ? "IGNORE_RULE_ENABLED" : "IGNORE_RULE_DISABLED",
          result: "SUCCESS",
          actorUserId,
          targetType: "IGNORE_RULE",
          targetId: ignoreRuleId,
          targetDisplay: existing.path,
          projectId,
          beforeData: { enabled: existing.enabled },
          afterData: { enabled: updated.enabled },
        },
        tx,
      );

      return this.toResult(updated);
    });
  }

  async remove(projectId: string, ignoreRuleId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);

      const existing = await tx.ignoreRule.findFirst({ where: { ignoreRuleId, projectId } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ignore Rule does not exist");
      }

      await tx.ignoreRule.delete({ where: { ignoreRuleId } });

      await this.auditWriter.record(
        {
          eventType: "IGNORE_RULE_REMOVED",
          result: "SUCCESS",
          actorUserId,
          targetType: "IGNORE_RULE",
          targetId: ignoreRuleId,
          targetDisplay: existing.path,
          projectId,
          beforeData: { scope: existing.scope, apiId: existing.apiId, path: existing.path, enabled: existing.enabled },
        },
        tx,
      );
    });
  }

  // Not controller-facing. Consumed by ComparisonEngineService's OUTPUT
  // stage for a specific (projectId, apiId) pair being compared — returns
  // every currently-enabled rule that applies: PROJECT-scope rules for this
  // project, plus API-scope rules for this exact api. Historical attempts
  // are never re-evaluated against this; only an attempt processed at the
  // moment this is called sees the current enabled set (spec §6).
  async listActiveRulesForScope(projectId: string, apiId: string): Promise<IgnoreRuleRef[]> {
    const rows = await this.prisma.ignoreRule.findMany({
      where: {
        enabled: true,
        OR: [
          { scope: "PROJECT", projectId },
          { scope: "API", apiId },
        ],
      },
      select: { ignoreRuleId: true, scope: true, path: true },
    });
    return rows;
  }

  private async resolveTargetApiId(
    tx: Prisma.TransactionClient,
    projectId: string,
    scope: IgnoreRuleScope,
    apiId: string | undefined,
  ): Promise<string | null> {
    if (scope === "PROJECT") {
      if (apiId !== undefined) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "apiId must not be provided when scope=PROJECT");
      }
      return null;
    }

    const api = await tx.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } });
    if (!api) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
    }
    return api.apiId;
  }

  private toResult(row: IgnoreRuleWithApi): IgnoreRuleResult {
    return {
      ignoreRuleId: row.ignoreRuleId,
      projectId: row.projectId,
      apiId: row.apiId,
      apiName: row.api?.apiName ?? null,
      apiMethod: row.api?.httpMethod ?? null,
      apiPath: row.api?.path ?? null,
      scope: row.scope as IgnoreRuleScope,
      path: row.path,
      enabled: row.enabled,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

async function assertProjectExists(prisma: PrismaService, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({ where: { projectId, deletedAt: null } });
  if (!project) {
    throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
  }
}
