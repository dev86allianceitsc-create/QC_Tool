import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { HeaderPair } from "../run/run-dispatch.util";
import { computeAuthContextKey } from "./auth-context-fingerprint.util";
import { SNAPSHOT_MAX_PAYLOAD_BYTES } from "./snapshot.constants";

export interface SnapshotCreationInput {
  runExecutionId: string;
  runId: string;
  projectId: string;
  apiId: string;
  environmentId: string;

  projectNameAtExecution: string;
  apiNameAtExecution: string;
  environmentNameAtExecution: string;

  authType: string;
  authContextVersion: number;
  authIdentityLabel: string | null;

  initiatedByUserId: string;
  initiatedByLabel: string;

  httpMethod: string;
  requestUrl: string;
  requestContentType: string | null;
  // Ordered pairs (REQ-SNP-003 §C), unmasked exactly as sent by the caller
  // (toSnapshotRequestHeaderPairs) — deliberately diverges from Run Result's
  // masked requestHeadersSafe; never sourced from that field.
  requestHeaders: HeaderPair[];
  // Full request body bytes, or null when no body was sent. Never
  // pre-truncated (Q3 decision — requestBodySafe is already unredacted).
  requestBody: Buffer | null;

  httpStatusCode: number;
  responseContentType: string | null;
  // Ordered pairs (REQ-SNP-003 §D), unredacted — see
  // toSnapshotResponseHeaderPairs for the disclosed undici collapse limit.
  responseHeaders: HeaderPair[];
  // Full response body bytes, or null when the read stopped at
  // SNAPSHOT_MAX_PAYLOAD_BYTES + 1 (responseBodyOversized true) — see
  // readResponseBody in run-dispatch.util.ts.
  responseBody: Buffer | null;
  responseBodyOversized: boolean;
  responseCompleteness: "FULL" | "PARTIAL_206";
  contentRangeHeader: string | null;

  requestedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date;
  durationMs: number | null;

  apiVersion: string;
  databaseVersion: string;
  executionOutcome: string;
}

// Group 5 Snapshot persistence (REQ-SNP-001..008). Called from
// RunExecutionEngine only after a 2xx HTTP response has already been
// recognized on the RunExecution row — this service never influences that
// decision, and any failure here must never propagate back to the caller
// (RS-SNP-006-09 / BR-SNP-005-09 storage-failure isolation).
@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  async tryCreateSnapshot(input: SnapshotCreationInput): Promise<void> {
    // Defensive re-check — the caller already filters to 2xx only.
    if (input.httpStatusCode < 200 || input.httpStatusCode >= 300) {
      return;
    }

    const requestBodySizeBytes = input.requestBody ? input.requestBody.byteLength : null;
    const requestOversized = requestBodySizeBytes !== null && requestBodySizeBytes > SNAPSHOT_MAX_PAYLOAD_BYTES;
    const responseOversized = input.responseBodyOversized || (input.responseBody !== null && input.responseBody.byteLength > SNAPSHOT_MAX_PAYLOAD_BYTES);

    if (requestOversized || responseOversized) {
      // SNP-004 BR-07 (Q4: 25 MB, applied independently per field) — an
      // oversized body is never truncated into a "completed" Snapshot
      // (EXC-01); only the attempt is logged.
      await this.recordAttempt(input.runExecutionId, "FAILED", "PAYLOAD_TOO_LARGE", "Request or response body exceeds the snapshot size cap").catch(() => undefined);
      return;
    }

    const identityDiscriminator = input.authType === "LOGIN_FORM" ? (input.authIdentityLabel ?? "") : "";
    const authContextKey = computeAuthContextKey(input.apiId, input.environmentId, input.authType, input.authContextVersion, identityDiscriminator);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.snapshot.create({
          data: {
            runExecutionId: input.runExecutionId,
            runId: input.runId,
            projectId: input.projectId,
            apiId: input.apiId,
            environmentId: input.environmentId,
            projectNameAtExecution: input.projectNameAtExecution,
            apiNameAtExecution: input.apiNameAtExecution,
            environmentNameAtExecution: input.environmentNameAtExecution,
            authType: input.authType,
            authContextVersion: input.authContextVersion,
            authIdentityLabel: input.authIdentityLabel,
            authContextKey,
            initiatedByUserId: input.initiatedByUserId,
            initiatedByLabel: input.initiatedByLabel,
            httpMethod: input.httpMethod,
            requestUrl: input.requestUrl,
            requestContentType: input.requestContentType,
            // Prisma's Json input type has no way to statically express
            // "array of {key,value}" — cast, same pattern as audit-writer.service.ts.
            requestHeaders: input.requestHeaders as unknown as Prisma.InputJsonValue,
            requestBodySizeBytes,
            httpStatusCode: input.httpStatusCode,
            responseContentType: input.responseContentType,
            responseHeaders: input.responseHeaders as unknown as Prisma.InputJsonValue,
            responseBodySizeBytes: input.responseBody ? input.responseBody.byteLength : null,
            responseCompleteness: input.responseCompleteness,
            contentRangeHeader: input.contentRangeHeader,
            requestedAt: input.requestedAt,
            startedAt: input.startedAt,
            completedAt: input.completedAt,
            durationMs: input.durationMs,
            apiVersion: input.apiVersion,
            databaseVersion: input.databaseVersion,
            executionOutcome: input.executionOutcome,
            payload: {
              create: {
                // Plain Uint8Array, not Buffer, per this codebase's
                // credential-crypto.ts precedent — Buffer's wider
                // ArrayBufferLike parameter doesn't structurally match
                // Prisma 7's generated Bytes field type (Uint8Array<ArrayBuffer>).
                requestBody: input.requestBody ? new Uint8Array(input.requestBody) : null,
                responseBody: input.responseBody ? new Uint8Array(input.responseBody) : null,
              },
            },
          },
        });
        await tx.snapshotSaveAttempt.create({
          data: { runExecutionId: input.runExecutionId, attemptStatus: "SUCCEEDED" },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // A Snapshot already exists for this Execution (uq_snapshots_run_execution_id)
        // — a benign idempotent no-op on retry (EXC-02 safe retry), not a failure.
        return;
      }
      this.logger.error(`Failed to save snapshot for run execution ${input.runExecutionId}`, err instanceof Error ? err.stack : String(err));
      await this.recordAttempt(input.runExecutionId, "FAILED", "UNKNOWN_ERROR", err instanceof Error ? err.message : "Unknown error").catch(() => undefined);
    }
  }

  private async recordAttempt(runExecutionId: string, attemptStatus: "SUCCEEDED" | "FAILED", errorReasonCode: string | null, errorDetail: string | null): Promise<void> {
    await this.prisma.snapshotSaveAttempt.create({
      data: { runExecutionId, attemptStatus, errorReasonCode, errorDetail },
    });
  }
}
