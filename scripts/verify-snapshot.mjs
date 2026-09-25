#!/usr/bin/env node
// Behavioral test for Group 5 (Snapshot) — REQ-SNP-001..008 and
// document/database/AnD_Database_Group_5_Snapshot_FINAL.docx. Exercises real
// INSERT/DELETE against the local dev database to confirm the "at most one
// Snapshot per Execution" uniqueness, the CHECK constraints, the
// snapshot_payloads 1:1 shared-PK relationship, the snapshot_invalidations
// 0..1 cardinality, and ON DELETE RESTRICT FK behavior are enforced by
// Postgres itself, plus that no `updated_at` column exists on any of the
// four new immutable/append-only tables.
//
// Same pattern as scripts/verify-request-input-3b-behavior.mjs: every
// statement runs inside a single transaction that is always ROLLBACK'd at
// the end, so this is safe to run repeatedly against a real dev database
// (including one with existing seeded rows).
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const results = [];
function record(label, pass, detail) {
  results.push({ label, pass, detail });
}

// Runs `fn(client)` inside a SAVEPOINT so a failure doesn't abort the outer
// transaction; returns { ok, error }.
async function attempt(client, savepoint, fn) {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    const value = await fn();
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { ok: true, error: null, value };
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { ok: false, error: err, value: undefined };
  }
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    // Temp fixtures, created inside the transaction only — rolled back at
    // the end, never visible outside this script.
    const user = await client.query(
      `INSERT INTO "users" (user_id, email, system_role, account_status, updated_at)
       VALUES (gen_random_uuid(), 'verify-snapshot@example.com', 'USER', 'ACTIVE', now())
       RETURNING user_id`,
    );
    const userId = user.rows[0].user_id;

    const proj = await client.query(
      `INSERT INTO "projects" (project_id, project_name, project_status, updated_at)
       VALUES (gen_random_uuid(), 'Verify Snapshot Project', 'ACTIVE', now())
       RETURNING project_id`,
    );
    const projId = proj.rows[0].project_id;

    const env = await client.query(
      `INSERT INTO "environments" (environment_id, project_id, environment_name, classification, allow_run, environment_status, updated_at)
       VALUES (gen_random_uuid(), $1, 'Verify Env', 'NON_PRODUCTION', true, 'ACTIVE', now())
       RETURNING environment_id`,
      [projId],
    );
    const envId = env.rows[0].environment_id;

    const api = await client.query(
      `INSERT INTO "api_configurations" (api_id, project_id, api_name, http_method, path, creation_source, updated_at)
       VALUES (gen_random_uuid(), $1, 'Verify Snapshot API', 'GET', '/verify-snapshot', 'MANUAL', now())
       RETURNING api_id`,
      [projId],
    );
    const apiId = api.rows[0].api_id;

    const run = await client.query(
      `INSERT INTO "runs" (run_id, project_id, environment_id, created_by, run_type, run_status, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'SINGLE', 'COMPLETED', now())
       RETURNING run_id`,
      [projId, envId, userId],
    );
    const runId = run.rows[0].run_id;

    const runExecution = await client.query(
      `INSERT INTO "run_executions" (run_execution_id, run_id, api_id, execution_order, execution_status, execution_outcome, api_version, database_version, response_body_is_truncated, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 1, 'COMPLETED', 'RESPONSE_RECEIVED', '1', '1', false, now())
       RETURNING run_execution_id`,
      [runId, apiId],
    );
    const runExecutionId = runExecution.rows[0].run_execution_id;

    // A second API + Execution — needed for any check that expects an insert
    // to actually reach the point of testing a single constraint in
    // isolation, rather than incidentally colliding with
    // uq_snapshots_run_execution_id from reusing runExecutionId (a second
    // api_configurations row is required too: run_executions has its own
    // uq_run_executions_run_id_api_id, one Execution per API per Run).
    const api2 = await client.query(
      `INSERT INTO "api_configurations" (api_id, project_id, api_name, http_method, path, creation_source, updated_at)
       VALUES (gen_random_uuid(), $1, 'Verify Snapshot API 2', 'GET', '/verify-snapshot-2', 'MANUAL', now())
       RETURNING api_id`,
      [projId],
    );
    const apiId2 = api2.rows[0].api_id;
    const runExecution2 = await client.query(
      `INSERT INTO "run_executions" (run_execution_id, run_id, api_id, execution_order, execution_status, execution_outcome, api_version, database_version, response_body_is_truncated, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 2, 'COMPLETED', 'RESPONSE_RECEIVED', '1', '1', false, now())
       RETURNING run_execution_id`,
      [runId, apiId2],
    );
    const runExecutionId2 = runExecution2.rows[0].run_execution_id;

    const snapshotFields = {
      run_execution_id: runExecutionId,
      run_id: runId,
      project_id: projId,
      api_id: apiId,
      environment_id: envId,
      project_name_at_execution: "Verify Snapshot Project",
      api_name_at_execution: "Verify Snapshot API",
      environment_name_at_execution: "Verify Env",
      auth_type: "NONE",
      auth_context_version: 1,
      auth_context_key: "a".repeat(64),
      initiated_by_user_id: userId,
      initiated_by_label: "verify-snapshot@example.com",
      http_method: "GET",
      request_url: "https://example.test/verify-snapshot",
      http_status_code: 200,
      response_completeness: "FULL",
      completed_at: new Date().toISOString(),
      api_version: "1",
      database_version: "1",
      execution_outcome: "RESPONSE_RECEIVED",
    };

    const insertSnapshot = (overrides = {}) => {
      const row = { ...snapshotFields, ...overrides };
      const paramCols = Object.keys(snapshotFields);
      const params = paramCols.map((c) => row[c]);
      const placeholders = paramCols.map((_, i) => `$${i + 1}`);
      return client.query(
        `INSERT INTO "snapshots" (snapshot_id, ${paramCols.map((c) => `"${c}"`).join(", ")})
         VALUES (gen_random_uuid(), ${placeholders.join(", ")})
         RETURNING snapshot_id`,
        params,
      );
    };

    // 1. A valid Snapshot insert succeeds, and its SnapshotPayload sibling
    // (1:1 shared PK) can be inserted in the same transaction (SNP-004 BR-06).
    let firstSnapshotId;
    {
      const r = await attempt(client, "sp1", async () => {
        const inserted = await insertSnapshot();
        firstSnapshotId = inserted.rows[0].snapshot_id;
        await client.query(
          `INSERT INTO "snapshot_payloads" (snapshot_id, request_body, response_body)
           VALUES ($1, NULL, $2)`,
          [firstSnapshotId, Buffer.from('{"ok":true}', "utf-8")],
        );
      });
      record(
        "Valid Snapshot + SnapshotPayload insert succeeds in one transaction",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 2. uq_snapshots_run_execution_id — at most one Snapshot per Execution
    // (REQ-SNP-006 RS-SNP-006-05).
    {
      const r = await attempt(client, "sp2", async () => {
        await insertSnapshot();
      });
      record(
        "A second Snapshot for the same run_execution_id is rejected (at most one per Execution)",
        !r.ok && r.error?.code === "23505",
        r.ok ? "duplicate insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 3. ck_snapshots_auth_type rejects a value outside NONE/LOGIN_FORM/BEARER_TOKEN.
    {
      const r = await attempt(client, "sp3", async () => {
        await insertSnapshot({ auth_type: "API_KEY" });
      });
      record(
        "ck_snapshots_auth_type rejects an unsupported auth type",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 4. ck_snapshots_http_status_code restricts to NULL or 200-299 — a
    // Snapshot is only ever created for a strictly-2xx-eligible Execution.
    for (const badStatus of [199, 300, 404, 500]) {
      const r = await attempt(client, `sp4_${badStatus}`, async () => {
        await insertSnapshot({ http_status_code: badStatus });
      });
      record(
        `ck_snapshots_http_status_code rejects ${badStatus} (outside 200-299)`,
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }
    {
      const r = await attempt(client, "sp4_null", async () => {
        await insertSnapshot({ http_status_code: null, run_execution_id: runExecutionId2 });
      });
      record(
        "ck_snapshots_http_status_code allows NULL",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 5. ck_snapshots_response_completeness rejects a value outside FULL/PARTIAL_206.
    {
      const r = await attempt(client, "sp5", async () => {
        await insertSnapshot({ response_completeness: "PARTIAL" });
      });
      record(
        "ck_snapshots_response_completeness rejects an unsupported value",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 6. ck_snapshots_execution_outcome reuses run_executions' domain.
    {
      const r = await attempt(client, "sp6", async () => {
        await insertSnapshot({ execution_outcome: "BOGUS" });
      });
      record(
        "ck_snapshots_execution_outcome rejects an unsupported value",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 7. snapshot_payloads is a true 1:1 (shared PK) — a payload row for a
    // non-existent snapshot_id is rejected by its FK.
    {
      const r = await attempt(client, "sp7", async () => {
        await client.query(
          `INSERT INTO "snapshot_payloads" (snapshot_id, request_body, response_body) VALUES (gen_random_uuid(), NULL, NULL)`,
        );
      });
      record(
        "snapshot_payloads FK rejects a snapshot_id with no matching Snapshot",
        !r.ok && r.error?.code === "23503",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 8. snapshot_invalidations 0..1 per Snapshot — a second invalidation for
    // the same Snapshot is rejected.
    {
      const r = await attempt(client, "sp8a", async () => {
        await client.query(
          `INSERT INTO "snapshot_invalidations" (invalidation_id, snapshot_id, reason, invalidated_by_user_id, invalidated_by_label)
           VALUES (gen_random_uuid(), $1, 'Verify invalidation', $2, 'verify-snapshot@example.com')`,
          [firstSnapshotId, userId],
        );
      });
      record(
        "A Snapshot invalidation insert succeeds",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }
    {
      const r = await attempt(client, "sp8b", async () => {
        await client.query(
          `INSERT INTO "snapshot_invalidations" (invalidation_id, snapshot_id, reason, invalidated_by_user_id, invalidated_by_label)
           VALUES (gen_random_uuid(), $1, 'Second invalidation attempt', $2, 'verify-snapshot@example.com')`,
          [firstSnapshotId, userId],
        );
      });
      record(
        "A second invalidation for the same Snapshot is rejected (0..1 cardinality)",
        !r.ok && r.error?.code === "23505",
        r.ok ? "duplicate insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 9. ck_snapshot_save_attempts_attempt_status rejects a value outside SUCCEEDED/FAILED.
    {
      const r = await attempt(client, "sp9", async () => {
        await client.query(
          `INSERT INTO "snapshot_save_attempts" (attempt_id, run_execution_id, attempt_status)
           VALUES (gen_random_uuid(), $1, 'PENDING')`,
          [runExecutionId],
        );
      });
      record(
        "ck_snapshot_save_attempts_attempt_status rejects an unsupported value",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }
    // ...and multiple attempts for the same Execution ARE allowed (diagnostic
    // event log, not unique per Execution).
    {
      const r = await attempt(client, "sp9b", async () => {
        await client.query(
          `INSERT INTO "snapshot_save_attempts" (attempt_id, run_execution_id, attempt_status)
           VALUES (gen_random_uuid(), $1, 'FAILED')`,
          [runExecutionId],
        );
        await client.query(
          `INSERT INTO "snapshot_save_attempts" (attempt_id, run_execution_id, attempt_status)
           VALUES (gen_random_uuid(), $1, 'SUCCEEDED')`,
          [runExecutionId],
        );
      });
      record(
        "Multiple snapshot_save_attempts rows for the same Execution are allowed",
        r.ok,
        r.ok ? "inserts succeeded, as expected" : String(r.error?.message),
      );
    }

    // 10. FK RESTRICT — deleting a run_execution that has a Snapshot must fail
    // (no cascading deletion of Snapshot history — REQ-SNP-005 RS-SNP-005-05).
    {
      const r = await attempt(client, "sp10", async () => {
        await client.query(`DELETE FROM "run_executions" WHERE run_execution_id = $1`, [runExecutionId]);
      });
      record(
        "Deleting a run_execution with a Snapshot is RESTRICTed",
        !r.ok && r.error?.code === "23503",
        r.ok ? "delete unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 11. No `updated_at` column on any of the four new tables (immutable /
    // append-only, same convention as audit_logs).
    const cols = (
      await client.query(
        `select table_name, column_name from information_schema.columns
         where table_schema = 'public'
           and table_name in ('snapshots', 'snapshot_payloads', 'snapshot_invalidations', 'snapshot_save_attempts')
           and column_name = 'updated_at'`,
      )
    ).rows;
    record(
      "No updated_at column exists on any of the 4 new Snapshot tables",
      cols.length === 0,
      cols.length === 0 ? "none found, as expected" : JSON.stringify(cols),
    );

    // 12. context_version exists on authentication_configurations, default 1.
    const contextVersionCol = (
      await client.query(
        `select column_name, column_default, is_nullable from information_schema.columns
         where table_schema = 'public' and table_name = 'authentication_configurations' and column_name = 'context_version'`,
      )
    ).rows[0];
    record(
      "authentication_configurations.context_version exists, NOT NULL, default 1",
      !!contextVersionCol && contextVersionCol.is_nullable === "NO" && /1/.test(contextVersionCol.column_default ?? ""),
      JSON.stringify(contextVersionCol),
    );

    // Always roll back — this script must never persist data.
    await client.query("ROLLBACK");

    console.log("\n=== Group 5 (Snapshot) DB Behavior Verification Report ===\n");
    let failures = 0;
    for (const r of results) {
      const marker = r.pass ? "PASS" : "FAIL";
      if (!r.pass) failures++;
      console.log(`[${marker}] ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    console.log(`\n${results.length - failures}/${results.length} checks passed.`);
    if (failures > 0) {
      console.log(`${failures} check(s) FAILED.`);
      process.exitCode = 1;
    } else {
      console.log("All checks passed. (Transaction rolled back — no data persisted.)");
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[verify-snapshot] error:", err);
  process.exitCode = 1;
});
