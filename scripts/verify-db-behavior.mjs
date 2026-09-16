#!/usr/bin/env node
// Behavioral test for the Database Phase C (Project Management & Audit Log)
// frozen decisions: exercises actual INSERT/UPDATE/DELETE against the local
// dev database to confirm CHECK constraints, the project_memberships
// composite PK, and the ON DELETE RESTRICT / SET NULL foreign-key behaviors
// are enforced by Postgres itself (not just declared in information_schema /
// pg_catalog, which scripts/verify-schema.mjs already checks statically).
//
// Companion to scripts/verify-schema.mjs (which is intentionally read-only).
// This script issues real DML, but every statement runs inside a single
// transaction that is always ROLLBACK'd at the end — nothing it does is
// ever persisted, so it is safe to run repeatedly against a real dev
// database (including one with existing seeded rows).
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
    const userA = await client.query(
      `INSERT INTO "users" (user_id, email, system_role, account_status, updated_at)
       VALUES (gen_random_uuid(), 'verify-behavior-a@example.invalid', 'USER', 'ACTIVE', now())
       RETURNING user_id`,
    );
    const userAId = userA.rows[0].user_id;

    const projA = await client.query(
      `INSERT INTO "projects" (project_id, project_name, project_status, updated_at)
       VALUES (gen_random_uuid(), 'Verify Behavior Project', 'ACTIVE', now())
       RETURNING project_id, created_at`,
    );
    const projAId = projA.rows[0].project_id;
    const projACreatedAt = projA.rows[0].created_at;

    // 1. projects.project_name is NOT UNIQUE — a second project with the
    // same name must succeed.
    {
      const r = await attempt(client, "sp1", async () => {
        await client.query(
          `INSERT INTO "projects" (project_id, project_name, project_status, updated_at) VALUES (gen_random_uuid(), $1, 'ACTIVE', now())`,
          ["Verify Behavior Project"],
        );
      });
      record(
        "projects.project_name allows duplicates (insert succeeds)",
        r.ok,
        r.ok ? "duplicate-name insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 2. ck_projects_project_status rejects a value outside ACTIVE/INACTIVE.
    {
      const r = await attempt(client, "sp2", async () => {
        await client.query(
          `INSERT INTO "projects" (project_id, project_name, project_status, updated_at) VALUES (gen_random_uuid(), 'bad status', 'BOGUS', now())`,
        );
      });
      record(
        "ck_projects_project_status rejects an invalid status",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 3. ck_projects_deleted_at rejects deleted_at < created_at.
    {
      const r = await attempt(client, "sp3", async () => {
        await client.query(`UPDATE "projects" SET deleted_at = $1::timestamptz - interval '1 day' WHERE project_id = $2`, [
          projACreatedAt,
          projAId,
        ]);
      });
      record(
        "ck_projects_deleted_at rejects deleted_at before created_at",
        !r.ok && r.error?.code === "23514",
        r.ok ? "update unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 4. ck_projects_deleted_at allows a valid soft-delete (deleted_at >= created_at).
    {
      const r = await attempt(client, "sp4", async () => {
        await client.query(`UPDATE "projects" SET deleted_at = now() WHERE project_id = $1`, [projAId]);
      });
      record(
        "projects soft delete (deleted_at >= created_at) succeeds",
        r.ok,
        r.ok ? "update succeeded, as expected" : String(r.error?.message),
      );
    }

    // 5. project_memberships composite PK rejects a duplicate (user_id, project_id).
    {
      await client.query(`INSERT INTO "project_memberships" (user_id, project_id) VALUES ($1, $2)`, [
        userAId,
        projAId,
      ]);
      const r = await attempt(client, "sp5", async () => {
        await client.query(`INSERT INTO "project_memberships" (user_id, project_id) VALUES ($1, $2)`, [
          userAId,
          projAId,
        ]);
      });
      record(
        "project_memberships composite PK rejects a duplicate (user_id, project_id)",
        !r.ok && r.error?.code === "23505",
        r.ok ? "duplicate insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 6. project_memberships FKs are ON DELETE RESTRICT — deleting a user
    // (or project) that still has a membership row must fail.
    {
      const r = await attempt(client, "sp6", async () => {
        await client.query(`DELETE FROM "users" WHERE user_id = $1`, [userAId]);
      });
      record(
        "Deleting a user with an active project_membership is RESTRICTed",
        !r.ok && r.error?.code === "23503",
        r.ok ? "delete unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }
    {
      const r = await attempt(client, "sp6b", async () => {
        await client.query(`DELETE FROM "projects" WHERE project_id = $1`, [projAId]);
      });
      record(
        "Deleting a project with an active project_membership is RESTRICTed",
        !r.ok && r.error?.code === "23503",
        r.ok ? "delete unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 7. Remove Member = hard delete the membership row (frozen decision) —
    // this must succeed once nothing else blocks it.
    {
      const r = await attempt(client, "sp7", async () => {
        await client.query(`DELETE FROM "project_memberships" WHERE user_id = $1 AND project_id = $2`, [
          userAId,
          projAId,
        ]);
      });
      record(
        "Removing a member hard-deletes the project_memberships row",
        r.ok,
        r.ok ? "delete succeeded, as expected" : String(r.error?.message),
      );
    }

    // 8. ck_audit_logs_result rejects a value outside SUCCESS/FAILURE/DENIED.
    {
      const r = await attempt(client, "sp8", async () => {
        await client.query(`INSERT INTO "audit_logs" (audit_id, event_type, result) VALUES (gen_random_uuid(), 'LOGIN_SUCCESS', 'BOGUS')`);
      });
      record(
        "ck_audit_logs_result rejects an invalid result",
        !r.ok && r.error?.code === "23514",
        r.ok ? "insert unexpectedly succeeded" : `code=${r.error?.code}, message=${r.error?.message}`,
      );
    }

    // 9. audit_logs allows a NULL actor (unresolved/system actor) and stores
    // an actor_display snapshot.
    {
      const r = await attempt(client, "sp9", async () => {
        await client.query(
          `INSERT INTO "audit_logs" (audit_id, event_type, result, actor_user_id, actor_display, project_id)
           VALUES (gen_random_uuid(), 'LOGIN_FAILED', 'FAILURE', NULL, 'unresolved@example.invalid', NULL)`,
        );
      });
      record(
        "audit_logs allows a NULL actor_user_id (unresolved/system actor)",
        r.ok,
        r.ok ? "insert succeeded, as expected" : String(r.error?.message),
      );
    }

    // 10. audit_logs actor/project FKs are ON DELETE SET NULL — audit
    // history survives actor/project deletion.
    {
      const userB = await client.query(
        `INSERT INTO "users" (user_id, email, system_role, account_status, updated_at)
         VALUES (gen_random_uuid(), 'verify-behavior-b@example.invalid', 'USER', 'ACTIVE', now())
         RETURNING user_id`,
      );
      const userBId = userB.rows[0].user_id;
      const projB = await client.query(
        `INSERT INTO "projects" (project_id, project_name, project_status, updated_at) VALUES (gen_random_uuid(), 'Verify Behavior Project B', 'ACTIVE', now()) RETURNING project_id`,
      );
      const projBId = projB.rows[0].project_id;

      const auditB = await client.query(
        `INSERT INTO "audit_logs" (audit_id, event_type, result, actor_user_id, actor_display, project_id)
         VALUES (gen_random_uuid(), 'PROJECT_CREATED', 'SUCCESS', $1, 'verify-behavior-b@example.invalid', $2)
         RETURNING audit_id`,
        [userBId, projBId],
      );
      const auditBId = auditB.rows[0].audit_id;

      await client.query(`DELETE FROM "users" WHERE user_id = $1`, [userBId]);
      await client.query(`DELETE FROM "projects" WHERE project_id = $1`, [projBId]);

      const after = await client.query(`SELECT actor_user_id, actor_display, project_id FROM "audit_logs" WHERE audit_id = $1`, [
        auditBId,
      ]);
      const row = after.rows[0];
      record(
        "Deleting the actor user SETs audit_logs.actor_user_id NULL, actor_display preserved",
        row?.actor_user_id === null && row?.actor_display === "verify-behavior-b@example.invalid",
        JSON.stringify(row),
      );
      record(
        "Deleting the project SETs audit_logs.project_id NULL (audit history survives)",
        row?.project_id === null,
        JSON.stringify(row),
      );
    }

    // Always roll back — this script must never persist data.
    await client.query("ROLLBACK");

    console.log("\n=== DB Behavior Verification Report ===\n");
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
  console.error("[verify-db-behavior] error:", err);
  process.exitCode = 1;
});
