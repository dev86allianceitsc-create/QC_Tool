import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { sanitizeForAudit } from "../../common/utils/audit-sanitize";

export type AuditResult = "SUCCESS" | "FAILURE" | "DENIED";

export interface AuditEntry {
  eventType: string;
  result: AuditResult;
  actorUserId?: string | null;
  actorDisplay?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetDisplay?: string | null;
  projectId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  requestId?: string | null;
  detail?: string | null;
}

type PrismaTransactionClient = Prisma.TransactionClient;

// The common audit writer required by REQ-SEC-001 — every mutating
// Project/Membership flow in this module goes through here instead of
// writing to audit_logs directly, so the write path (and its sanitization)
// only exists in one place.
//
// Accepts an optional transaction client so a caller can write the audit row
// in the SAME database transaction as its business mutation (resolution of
// the AnD's open SF-06 point: fail-closed — the mutation and its audit
// record either both commit or both roll back together, never one without
// the other).
@Injectable()
export class AuditWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: PrismaTransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        eventType: entry.eventType,
        result: entry.result,
        actorUserId: entry.actorUserId ?? null,
        actorDisplay: entry.actorDisplay ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        targetDisplay: entry.targetDisplay ?? null,
        projectId: entry.projectId ?? null,
        beforeData: entry.beforeData ? (sanitizeForAudit(entry.beforeData) as Prisma.InputJsonValue) : undefined,
        afterData: entry.afterData ? (sanitizeForAudit(entry.afterData) as Prisma.InputJsonValue) : undefined,
        requestId: entry.requestId ?? null,
        detail: entry.detail ?? null,
      },
    });
  }
}
