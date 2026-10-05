import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret } from "../../common/utils/credential-crypto";
import { ComparisonEngineService } from "../comparison/comparison-engine.service";
import { ComparisonService } from "../comparison/comparison.service";
import { SnapshotService } from "../snapshot/snapshot.service";
import { SNAPSHOT_MAX_PAYLOAD_BYTES } from "../snapshot/snapshot.constants";
import { classifyTransportError, findAccessToken, readResponseBody, redactHeaders, setHeader, setHeaderIfAbsent, toSnapshotRequestHeaderPairs, toSnapshotResponseHeaderPairs } from "./run-dispatch.util";
import { buildActualUrl, buildQueryEntries } from "./run-url.util";
import { RUN_EXECUTION_TIMEOUT_MS } from "./run.constants";
import { resolveEffectiveUrl } from "../api-environment/full-url-resolution.util";
import { computeTestCaseKey } from "./test-case-identity.util";

export interface PendingExecutionContext {
  runExecutionId: string;
  apiId: string;
  requestValues: {
    pathValues: Record<string, string>;
    queryValues: Record<string, string>;
    headerValues: Record<string, string>;
    bodyValue: string;
  };
  // Advanced "Re-run this execution" (§5) only: the execution this run is
  // explicitly re-running. When set, baseline selection skips the normal
  // testCaseKey-based selectBaselineSnapshot (concept A) entirely and is
  // forced to that execution's own produced Snapshot instead — a deliberate
  // override, never a fallback to auto-selection. Ordinary Run Again/Run API
  // dispatch always leaves this undefined.
  forcedBaselineSourceExecutionId?: string | null;
}

