#!/usr/bin/env node
// Behavioral test for the Group 3B (Request Input) frozen decisions:
// exercises actual INSERT/UPDATE/DELETE against the local dev database to
// confirm CHECK constraints, the QUERY/HEADER uniqueness rules
// (DB-3B-PAR-01..04), the request_body_definitions 0..1-per-API uniqueness,
// and ON DELETE RESTRICT FK behavior are enforced by Postgres itself — not
// just declared in information_schema/pg_catalog, which
// scripts/verify-request-input-3b-schema.mjs already checks statically.
//
// Companion to scripts/verify-request-input-3b-schema.mjs. This script
// issues real DML, but every statement runs inside a single transaction that
// is always ROLLBACK'd at the end — nothing it does is ever persisted, so it
// is safe to run repeatedly against a real dev database (including one with
// existing seeded rows).
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
    await fn();
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { ok: true, error: null };
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { ok: false, error: err };
  }
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    // Temp fixtures, created inside the transaction only — rolled back at
    // the end, never visible outside this script.
    const proj = await client.query(
      `INSERT INTO "projects" (project_id, project_name, project_status, updated_at)
       VALUES (gen_random_uuid(), 'Verify 3B Request Input Project', 'ACTIVE', now())
       RETURNING project_id`,
    );
    const projId = proj.rows[0].project_id;

    const api = await client.query(
      `INSERT INTO "api_configurations" (api_id, project_id, api_name, http_method, path, creation_source, updated_at)
       VALUES (gen_random_uuid(), $1, 'Verify API', 'GET', '/verify/{id}', 'MANUAL', now())
       RETURNING api_id`,
      [projId],
    );
    const apiId = api.rows[0].api_id;

    // 1. Allowed data: a QUERY parameter definition insert succeeds.
    {
      const r = await attempt(client, "sp1", async () => {
        await client.query(
          `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
           VALUES (gen_random_uuid(), $1, 'QUERY', 'status', true, now())`,
          [apiId],
        );
      });
      record(
        "Valid QUERY parameter definition insert succeeds",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 2. ck_request_parameter_definitions_location rejects a value outside QUERY/HEADER.
    {
      const r = await attempt(client, "sp2", async () => {
        await client.query(
          `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
           VALUES (gen_random_uuid(), $1, 'PATH', 'id', true, now())`,
          [apiId],
        );
      });
      record(
        "ck_request_parameter_definitions_location rejects PATH (Path is derived, never persisted)",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }
    {
      const r = await attempt(client, "sp2b", async () => {
        await client.query(
          `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
           VALUES (gen_random_uuid(), $1, 'BODY', 'x', true, now())`,
          [apiId],
        );
      });
      record(
        "ck_request_parameter_definitions_location rejects BODY (Body is a separate entity)",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 3. DB-3B-PAR-01/02 — QUERY parameter name uniqueness is case-sensitive:
    // exact duplicate rejected, differently-cased spelling allowed.
    {
      const r = await attempt(client, "sp3", async () => {
        await client.query(
          `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
           VALUES (gen_random_uuid(), $1, 'QUERY', 'status', false, now())`,
          [apiId],
        );
      });
      record(
        "Duplicate QUERY parameter name (exact case) on the same API is rejected",
        !r.ok && r.error?.code === "23505",
        r.ok ? "duplicate insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }
    {
      const r = await attempt(client, "sp3b", async () => {
        await client.query(
          `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
           VALUES (gen_random_uuid(), $1, 'QUERY', 'STATUS', false, now())`,
          [apiId],
        );
      });
      record(
        "QUERY parameter name uniqueness is case-sensitive (STATUS != status insert succeeds)",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 4. DB-3B-PAR-03 — HEADER parameter name uniqueness is case-insensitive.
    {
      await client.query(
        `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
         VALUES (gen_random_uuid(), $1, 'HEADER', 'X-Client-ID', true, now())`,
        [apiId],
      );
      const r = await attempt(client, "sp4", async () => {
        await client.query(
          `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
           VALUES (gen_random_uuid(), $1, 'HEADER', 'x-client-id', true, now())`,
          [apiId],
        );
      });
      record(
        "HEADER parameter name uniqueness is case-insensitive (x-client-id after X-Client-ID is rejected)",
        !r.ok && r.error?.code === "23505",
        r.ok ? "duplicate insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 5. DB-3B-PAR-04 — QUERY and HEADER may share the same spelling because
    // location is part of the uniqueness boundary.
    {
      const r = await attempt(client, "sp5", async () => {
        await client.query(
          `INSERT INTO "request_parameter_definitions" (request_parameter_definition_id, api_id, location, parameter_name, is_required, updated_at)
           VALUES (gen_random_uuid(), $1, 'HEADER', 'status', true, now())`,
          [apiId],
        );
      });
      record(
        "QUERY 'status' and HEADER 'status' can coexist on the same API (different location)",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 6. Allowed data: a JSON request_body_definitions row succeeds; MVP
    // supports only body_type = JSON.
    {
      const r = await attempt(client, "sp6", async () => {
        await client.query(
          `INSERT INTO "request_body_definitions" (request_body_definition_id, api_id, body_type, updated_at)
           VALUES (gen_random_uuid(), $1, 'JSON', now())`,
          [apiId],
        );
      });
      record(
        "Valid JSON request_body_definitions insert succeeds",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 7. ck_request_body_definitions_body_type rejects a non-JSON value (MVP boundary).
    {
      const apiForBody2 = await client.query(
        `INSERT INTO "api_configurations" (api_id, project_id, api_name, http_method, path, creation_source, updated_at)
         VALUES (gen_random_uuid(), $1, 'Verify API 2', 'POST', '/verify2', 'MANUAL', now())
         RETURNING api_id`,
        [projId],
      );
      const apiId2 = apiForBody2.rows[0].api_id;
      const r = await attempt(client, "sp7", async () => {
        await client.query(
          `INSERT INTO "request_body_definitions" (request_body_definition_id, api_id, body_type, updated_at)
           VALUES (gen_random_uuid(), $1, 'XML', now())`,
          [apiId2],
        );
      });
      record(
        "ck_request_body_definitions_body_type rejects an unsupported body type (XML, out of MVP scope)",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 8. Request Body cardinality 1 -> 0..1: a second request_body_definitions
    // row for the same API is rejected.
    {
      const r = await attempt(client, "sp8", async () => {
        await client.query(
          `INSERT INTO "request_body_definitions" (request_body_definition_id, api_id, body_type, updated_at)
           VALUES (gen_random_uuid(), $1, 'JSON', now())`,
          [apiId],
        );
      });
      record(
        "A second request_body_definitions row for the same API is rejected (0..1 cardinality)",
        !r.ok && r.error?.code === "23505",
        r.ok ? "duplicate insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 9. FK RESTRICT — deleting an api_configurations row that still has
    // parameter/body definitions must fail (hard delete only; API lifecycle
    // uses soft delete via deleted_at, which this constraint does not block).
    {
      const r = await attempt(client, "sp9", async () => {
        await client.query(`DELETE FROM "api_configurations" WHERE api_id = $1`, [apiId]);
      });
      record(
        "Hard-deleting an API with request_parameter_definitions/request_body_definitions rows is RESTRICTed",
        !r.ok && r.error?.code === "23503",
        r.ok ? "delete unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 10. Soft-deleting the API (the actual 3A/3B lifecycle path) is
    // unaffected by the new FKs — Request Input Definition rows survive.
    {
      const r = await attempt(client, "sp10", async () => {
        await client.query(`UPDATE "api_configurations" SET deleted_at = now() WHERE api_id = $1`, [apiId]);
      });
      record(
        "Soft-deleting the API (deleted_at) succeeds and is not blocked by Request Input Definition rows",
        r.ok,
        r.ok ? "update succeeded, as expected" : String(r.error?.message),
      );
      if (r.ok) {
        const still = await client.query(
          `SELECT count(*)::int AS c FROM "request_parameter_definitions" WHERE api_id = $1`,
          [apiId],
        );
        record(
          "Request Input Definition rows are preserved after the API is soft-deleted",
          still.rows[0].c > 0,
          `remaining rows=${still.rows[0].c}`,
        );
      }
    }

    // Always roll back — this script must never persist data.
    await client.query("ROLLBACK");

    console.log("\n=== Group 3B (Request Input) DB Behavior Verification Report ===\n");
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
  console.error("[verify-request-input-3b-behavior] error:", err);
  process.exitCode = 1;
});
