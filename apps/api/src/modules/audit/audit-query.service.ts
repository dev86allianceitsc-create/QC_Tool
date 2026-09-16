import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import type { AuditLogFilterDto, ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

export interface AuditLogListItem {
  auditId: string;
  eventType: string;
  result: string;
  occurredAt: Date;
  actorDisplay: string | null;
  targetDisplay: string | null;
  projectId: string | null;
}

export interface AuditLogDetail extends AuditLogListItem {
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  beforeData: unknown;
  afterData: unknown;
  requestId: string | null;
  detail: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// API-SEC-001 (list) and API-SEC-003 (export) must use the same filter
// semantics — both call buildWhere() so the predicate can never diverge
// between the paged view and the full CSV export.
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  buildWhere(filter: AuditLogFilterDto): Prisma.AuditLogWhereInput {
    if (filter.from && filter.to && new Date(filter.to) < new Date(filter.from)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "`to` must not be earlier than `from`");
    }

    const where: Prisma.AuditLogWhereInput = {};

    if (filter.search) {
      where.OR = [
        { actorDisplay: { contains: filter.search, mode: "insensitive" } },
        { targetDisplay: { contains: filter.search, mode: "insensitive" } },
      ];
    }
    if (filter.eventType) {
      where.eventType = filter.eventType;
    }
    if (filter.result) {
      where.result = filter.result;
    }
    if (filter.projectId) {
      where.projectId = filter.projectId;
    }
    if (filter.actorUserId) {
      where.actorUserId = filter.actorUserId;
    }
    if (filter.from || filter.to) {
      where.occurredAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    }

    return where;
  }

  async list(query: ListAuditLogsQueryDto): Promise<PagedResult<AuditLogListItem>> {
    const where = this.buildWhere(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortOrder = query.sortOrder ?? "desc";

    const [rows, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: {
          auditId: true,
          eventType: true,
          result: true,
          occurredAt: true,
          actorDisplay: true,
          targetDisplay: true,
          projectId: true,
        },
        orderBy: { occurredAt: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  async getById(auditId: string): Promise<AuditLogDetail> {
    const row = await this.prisma.auditLog.findUnique({ where: { auditId } });
    if (!row) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Audit log entry does not exist");
    }
    return {
      auditId: row.auditId,
      eventType: row.eventType,
      result: row.result,
      occurredAt: row.occurredAt,
      actorUserId: row.actorUserId,
      actorDisplay: row.actorDisplay,
      targetType: row.targetType,
      targetId: row.targetId,
      targetDisplay: row.targetDisplay,
      projectId: row.projectId,
      beforeData: row.beforeData,
      afterData: row.afterData,
      requestId: row.requestId,
      detail: row.detail,
    };
  }

  // Full matching set, no pagination — API-SEC-003 exports a snapshot of
  // every row matching the same filters as API-SEC-001, not just one page.
  async listAllForExport(filter: AuditLogFilterDto): Promise<AuditLogDetail[]> {
    const where = this.buildWhere(filter);
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { occurredAt: "desc" } });
    return rows.map((row) => ({
      auditId: row.auditId,
      eventType: row.eventType,
      result: row.result,
      occurredAt: row.occurredAt,
      actorUserId: row.actorUserId,
      actorDisplay: row.actorDisplay,
      targetType: row.targetType,
      targetId: row.targetId,
      targetDisplay: row.targetDisplay,
      projectId: row.projectId,
      beforeData: row.beforeData,
      afterData: row.afterData,
      requestId: row.requestId,
      detail: row.detail,
    }));
  }
}