// Run/Project/Environment/User context needed for Snapshot's historical-name
// and initiator columns (REQ-SNP-001) — resolved once per Run in
// dispatchRun, not per-execution, to avoid N redundant queries in a Batch Run.
interface DispatchRunContext {
  runId: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
  environmentBaseUrl: string | null;
  initiatedByUserId: string;
  initiatedByLabel: string;
  // Phase 3 Test Case History & Run Again: flat id form of testAccount
  // below, sourced the same way (run.testAccountId) — needed as a plain
  // scalar for computeTestCaseKey and for Snapshot.testAccountId, neither of
  // which need the full credential sub-object.
  testAccountId: string | null;
  // REVISION 3C-R02: the Login Form Test Account selected for this Run (null
  // whenever the Environment's authType is not LOGIN_FORM, or none was
  // selected — treated like today's "no credential configured" case, an
  // advisory-only gap, never a hard block).
  testAccount: {
    label: string;
    username: string;
    passwordCiphertext: Uint8Array<ArrayBuffer>;
    passwordIv: Uint8Array<ArrayBuffer>;
    passwordAuthTag: Uint8Array<ArrayBuffer>;
  } | null;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotService: SnapshotService,
    private readonly comparisonService: ComparisonService,
    private readonly comparisonEngineService: ComparisonEngineService,
  ) {}

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
    // network request"), and resolve the Project/Environment/User display
    // context Snapshot needs (REQ-SNP-001) — environmentId is Run-level, not
    // per-execution, so one fetch up front covers the whole Run rather than
    // per-child.
    const run = await this.prisma.run.findUnique({
      where: { runId },
      include: { project: true, environment: true, creator: true, testAccount: true },
    });
    const environment = run?.environment;
    if (!run || !environment || environment.environmentStatus !== "ACTIVE" || !environment.allowRun) {
      await this.interruptAll(pending.map((p) => p.runExecutionId));
      await this.prisma.run.update({ where: { runId }, data: { runStatus: "INTERRUPTED", endedAt: new Date() } });
      return;
    }

    const runContext: DispatchRunContext = {
      runId,
      projectId: run.projectId,
      projectName: run.project.projectName,
      environmentId: run.environmentId,
      environmentName: environment.environmentName,
      environmentBaseUrl: environment.baseUrl,
      initiatedByUserId: run.createdBy,
      initiatedByLabel: run.creator.email,
      testAccountId: run.testAccountId,
      testAccount: run.testAccount
        ? { label: run.testAccount.label, username: run.testAccount.username, passwordCiphertext: run.testAccount.passwordCiphertext, passwordIv: run.testAccount.passwordIv, passwordAuthTag: run.testAccount.passwordAuthTag }
        : null,
    };

    for (let i = 0; i < pending.length; i++) {
      try {
        await this.dispatchOne(runContext, pending[i]);
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

  private async dispatchOne(ctx: DispatchRunContext, item: PendingExecutionContext): Promise<void> {
    const { runExecutionId, apiId, requestValues } = item;
    const environmentId = ctx.environmentId;
    const startedAt = new Date();
    await this.prisma.runExecution.update({ where: { runExecutionId }, data: { executionStatus: "RUNNING", startedAt } });

    const [api, config, authConfig, bodyDef] = await Promise.all([
      this.prisma.apiConfiguration.findUnique({ where: { apiId } }),
      this.prisma.apiEnvironmentConfig.findUnique({ where: { apiId_environmentId: { apiId, environmentId } } }),
      this.prisma.authenticationConfiguration.findUnique({ where: { environmentId } }),
      this.prisma.requestBodyDefinition.findUnique({ where: { apiId } }),
    ]);

    const authType = authConfig?.authType ?? "NONE";
    const authContextVersion = authConfig?.contextVersion ?? 1;
    const authIdentityLabel = authType === "LOGIN_FORM" ? (ctx.testAccount?.label ?? null) : null;

    // Phase 3 Test Case Identity (concept A) — deliberately excludes
    // authContextVersion/authContextKey, see test-case-identity.util.ts.
    const testCaseKey = computeTestCaseKey({
      apiId,
      environmentId,
      authType,
      testAccountId: ctx.testAccountId,
      pathValues: requestValues.pathValues,
      queryValues: requestValues.queryValues,
      headerValues: requestValues.headerValues,
      bodyValue: requestValues.bodyValue,
    });

    // CMP-003/013 (AnD Section 4.1): the baseline Snapshot is chosen and
    // locked once, right here, before dispatch — never reselected later even
    // if auth or the fetch itself later fails, or a newer Snapshot appears
    // mid-flight (RS-CMP-016-09). A null baseline (no candidate yet) is
    // recorded as NO_BASELINE immediately and is never overwritten
    // afterward — the first-gate-wins precedence rule (AnD §4.1).
    //
    // §5 forced baseline (advanced "Re-run this execution"): bypasses
    // testCaseKey-based selection entirely and locks onto one specific prior
    // execution's own produced Snapshot, honoring invalidation exactly like
    // the normal path but never falling back to auto-selection if that
    // Snapshot is missing/invalidated — the forced choice is deliberate.
    const baseline = item.forcedBaselineSourceExecutionId
      ? await this.resolveForcedBaseline(item.forcedBaselineSourceExecutionId)
      : await this.comparisonService.selectBaselineSnapshot({
          projectId: ctx.projectId,
          testCaseKey,
        });
    await this.prisma.runExecution.update({
      where: { runExecutionId },
      data: {
        baselineSnapshotId: baseline?.snapshotId ?? null,
        baselineSelectedAt: new Date(),
        comparisonAvailabilityReasonCode: baseline ? null : "NO_BASELINE",
      },
    });

    // Both were validated moments earlier in the same createRun transaction
    // that produced this row — treated as present, consistent with how the
    // rest of the codebase does not defend against sub-second cross-request
    // races on rows it just wrote itself.
    const effectiveUrl = resolveEffectiveUrl(config?.fullUrl, ctx.environmentBaseUrl, api!.path).url;
    const url = buildActualUrl(effectiveUrl!, requestValues.pathValues, requestValues.queryValues);

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
    } else if (authConfig?.authType === "LOGIN_FORM" && ctx.testAccount) {
      try {
        const password = decryptSecret({ ciphertext: ctx.testAccount.passwordCiphertext, iv: ctx.testAccount.passwordIv, authTag: ctx.testAccount.passwordAuthTag });
        const token =
          authConfig.loginMode === "IMPORTED"
            ? await this.performImportedLoginFormAuth(authConfig, ctx.testAccount.username, password)
            : await this.performLoginFormAuth(
                { loginUrl: authConfig.loginUrl, username: ctx.testAccount.username, usernameField: authConfig.usernameField, passwordField: authConfig.passwordField },
                password,
              );
        headers["Authorization"] = `Bearer ${token}`;
      } catch (err) {
        authError = classifyTransportError(err);
      }
    }

    let bodyText: string | undefined;
    if (bodyDef && requestValues.bodyValue && requestValues.bodyValue.trim() !== "") {
      bodyText = requestValues.bodyValue;
      setHeader(headers, "Content-Type", "application/json");
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
          authType,
          testCaseKey,
          endedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          comparisonAvailabilityReasonCode: baseline ? "NO_NEW_SNAPSHOT" : undefined,
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

      const respondedAt = new Date();
      const body = await readResponseBody(response, SNAPSHOT_MAX_PAYLOAD_BYTES);
      const outcome = response.status >= 200 && response.status < 400 ? "RESPONSE_RECEIVED" : "RUN_ERROR";
      const durationMs = respondedAt.getTime() - startedAt.getTime();
      const responseHeadersSafe = Object.fromEntries(response.headers.entries());

      const savedExecution = await this.prisma.runExecution.update({
        where: { runExecutionId },
        data: {
          executionStatus: "COMPLETED",
          executionOutcome: outcome,
          errorReasonCode: outcome === "RUN_ERROR" ? "HTTP_ERROR" : null,
          httpStatus: response.status,
          ...requestTrace,
          authType,
          testCaseKey,
          responseHeadersSafe,
          responseBodySafe: body.bodyText,
          responseContentType: body.contentType,
          responseBodyKind: body.bodyKind,
          responseBodyIsTruncated: body.isTruncated,
          responseBodySizeBytes: body.sizeBytes,
          responseBodyStoredBytes: body.storedBytes,
          responseReceivedAt: respondedAt,
          endedAt: respondedAt,
          durationMs,
          comparisonAvailabilityReasonCode: (response.status < 200 || response.status >= 300) && baseline ? "NO_NEW_SNAPSHOT" : undefined,
        },
      });

      // Snapshot eligibility (REQ-SNP-002) is a strict 2xx check, deliberately
      // independent of executionOutcome above (which also buckets 3xx into
      // RESPONSE_RECEIVED). A Snapshot failure here must never affect the
      // RunExecution status/outcome already persisted above (RS-SNP-006-09 /
      // BR-SNP-005-09 storage-failure isolation) — this whole block is inert
      // to the outer catch and never rethrows.
      if (response.status >= 200 && response.status < 300) {
        try {
          await this.snapshotService.tryCreateSnapshot({
            runExecutionId,
            runId: ctx.runId,
            projectId: ctx.projectId,
            apiId,
            environmentId: ctx.environmentId,
            projectNameAtExecution: ctx.projectName,
            apiNameAtExecution: api!.apiName,
            environmentNameAtExecution: ctx.environmentName,
            authType,
            authContextVersion,
            authIdentityLabel,
            testAccountId: ctx.testAccountId,
            testCaseKey,
            initiatedByUserId: ctx.initiatedByUserId,
            initiatedByLabel: ctx.initiatedByLabel,
            httpMethod: api!.httpMethod,
            requestUrl: url,
            requestContentType: requestTrace.requestContentType,
            // Sourced from the actual dispatch-time `headers` object (before
            // redactHeaders ran for the Run Result trace above), never from
            // requestTrace.requestHeadersSafe — see toSnapshotRequestHeaderPairs.
            requestHeaders: toSnapshotRequestHeaderPairs(headers),
            requestBody: bodyText !== undefined ? Buffer.from(bodyText, "utf-8") : null,
            httpStatusCode: response.status,
            responseContentType: body.contentType,
            // Sourced from the real Response.headers directly, never from
            // the already-folded responseHeadersSafe above.
            responseHeaders: toSnapshotResponseHeaderPairs(response.headers),
            responseBody: body.snapshotBody,
            responseBodyOversized: body.snapshotBodyOversized,
            responseCompleteness: response.status === 206 ? "PARTIAL_206" : "FULL",
            contentRangeHeader: response.headers.get("content-range"),
            requestedAt: requestSentAt,
            startedAt,
            completedAt: respondedAt,
            durationMs,
            apiVersion: savedExecution.apiVersion,
            databaseVersion: savedExecution.databaseVersion,
            executionOutcome: outcome,
          });

          // CMP-013/016: re-query rather than change tryCreateSnapshot's
          // Promise<void> contract — a cheap indexed point lookup on
          // uq_snapshots_run_execution_id that also naturally resolves the
          // idempotent-retry/P2002-no-op case (finds the pre-existing row).
          const targetSnapshot = await this.prisma.snapshot.findUnique({
            where: { runExecutionId },
            select: { snapshotId: true },
          });

          if (targetSnapshot && baseline) {
            await this.comparisonService.tryCreateAutomaticComparison({
              runExecutionId,
              projectId: ctx.projectId,
              apiId,
              environmentId: ctx.environmentId,
              baselineSnapshotId: baseline.snapshotId,
              targetSnapshotId: targetSnapshot.snapshotId,
              sourceKind: item.forcedBaselineSourceExecutionId ? "RERUN_EXECUTION" : "AUTO_EXECUTION",
            });

            // CMP-013/016: re-query rather than change
            // tryCreateAutomaticComparison's Promise<void> contract, same
            // reasoning as the targetSnapshot lookup above — a cheap indexed
            // point lookup on uq_comparisons_source_execution_id that also
            // naturally resolves the idempotent-retry/P2002-no-op case.
            // QUEUED is checked because a same-transaction invalidation race
            // can already have written this first attempt as BLOCKED
            // (SNAPSHOT_INVALIDATED) — nothing left for the engine to do then.
            const createdAttempt = await this.prisma.comparisonAttempt.findFirst({
              where: { comparison: { sourceExecutionId: runExecutionId }, attemptNumber: 1 },
              select: { comparisonAttemptId: true, processingStatus: true },
            });
            if (createdAttempt && createdAttempt.processingStatus === "QUEUED") {
              await this.comparisonEngineService.processAttempt(createdAttempt.comparisonAttemptId);
            }
          } else if (!targetSnapshot && baseline) {
            // A baseline existed but this dispatch did not end up producing a
            // target Snapshot (e.g. oversized payload) — first-gate-wins
            // means this only fires when NO_BASELINE was not already
            // recorded above.
            await this.prisma.runExecution.update({
              where: { runExecutionId },
              data: { comparisonAvailabilityReasonCode: "NO_NEW_SNAPSHOT" },
            });
          }
        } catch (err) {
          this.logger.error(`Unexpected failure creating snapshot/comparison for run execution ${runExecutionId}`, err instanceof Error ? err.stack : String(err));
        }
      }
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
          authType,
          testCaseKey,
          endedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          comparisonAvailabilityReasonCode: baseline ? "NO_NEW_SNAPSHOT" : undefined,
        },
      });
    }
  }

  // §5 "Re-run this execution": the forced baseline is the source
  // execution's own produced Snapshot (relation "RunExecutionTargetSnapshot"
  // — distinct from that execution's own `baselineSnapshot`, which is what
  // *it* compared against, not what we want here), honoring invalidation.
  // Never falls back to selectBaselineSnapshot — null means NO_BASELINE.
  private async resolveForcedBaseline(sourceExecutionId: string): Promise<{ snapshotId: string } | null> {
    const source = await this.prisma.runExecution.findUnique({
      where: { runExecutionId: sourceExecutionId },
      include: { snapshot: { include: { invalidation: true } } },
    });
    if (!source?.snapshot || source.snapshot.invalidation) {
      return null;
    }
    return { snapshotId: source.snapshot.snapshotId };
  }

  private async performLoginFormAuth(
    authConfig: { loginUrl: string | null; username: string | null; usernameField: string | null; passwordField: string | null },
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
      throw new Error(`Login endpoint returned HTTP ${response.status}${await this.describeErrorBody(response)}`);
    }

    const json: unknown = await response.json();
    const token = findAccessToken(json);
    if (!token) {
      throw new Error("Login response did not contain a recognizable access token");
    }
    return token;
  }

  // Best-effort detail appended to a non-OK login response's error message so
  // an admin sees *why* the login failed (e.g. an OAuth2 token endpoint's
  // `{"error":"invalid_grant"}`) instead of only the bare status code — this
  // was previously the only signal surfaced (REQ-RUN-003 error trace), which
  // was indistinguishable from a Login Form import/config bug versus simply
  // wrong Test Account credentials. Swallows any read failure (e.g. an
  // already-consumed or bodyless response) since this is purely diagnostic
  // and must never itself fail the auth attempt.
  private async describeErrorBody(response: Response): Promise<string> {
    try {
      const text = (await response.text()).trim();
      if (!text) return "";
      const snippet = text.length > 300 ? `${text.slice(0, 300)}…` : text;
      return `: ${snippet}`;
    } catch {
      return "";
    }
  }

  // IMPORTED Login Form: the login request template was captured once via
  // "Import from cURL/fetch" and reviewed/saved by the admin (Phase C). Only
  // the two structural locations (importUsernameLocation/importPasswordLocation)
  // are overwritten with the selected Test Account's real values at Run
  // time — everything else in the template (extra headers/body params such
  // as grant_type) is sent through unchanged.
  private async performImportedLoginFormAuth(
    authConfig: {
      importUrl: string | null;
      importMethod: string | null;
      importHeaders: Prisma.JsonValue | null;
      importBodyFormat: string | null;
      importBodyFields: Prisma.JsonValue | null;
      importUsernameLocation: Prisma.JsonValue | null;
      importPasswordLocation: Prisma.JsonValue | null;
    },
    username: string,
    password: string,
  ): Promise<string> {
    const headerEntries = (authConfig.importHeaders as ImportKeyValueEntry[] | null) ?? [];
    const bodyFieldEntries = (authConfig.importBodyFields as ImportKeyValueEntry[] | null) ?? [];
    const usernameLocation = authConfig.importUsernameLocation as ImportFieldLocation | null;
    const passwordLocation = authConfig.importPasswordLocation as ImportFieldLocation | null;

    const headers: Record<string, string> = {};
    for (const entry of headerEntries) {
      headers[entry.name] = entry.value;
    }
    const bodyFields: Record<string, string> = {};
    for (const entry of bodyFieldEntries) {
      bodyFields[entry.name] = entry.value;
    }

    const applyCredential = (location: ImportFieldLocation | null, value: string) => {
      if (!location) {
        return;
      }
      if (location.kind === "HEADER") {
        headers[location.name] = value;
      } else {
        bodyFields[location.name] = value;
      }
    };
    applyCredential(usernameLocation, username);
    applyCredential(passwordLocation, password);

    let body: string | undefined;
    if (authConfig.importBodyFormat === "JSON") {
      body = JSON.stringify(bodyFields);
      setHeaderIfAbsent(headers, "Content-Type", "application/json");
    } else if (authConfig.importBodyFormat === "FORM_URLENCODED") {
      body = new URLSearchParams(bodyFields).toString();
      setHeaderIfAbsent(headers, "Content-Type", "application/x-www-form-urlencoded");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUN_EXECUTION_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(authConfig.importUrl!, {
        method: authConfig.importMethod ?? "POST",
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Login endpoint returned HTTP ${response.status}${await this.describeErrorBody(response)}`);
    }

    const json: unknown = await response.json();
    const token = findAccessToken(json);
    if (!token) {
      throw new Error("Login response did not contain a recognizable access token");
    }
    return token;
  }
}

interface ImportKeyValueEntry {
  name: string;
  value: string;
}

interface ImportFieldLocation {
  kind: "HEADER" | "BODY";
  name: string;
}
