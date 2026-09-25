import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { assertProjectActive } from "../api-environment/apis.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import type { HeaderPair } from "../run/run-dispatch.util";
import { ListSnapshotsQueryDto } from "./dto/list-snapshots-query.dto";
import { SNAPSHOT_PREVIEW_MAX_CHARS } from "./snapshot.constants";

export interface SnapshotListItem {
  snapshotId: string;
  apiId: string;
  apiName: string;
  environmentId: string;
  environmentName: string;
  runId: string;
  executionId: string;
  httpStatus: number | null;
  executionOutcome: string;
  snapshotStatus: "NORMAL" | "INVALIDATED";
  apiVersion: string;
  databaseVersion: string;
  createdAt: Date;
}

export interface SnapshotApiGroup {
  apiId: string;
  apiName: string;
  snapshotCount: number;
}

export interface ListSnapshotsResult {
  items: SnapshotListItem[];
  apiGroups: SnapshotApiGroup[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface SnapshotBodyDescriptor {
  present: boolean;
  sizeBytes: number | null;
  contentType: string | null;
  previewText: string | null;
  previewTruncated: boolean;
}

export interface SnapshotDetail {
  snapshotId: string;
  projectId: string;
  apiId: string;
  environmentId: string;
  projectName: string;
  apiName: string;
  environmentName: string;
  runId: string;
  executionId: string;
  initiatedBy: { userId: string; label: string };
  authContext: { key: string; label?: string };
  apiVersion: string;
  databaseVersion: string;
  requestedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date;
  durationMs: number | null;
  createdAt: Date;
  executionOutcome: string;
  request: {
    method: string;
    url: string;
    // Ordered pairs (REQ-SNP-003 §C). Null only for a Snapshot created
    // before the header columns existed (20260924130000_add_snapshot_headers)
    // — never a fabricated value.
    headers: HeaderPair[] | null;
    body: SnapshotBodyDescriptor;
  };
  response: {
    httpStatus: number | null;
    // Ordered pairs (REQ-SNP-003 §D). Same null-for-pre-migration-row rule
    // as request.headers above.
    headers: HeaderPair[] | null;
    body: SnapshotBodyDescriptor;
  };
  snapshotStatus: "NORMAL" | "INVALIDATED";
  invalidation: { reason: string; invalidatedBy: { userId: string; label: string }; invalidatedAt: Date } | null;
}

export interface SnapshotContentResult {
  present: boolean;
  buffer: Buffer | null;
  contentType: string | null;
}

export interface InvalidateSnapshotResult {
  snapshotId: string;
  snapshotStatus: "INVALIDATED";
  reason: string;
  invalidatedBy: { userId: string; label: string };
  invalidatedAt: Date;
}

function isTextualContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const normalized = contentType.toLowerCase();
  return normalized.startsWith("text/") || normalized.includes("json") || normalized.includes("xml") || normalized.includes("javascript") || normalized === "application/x-www-form-urlencoded";
}

// Group 5 Snapshot read/mutation API surface (API-SNP-001..004). Kept
// separate from SnapshotService (the Run-dispatch write path) so that
// already-frozen file is never touched by this work.
@Injectable()
export class SnapshotQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // API-SNP-001. apiGroups always reflects the whole Project, independent of
  // items' filters/pagination (AnD API §3.2 rule 4) — a filter that matches
  // no items must not empty out apiGroups too.
  async listSnapshots(projectId: string, query: ListSnapshotsQueryDto): Promise<ListSnapshotsResult> {
    const project = await this.prisma.project.findFirst({ where: { projectId, deletedAt: null } });
    if (!project) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project does not exist");
    }
    if (query.createdFrom && query.createdTo && new Date(query.createdFrom) > new Date(query.createdTo)) {
      throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SEMANTIC_VALIDATION_ERROR", "createdFrom must not be after createdTo");
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.SnapshotWhereInput = { projectId };
    if (query.apiId) where.apiId = query.apiId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.status === "NORMAL") where.invalidation = { is: null };
    if (query.status === "INVALIDATED") where.invalidation = { isNot: null };
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }

    const [rows, totalItems, apiGroups] = await Promise.all([
      this.prisma.snapshot.findMany({
        where,
        include: { invalidation: { select: { invalidationId: true } } },
        orderBy: [{ createdAt: sortOrder }, { snapshotId: sortOrder }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.snapshot.count({ where }),
      this.computeApiGroups(projectId),
    ]);

    return {
      items: rows.map((r) => ({
        snapshotId: r.snapshotId,
        apiId: r.apiId,
        apiName: r.apiNameAtExecution,
        environmentId: r.environmentId,
        environmentName: r.environmentNameAtExecution,
        runId: r.runId,
        executionId: r.runExecutionId,
        httpStatus: r.httpStatusCode,
        executionOutcome: r.executionOutcome,
        snapshotStatus: r.invalidation ? ("INVALIDATED" as const) : ("NORMAL" as const),
        apiVersion: r.apiVersion,
        databaseVersion: r.databaseVersion,
        createdAt: r.createdAt,
      })),
      apiGroups,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  // API-SNP-002. Historical identity/context only — never re-derived from
  // the API/Environment/Project's current configuration.
  async getSnapshot(projectId: string, snapshotId: string): Promise<SnapshotDetail> {
    const snapshot = await this.prisma.snapshot.findFirst({
      where: { snapshotId, projectId },
      include: { payload: true, invalidation: true },
    });
    if (!snapshot) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Snapshot does not exist in this Project");
    }

    return {
      snapshotId: snapshot.snapshotId,
      projectId: snapshot.projectId,
      apiId: snapshot.apiId,
      environmentId: snapshot.environmentId,
      projectName: snapshot.projectNameAtExecution,
      apiName: snapshot.apiNameAtExecution,
      environmentName: snapshot.environmentNameAtExecution,
      runId: snapshot.runId,
      executionId: snapshot.runExecutionId,
      initiatedBy: { userId: snapshot.initiatedByUserId, label: snapshot.initiatedByLabel },
      authContext: { key: snapshot.authContextKey, label: snapshot.authIdentityLabel ?? undefined },
      apiVersion: snapshot.apiVersion,
      databaseVersion: snapshot.databaseVersion,
      requestedAt: snapshot.requestedAt,
      startedAt: snapshot.startedAt,
      completedAt: snapshot.completedAt,
      durationMs: snapshot.durationMs,
      createdAt: snapshot.createdAt,
      executionOutcome: snapshot.executionOutcome,
      request: {
        method: snapshot.httpMethod,
        url: snapshot.requestUrl,
        // requestHeaders is only ever null for a Snapshot saved before
        // 20260924130000_add_snapshot_headers — no backfill exists for it.
        // Stored by SnapshotService as HeaderPair[]; the JsonValue column
        // type is widened back to that shape here rather than at the schema
        // level (Prisma's Json column has no way to express "array of
        // {key,value}" statically).
        headers: snapshot.requestHeaders as HeaderPair[] | null,
        body: this.buildBodyDescriptor(snapshot.payload?.requestBody ?? null, snapshot.requestContentType, snapshot.requestBodySizeBytes),
      },
      response: {
        httpStatus: snapshot.httpStatusCode,
        headers: snapshot.responseHeaders as HeaderPair[] | null,
        body: this.buildBodyDescriptor(snapshot.payload?.responseBody ?? null, snapshot.responseContentType, snapshot.responseBodySizeBytes),
      },
      snapshotStatus: snapshot.invalidation ? "INVALIDATED" : "NORMAL",
      invalidation: snapshot.invalidation
        ? {
            reason: snapshot.invalidation.reason,
            invalidatedBy: { userId: snapshot.invalidation.invalidatedByUserId, label: snapshot.invalidation.invalidatedByLabel },
            invalidatedAt: snapshot.invalidation.invalidatedAt,
          }
        : null,
    };
  }

  // API-SNP-003. Returns the exact stored bytes for one body part — never
  // truncates, never wraps in JSON/base64 (AnD API §5.2/5.3).
  async getSnapshotContent(projectId: string, snapshotId: string, bodyPart: string): Promise<SnapshotContentResult> {
    if (bodyPart !== "request" && bodyPart !== "response") {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "bodyPart must be 'request' or 'response'");
    }

    const snapshot = await this.prisma.snapshot.findFirst({
      where: { snapshotId, projectId },
      include: { payload: true },
    });
    if (!snapshot) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Snapshot does not exist in this Project");
    }

    const bytes = bodyPart === "request" ? (snapshot.payload?.requestBody ?? null) : (snapshot.payload?.responseBody ?? null);
    const sizeBytes = bodyPart === "request" ? snapshot.requestBodySizeBytes : snapshot.responseBodySizeBytes;
    const contentType = bodyPart === "request" ? snapshot.requestContentType : snapshot.responseContentType;

    if (sizeBytes === null || !bytes) {
      return { present: false, buffer: null, contentType: null };
    }
    return { present: true, buffer: Buffer.from(bytes), contentType: contentType ?? "application/octet-stream" };
  }

  // API-SNP-004. ADMIN-only (enforced by the controller's guard); a
  // Snapshot can be invalidated at most once — the transaction + unique
  // constraint on snapshot_invalidations.snapshot_id decide exactly one
  // winner among concurrent requests (AnD API §6.2 rule 2).
  async invalidateSnapshot(projectId: string, snapshotId: string, reason: string, actorUserId: string): Promise<InvalidateSnapshotResult> {
    return this.prisma.$transaction(async (tx) => {
      // Derived decision (Claude Review Gate #3 — not verbatim from any
      // REQ-SNP clause): gate Invalidate on Project ACTIVE, for consistency
      // with every other mutation in this codebase (apis.service.ts,
      // runs.service.ts all call assertProjectActive before writing).
      // Reads (List/Detail/Content) intentionally do NOT gate on Project
      // ACTIVE — REQ-SNP-005 requires history to survive an INACTIVE
      // Project.
      await assertProjectActive(tx, projectId);

      const snapshot = await tx.snapshot.findFirst({ where: { snapshotId, projectId } });
      if (!snapshot) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Snapshot does not exist in this Project");
      }

      const actor = await tx.user.findUnique({ where: { userId: actorUserId }, select: { email: true } });
      const actorLabel = actor?.email ?? actorUserId;

      try {
        const invalidation = await tx.snapshotInvalidation.create({
          data: { snapshotId, reason, invalidatedByUserId: actorUserId, invalidatedByLabel: actorLabel },
        });

        await this.auditWriter.record(
          {
            eventType: "SNAPSHOT_INVALIDATED",
            result: "SUCCESS",
            actorUserId,
            actorDisplay: actorLabel,
            targetType: "SNAPSHOT",
            targetId: snapshotId,
            targetDisplay: `Snapshot of ${snapshot.apiNameAtExecution}`,
            projectId,
            afterData: { reason },
          },
          tx,
        );

        return {
          snapshotId,
          snapshotStatus: "INVALIDATED" as const,
          reason: invalidation.reason,
          invalidatedBy: { userId: actorUserId, label: actorLabel },
          invalidatedAt: invalidation.invalidatedAt,
        };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new BusinessException(HttpStatus.CONFLICT, "SNAPSHOT_ALREADY_INVALIDATED", "This Snapshot has already been invalidated");
        }
        throw err;
      }
    });
  }

  private async computeApiGroups(projectId: string): Promise<SnapshotApiGroup[]> {
    const rows = await this.prisma.snapshot.findMany({
      where: { projectId },
      select: { apiId: true, apiNameAtExecution: true },
      orderBy: { createdAt: "desc" },
    });
    const groups = new Map<string, SnapshotApiGroup>();
    for (const row of rows) {
      const existing = groups.get(row.apiId);
      if (existing) {
        existing.snapshotCount += 1;
      } else {
        groups.set(row.apiId, { apiId: row.apiId, apiName: row.apiNameAtExecution, snapshotCount: 1 });
      }
    }
    return [...groups.values()].sort((a, b) => a.apiName.localeCompare(b.apiName));
  }

  private buildBodyDescriptor(bytes: Uint8Array | null, contentType: string | null, sizeBytes: number | null): SnapshotBodyDescriptor {
    if (sizeBytes === null) {
      return { present: false, sizeBytes: null, contentType, previewText: null, previewTruncated: false };
    }
    if (!bytes || !isTextualContentType(contentType)) {
      return { present: true, sizeBytes, contentType, previewText: null, previewTruncated: false };
    }
    const text = Buffer.from(bytes).toString("utf-8");
    const previewTruncated = text.length > SNAPSHOT_PREVIEW_MAX_CHARS;
    return {
      present: true,
      sizeBytes,
      contentType,
      previewText: previewTruncated ? text.slice(0, SNAPSHOT_PREVIEW_MAX_CHARS) : text,
      previewTruncated,
    };
  }
}
