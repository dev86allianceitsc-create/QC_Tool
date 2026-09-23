import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret } from "../../common/utils/credential-crypto";
import { classifyTransportError, getByDotPath, readResponseBody, redactHeaders } from "./run-dispatch.util";
import { buildActualUrl, buildQueryEntries } from "./run-url.util";
import { RUN_EXECUTION_TIMEOUT_MS } from "./run.constants";

export interface PendingExecutionContext {
  runExecutionId: string;
  apiId: string;
  requestValues: {
    pathValues: Record<string, string>;
    queryValues: Record<string, string>;
    headerValues: Record<string, string>;
    bodyValue: string;
  };
}

// Dispatches the HTTP requests for one accepted Run. Invoked fire-and-forget
// by RunsService.createRun immediately after the creating transaction
// commits — requestValues are ephemeral (never persisted as input, only the
// redacted actual-request trace is, REQ-RUN-008 RS-008-15) so they are
// threaded straight from the create call into here rather than re-read from
// storage. Dispatch is strictly sequential — no parallel fan-out — per the
// Run/Batch execution model (REQ-RUN-002/003, no configured concurrency).
@Injectable()
export class RunExecutionEngine {
  private readonly logger = new Logger(RunExecutionEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  async dispatchRun(runId: string, environmentId: string, pending: PendingExecutionContext[]): Promise<void> {
    const now = new Date();

    if (pending.length === 0) {
      // Batch where every selected API was ineligible at acceptance time —
      // all children are already SKIPPED, nothing left to dispatch.
      await this.prisma.run.update({ where: { runId }, data: { runStatus: "COMPLETED", startedAt: now, endedAt: now } });
      return;
    }

    await this.prisma.run.update({ where: { runId }, data: { runStatus: "RUNNING", startedAt: now } });

    // Recheck Allow Run / Environment Status once before dispatch starts
    // (AnD API doc: "recheck Allow Run/Production policy before target
    // network request"). environmentId is Run-level, not per-execution, so
    // one recheck up front covers the whole Run rather than per-child.
    const environment = await this.prisma.environment.findUnique({ where: { environmentId } });
    if (!environment || environment.environmentStatus !== "ACTIVE" || !environment.allowRun) {
      await this.interruptAll(pending.map((p) => p.runExecutionId));
      await this.prisma.run.update({ where: { runId }, data: { runStatus: "INTERRUPTED", endedAt: new Date() } });
      return;
    }

    for (let i = 0; i < pending.length; i++) {
      try {
        await this.dispatchOne(environmentId, pending[i]);
      } catch (err) {
        // Not a request-level failure (those are caught and classified
        // inside dispatchOne as RUN_ERROR) — an unexpected engine fault.
        // Mark this item and everything after it interrupted rather than
        // leaving them stuck PENDING forever.
        this.logger.error(`Unexpected failure dispatching run execution ${pending[i].runExecutionId}`, err instanceof Error ? err.stack : String(err));
        await this.interruptAll(pending.slice(i).map((p) => p.runExecutionId));
        await this.prisma.run.update({ where: { runId }, data: { runStatus: "INTERRUPTED", endedAt: new Date() } });
        return;
      }
    }

    await this.prisma.run.update({ where: { runId }, data: { runStatus: "COMPLETED", endedAt: new Date() } });
  }

  private async interruptAll(runExecutionIds: string[]): Promise<void> {
    if (runExecutionIds.length === 0) {
      return;
    }
    const [first, ...rest] = runExecutionIds;
    await this.prisma.runExecution.update({
      where: { runExecutionId: first },
      data: { executionStatus: "INTERRUPTED", endedAt: new Date() },
    });
    if (rest.length > 0) {
      await this.prisma.runExecution.updateMany({
        where: { runExecutionId: { in: rest } },
        data: { executionStatus: "NOT_EXECUTED" },
      });
    }
  }

  private async dispatchOne(environmentId: string, item: PendingExecutionContext): Promise<void> {
    const { runExecutionId, apiId, requestValues } = item;
    const startedAt = new Date();
    await this.prisma.runExecution.update({ where: { runExecutionId }, data: { executionStatus: "RUNNING", startedAt } });

    const [api, config, authConfig, bodyDef] = await Promise.all([
      this.prisma.apiConfiguration.findUnique({ where: { apiId } }),
      this.prisma.apiEnvironmentConfig.findUnique({ where: { apiId_environmentId: { apiId, environmentId } } }),
      this.prisma.authenticationConfiguration.findUnique({ where: { apiId_environmentId: { apiId, environmentId } } }),
      this.prisma.requestBodyDefinition.findUnique({ where: { apiId } }),
    ]);

    // Both were validated moments earlier in the same createRun transaction
    // that produced this row — treated as present, consistent with how the
    // rest of the codebase does not defend against sub-second cross-request
    // races on rows it just wrote itself.
    const url = buildActualUrl(config!.fullUrl, requestValues.pathValues, requestValues.queryValues);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(requestValues.headerValues)) {
      if (value && value.trim() !== "") {
        headers[key] = value;
      }
    }

    let authError: { reasonCode: "TIMEOUT" | "DNS_ERROR" | "TLS_ERROR" | "CONNECTION_ERROR" | "UNKNOWN_EXECUTION_ERROR"; message: string } | null = null;
    if (authConfig?.authType === "BEARER_TOKEN" && authConfig.bearerTokenCiphertext && authConfig.bearerTokenIv && authConfig.bearerTokenAuthTag) {
      try {
        const token = decryptSecret({
          ciphertext: authConfig.bearerTokenCiphertext,
          iv: authConfig.bearerTokenIv,
          authTag: authConfig.bearerTokenAuthTag,
        });
        headers["Authorization"] = `Bearer ${token}`;
      } catch (err) {
        authError = classifyTransportError(err);
      }
    } else if (authConfig?.authType === "LOGIN_FORM" && authConfig.passwordCiphertext && authConfig.passwordIv && authConfig.passwordAuthTag) {
      try {
        const password = decryptSecret({ ciphertext: authConfig.passwordCiphertext, iv: authConfig.passwordIv, authTag: authConfig.passwordAuthTag });
        const token = await this.performLoginFormAuth(authConfig, password);
        headers["Authorization"] = `Bearer ${token}`;
      } catch (err) {
        authError = classifyTransportError(err);
      }
    }

    let bodyText: string | undefined;
    if (bodyDef && requestValues.bodyValue && requestValues.bodyValue.trim() !== "") {
      bodyText = requestValues.bodyValue;
      headers["Content-Type"] = "application/json";
    }

    const requestSentAt = new Date();
    const requestTrace = {
      requestMethod: api!.httpMethod,
      requestUrlSafe: url,
      requestQuerySafe: Object.fromEntries(buildQueryEntries(requestValues.queryValues)),
      requestHeadersSafe: redactHeaders(headers),
      requestBodySafe: bodyText ?? null,
      requestContentType: bodyText ? "application/json" : null,
      requestSentAt,
    };

    if (authError) {
      await this.prisma.runExecution.update({
        where: { runExecutionId },
        data: {
          executionStatus: "COMPLETED",
          executionOutcome: "RUN_ERROR",
          errorReasonCode: authError.reasonCode,
          errorMessageSafe: authError.message,
          ...requestTrace,
          endedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RUN_EXECUTION_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, { method: api!.httpMethod, headers, body: bodyText, redirect: "manual", signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      const body = await readResponseBody(response);
      const outcome = response.status >= 200 && response.status < 400 ? "RESPONSE_RECEIVED" : "RUN_ERROR";

      await this.prisma.runExecution.update({
        where: { runExecutionId },
        data: {
          executionStatus: "COMPLETED",
          executionOutcome: outcome,
          errorReasonCode: outcome === "RUN_ERROR" ? "HTTP_ERROR" : null,
          httpStatus: response.status,
          ...requestTrace,
          responseHeadersSafe: Object.fromEntries(response.headers.entries()),
          responseBodySafe: body.bodyText,
          responseContentType: body.contentType,
          responseBodyKind: body.bodyKind,
          responseBodyIsTruncated: body.isTruncated,
          responseBodySizeBytes: body.sizeBytes,
          responseBodyStoredBytes: body.storedBytes,
          responseReceivedAt: new Date(),
          endedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      });
    } catch (err) {
      const classified = classifyTransportError(err);
      await this.prisma.runExecution.update({
        where: { runExecutionId },
        data: {
          executionStatus: "COMPLETED",
          executionOutcome: "RUN_ERROR",
          errorReasonCode: classified.reasonCode,
          errorMessageSafe: classified.message,
          ...requestTrace,
          endedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      });
    }
  }

  private async performLoginFormAuth(
    authConfig: { loginUrl: string | null; username: string | null; usernameField: string | null; passwordField: string | null; tokenResponsePath: string | null },
    password: string,
  ): Promise<string> {
    const body = JSON.stringify({
      [authConfig.usernameField ?? "username"]: authConfig.username,
      [authConfig.passwordField ?? "password"]: password,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUN_EXECUTION_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(authConfig.loginUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Login endpoint returned HTTP ${response.status}`);
    }

    const json: unknown = await response.json();
    const token = getByDotPath(json, authConfig.tokenResponsePath ?? "");
    if (typeof token !== "string" || token.trim() === "") {
      throw new Error("Login response did not contain a token at the configured path");
    }
    return token;
  }
}
