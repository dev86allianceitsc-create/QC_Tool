#!/usr/bin/env node
// Manual smoke test for Group 5 (Snapshot) — REQ-SNP-001..008, plan Section 6
// step 7. Exercises the REAL compiled RunExecutionEngine + SnapshotService
// (apps/api/dist, built via `pnpm --filter api build`) against the real
// local dev Postgres and a real local HTTP test server returning 200 OK —
// not mocked Prisma, unlike the unit specs. Confirms:
//   1. A Single Run dispatch against a 2xx test API creates exactly one
//      `snapshots` row + one `snapshot_payloads` row.
//   2. No `updated_at` column exists on the new Snapshot tables (defense in
//      depth alongside the same check in verify-snapshot.mjs).
//   3. A second, separate Run against the same API produces a SECOND
//      Snapshot row (REQ-SNP-006) rather than overwriting/merging the first.
// All seeded rows are deleted at the end (own throwaway fixture IDs; safe to
// re-run repeatedly).
import "dotenv/config";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../apps/api/dist/prisma/prisma.service.js";
import { SnapshotService } from "../apps/api/dist/modules/snapshot/snapshot.service.js";
import { RunExecutionEngine } from "../apps/api/dist/modules/run/run-execution.engine.js";

const results = [];
function record(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function startTestServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const snapshotService = new SnapshotService(prisma);
  const engine = new RunExecutionEngine(prisma, snapshotService);

  const { server, baseUrl } = await startTestServer();

  const seeded = { userId: null, projectId: null, envId: null, apiId: null, runIds: [] };

  try {
    const user = await prisma.user.create({
      data: { email: `smoke-snapshot-${randomUUID()}@example.com`, systemRole: "USER", accountStatus: "ACTIVE" },
    });
    seeded.userId = user.userId;

    const project = await prisma.project.create({ data: { projectName: "Smoke Snapshot Project", projectStatus: "ACTIVE" } });
    seeded.projectId = project.projectId;

    const environment = await prisma.environment.create({
      data: {
        projectId: project.projectId,
        environmentName: "Smoke Env",
        classification: "NON_PRODUCTION",
        allowRun: true,
        environmentStatus: "ACTIVE",
      },
    });
    seeded.envId = environment.environmentId;

    const api = await prisma.apiConfiguration.create({
      data: { projectId: project.projectId, apiName: "Smoke Snapshot API", httpMethod: "GET", path: "/smoke", creationSource: "MANUAL" },
    });
    seeded.apiId = api.apiId;

    await prisma.apiEnvironmentConfig.create({
      data: { apiId: api.apiId, environmentId: environment.environmentId, fullUrl: `${baseUrl}/smoke` },
    });

    async function runOnceAndDispatch(executionOrder) {
      const run = await prisma.run.create({
        data: { projectId: project.projectId, environmentId: environment.environmentId, createdBy: user.userId, runType: "SINGLE", runStatus: "PENDING" },
      });
      seeded.runIds.push(run.runId);
      const runExecution = await prisma.runExecution.create({
        data: { runId: run.runId, apiId: api.apiId, executionOrder, executionStatus: "PENDING", apiVersion: "1", databaseVersion: "1", responseBodyIsTruncated: false },
      });
      await engine.dispatchRun(run.runId, environment.environmentId, [
        { runExecutionId: runExecution.runExecutionId, apiId: api.apiId, requestValues: { pathValues: {}, queryValues: {}, headerValues: {}, bodyValue: "" } },
      ]);
      return { runId: run.runId, runExecutionId: runExecution.runExecutionId };
    }

    // 1. First Run — expect exactly one Snapshot + one SnapshotPayload.
    const first = await runOnceAndDispatch(1);
    const finishedExecution = await prisma.runExecution.findUnique({ where: { runExecutionId: first.runExecutionId } });
    record("First RunExecution completed with a 2xx outcome", finishedExecution?.executionStatus === "COMPLETED" && finishedExecution?.httpStatus === 200, JSON.stringify({ status: finishedExecution?.executionStatus, http: finishedExecution?.httpStatus }));

    const firstSnapshot = await prisma.snapshot.findUnique({ where: { runExecutionId: first.runExecutionId }, include: { payload: true } });
    record("A Snapshot row was created for the first Execution", !!firstSnapshot, firstSnapshot ? `snapshotId=${firstSnapshot.snapshotId}` : "no snapshot found");
    record("The Snapshot's SnapshotPayload sibling exists with the response body captured", !!firstSnapshot?.payload && firstSnapshot.payload.responseBody?.length > 0, firstSnapshot?.payload ? `responseBody bytes=${firstSnapshot.payload.responseBody?.length}` : "no payload found");

    // 2. No updated_at column on the 4 new tables (defense in depth).
    const cols = await prisma.$queryRawUnsafe(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and table_name in ('snapshots', 'snapshot_payloads', 'snapshot_invalidations', 'snapshot_save_attempts')
         and column_name = 'updated_at'`,
    );
    record("No updated_at column exists on any of the 4 new Snapshot tables", cols.length === 0, cols.length === 0 ? "none found, as expected" : JSON.stringify(cols));

    // 3. A second, separate Run against the same API produces a SECOND Snapshot row.
    const second = await runOnceAndDispatch(1);
    const secondSnapshot = await prisma.snapshot.findUnique({ where: { runExecutionId: second.runExecutionId } });
    record(
      "A second identical Run produces a second, distinct Snapshot row (not an overwrite)",
      !!secondSnapshot && secondSnapshot.snapshotId !== firstSnapshot?.snapshotId,
      secondSnapshot ? `secondSnapshotId=${secondSnapshot.snapshotId}` : "no second snapshot found",
    );

    const totalForApi = await prisma.snapshot.count({ where: { apiId: api.apiId } });
    record("Exactly 2 Snapshot rows exist for this API after 2 Runs", totalForApi === 2, `count=${totalForApi}`);
  } finally {
    // Cleanup — delete in FK-safe order (children before parents). Never
    // leaves fixture data behind, even if the assertions above failed.
    await prisma.snapshotSaveAttempt.deleteMany({ where: { runExecution: { apiId: seeded.apiId } } }).catch(() => {});
    await prisma.snapshotPayload.deleteMany({ where: { snapshot: { apiId: seeded.apiId } } }).catch(() => {});
    await prisma.snapshotInvalidation.deleteMany({ where: { snapshot: { apiId: seeded.apiId } } }).catch(() => {});
    await prisma.snapshot.deleteMany({ where: { apiId: seeded.apiId } }).catch(() => {});
    await prisma.runExecution.deleteMany({ where: { apiId: seeded.apiId } }).catch(() => {});
    for (const runId of seeded.runIds) {
      await prisma.run.deleteMany({ where: { runId } }).catch(() => {});
    }
    if (seeded.apiId) await prisma.apiEnvironmentConfig.deleteMany({ where: { apiId: seeded.apiId } }).catch(() => {});
    if (seeded.apiId) await prisma.apiConfiguration.deleteMany({ where: { apiId: seeded.apiId } }).catch(() => {});
    if (seeded.envId) await prisma.environment.deleteMany({ where: { environmentId: seeded.envId } }).catch(() => {});
    if (seeded.projectId) await prisma.project.deleteMany({ where: { projectId: seeded.projectId } }).catch(() => {});
    if (seeded.userId) await prisma.user.deleteMany({ where: { userId: seeded.userId } }).catch(() => {});

    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  console.log("\n=== Group 5 (Snapshot) Manual Smoke Test Report ===\n");
  const failures = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failures}/${results.length} checks passed.`);
  if (failures > 0) {
    console.log(`${failures} check(s) FAILED.`);
    process.exitCode = 1;
  } else {
    console.log("All checks passed. (Fixture rows deleted — no data persisted.)");
  }
}

main().catch((err) => {
  console.error("[smoke-snapshot] error:", err);
  process.exitCode = 1;
});
