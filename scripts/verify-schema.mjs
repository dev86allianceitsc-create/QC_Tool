#!/usr/bin/env node
// Verifies that the PHYSICAL schema of the local dev database exactly matches
// the approved Database AnD (document/database/Database_AnD.docx for
// users/user_sessions, document/database/AnD_Database_Project_Audit.docx for
// projects/project_memberships/audit_logs) after the existing Prisma
// migrations have been applied. Read-only: issues no DDL/DML beyond SELECT
// queries against information_schema / pg_catalog.
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const EXPECTED_TABLES = [
  "audit_logs",
  "project_memberships",
  "projects",
  "user_sessions",
  "users",
];

const results = [];
function check(label, pass, detail) {
  results.push({ label, pass, detail });
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const tables = (
      await client.query(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE'
         order by table_name`,
      )
    ).rows.map((r) => r.table_name);

    // _prisma_migrations is Prisma's own migration-bookkeeping table, created
    // by `prisma migrate deploy` itself — it is not part of the application
    // schema and is expected alongside the 4 approved tables.
    const applicationTables = tables.filter((t) => t !== "_prisma_migrations");
    check(
      "Exactly the 5 approved tables exist (no extras)",
      JSON.stringify(applicationTables) === JSON.stringify(EXPECTED_TABLES),
      `found: ${JSON.stringify(tables)}`,
    );
    check(
      "audit_logs DOES exist",
      tables.includes("audit_logs"),
      `tables: ${JSON.stringify(tables)}`,
    );

    const columns = (
      await client.query(
        `select table_name, column_name, data_type, character_maximum_length,
                is_nullable, udt_name
         from information_schema.columns
         where table_schema = 'public'
         order by table_name, ordinal_position`,
      )
    ).rows;
    const col = (table, name) =>
      columns.find((c) => c.table_name === table && c.column_name === name);

    // UUID PKs
    for (const [table, pkCol] of [
      ["users", "user_id"],
      ["user_sessions", "session_id"],
      ["projects", "project_id"],
      ["audit_logs", "audit_id"],
    ]) {
      const c = col(table, pkCol);
      check(
        `${table}.${pkCol} is UUID`,
        c?.data_type === "uuid",
        `data_type=${c?.data_type}`,
      );
    }
    for (const c of [col("project_memberships", "user_id"), col("project_memberships", "project_id")]) {
      check(
        `project_memberships.${c?.column_name} is UUID`,
        c?.data_type === "uuid",
        `data_type=${c?.data_type}`,
      );
    }

    // VARCHAR lengths per Database AnD 9.1 (users/sessions) and
    // AnD_Database_Project_Audit.docx Section 4/7 (projects/audit_logs)
    for (const [table, name, len] of [
      ["users", "email", 320],
      ["users", "google_subject_id", 255],
      ["users", "system_role", 20],
      ["users", "account_status", 30],
      ["user_sessions", "revocation_reason", 255],
      ["projects", "project_name", 255],
      ["projects", "project_status", 20],
      ["audit_logs", "event_type", 50],
      ["audit_logs", "result", 20],
      ["audit_logs", "actor_display", 320],
      ["audit_logs", "target_type", 50],
      ["audit_logs", "target_id", 255],
      ["audit_logs", "target_display", 320],
      ["audit_logs", "request_id", 100],
    ]) {
      const c = col(table, name);
      check(
        `${table}.${name} is VARCHAR(${len})`,
        c?.data_type === "character varying" &&
          c?.character_maximum_length === len,
        `data_type=${c?.data_type}, length=${c?.character_maximum_length}`,
      );
    }

    // TIMESTAMPTZ columns
    for (const [table, name] of [
      ["users", "activated_at"],
      ["users", "created_at"],
      ["users", "updated_at"],
      ["user_sessions", "created_at"],
      ["user_sessions", "expires_at"],
      ["user_sessions", "revoked_at"],
      ["projects", "created_at"],
      ["projects", "updated_at"],
      ["projects", "deleted_at"],
      ["project_memberships", "created_at"],
      ["audit_logs", "occurred_at"],
    ]) {
      const c = col(table, name);
      check(
        `${table}.${name} is TIMESTAMPTZ`,
        c?.data_type === "timestamp with time zone",
        `data_type=${c?.data_type}`,
      );
    }

    // note fields are TEXT
    for (const table of ["users", "user_sessions", "projects", "project_memberships", "audit_logs"]) {
      const c = col(table, "note");
      check(
        `${table}.note is TEXT`,
        c?.data_type === "text",
        `data_type=${c?.data_type}`,
      );
    }

    // description/detail are TEXT
    for (const [table, name] of [
      ["projects", "description"],
      ["audit_logs", "detail"],
    ]) {
      const c = col(table, name);
      check(
        `${table}.${name} is TEXT`,
        c?.data_type === "text",
        `data_type=${c?.data_type}`,
      );
    }

    // before_data/after_data are JSONB
    for (const name of ["before_data", "after_data"]) {
      const c = col("audit_logs", name);
      check(
        `audit_logs.${name} is JSONB`,
        c?.data_type === "jsonb",
        `data_type=${c?.data_type}`,
      );
    }

    // projects.project_status: NOT NULL, Initial Business Value ACTIVE (not a
    // SQL DEFAULT — Database Standard v2.0 Section 14).
    const projectStatusCol = col("projects", "project_status");
    check(
      "projects.project_status is NOT NULL",
      projectStatusCol?.is_nullable === "NO",
      `is_nullable=${projectStatusCol?.is_nullable}`,
    );

    // projects.deleted_at: nullable (NULL = not deleted).
    const deletedAtCol = col("projects", "deleted_at");
    check(
      "projects.deleted_at is nullable",
      deletedAtCol?.is_nullable === "YES",
      `is_nullable=${deletedAtCol?.is_nullable}`,
    );

    // user_sessions has no status column (state is derived, not stored)
    check(
      "user_sessions has NO status column",
      !col("user_sessions", "status"),
      col("user_sessions", "status") ? "column exists" : "absent, as expected",
    );

    // Constraints (PK/UNIQUE) via information_schema
    const tableConstraints = (
      await client.query(
        `select tc.table_name, tc.constraint_name, tc.constraint_type,
                array_agg(kcu.column_name::text order by kcu.ordinal_position) as columns
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on tc.constraint_name = kcu.constraint_name
          and tc.table_schema = kcu.table_schema
         where tc.table_schema = 'public'
         group by tc.table_name, tc.constraint_name, tc.constraint_type
         order by tc.table_name, tc.constraint_type`,
      )
    ).rows;

    const pmPk = tableConstraints.find(
      (c) => c.table_name === "project_memberships" && c.constraint_type === "PRIMARY KEY",
    );
    check(
      "project_memberships has composite PK (user_id, project_id)",
      pmPk && JSON.stringify(pmPk.columns.sort()) === JSON.stringify(["project_id", "user_id"]),
      `columns=${JSON.stringify(pmPk?.columns)}`,
    );

    // Prisma implements `@unique` as a plain `CREATE UNIQUE INDEX`, not an
    // `ALTER TABLE ... ADD CONSTRAINT UNIQUE`, so it never appears in
    // information_schema.table_constraints — pg_indexes is the source of truth.
    const indexes = (
      await client.query(
        `select indexname, tablename, indexdef
         from pg_indexes
         where schemaname = 'public'
         order by tablename, indexname`,
      )
    ).rows;
    const hasUniqueIndexOn = (table, column) =>
      indexes.some(
        (i) =>
          i.tablename === table &&
          /unique index/i.test(i.indexdef) &&
          new RegExp(`\\(${column}\\)`).test(i.indexdef),
      );

    const projectNameUnique =
      tableConstraints.find(
        (c) =>
          c.table_name === "projects" &&
          c.constraint_type === "UNIQUE" &&
          c.columns.includes("project_name"),
      ) || hasUniqueIndexOn("projects", "project_name");
    check(
      "projects.project_name is NOT UNIQUE",
      !projectNameUnique,
      projectNameUnique ? "found a unique constraint/index" : "no unique constraint/index found, as expected",
    );

    const emailUnique = hasUniqueIndexOn("users", "email");
    check(
      "users.email IS UNIQUE",
      emailUnique,
      emailUnique ? "found unique index" : "no unique constraint/index found on users.email",
    );

    // Approved indexes from AnD_Database_Project_Audit.docx Section 10
    const hasIndex = (name) => indexes.some((i) => i.indexname === name);
    for (const name of [
      "idx_projects_status_deleted",
      "idx_project_memberships_project_id",
      "idx_audit_logs_occurred_at",
      "idx_audit_logs_project_time",
      "idx_audit_logs_actor_time",
      "idx_audit_logs_event_time",
    ]) {
      check(`Index ${name} exists`, hasIndex(name), hasIndex(name) ? "found" : "missing");
    }

    // Explicit instruction: do NOT create an index on audit_logs.result.
    const resultIndex = indexes.find(
      (i) => i.tablename === "audit_logs" && /\(result\)/.test(i.indexdef) && !/occurred_at|event_type|project_id|actor_user_id/.test(i.indexdef),
    );
    check(
      "No index exists on audit_logs.result",
      !resultIndex,
      resultIndex ? resultIndex.indexdef : "no dedicated result index found, as expected",
    );

    // FK delete behavior via pg_constraint (confdeltype: r = RESTRICT)
    const fks = (
      await client.query(
        `select conname,
                conrelid::regclass::text as table_name,
                confrelid::regclass::text as ref_table,
                confdeltype
         from pg_constraint
         where contype = 'f' and connamespace = 'public'::regnamespace
         order by conrelid::regclass::text, conname`,
      )
    ).rows;
    check(
      "Exactly 5 foreign keys exist",
      fks.length === 5,
      JSON.stringify(fks),
    );

    // user_sessions.user_id and both project_memberships FKs are ON DELETE
    // RESTRICT (interim physical decision, approved 2026-09-11).
    const RESTRICT_FKS = [
      "project_memberships_user_id_fkey",
      "project_memberships_project_id_fkey",
      "user_sessions_user_id_fkey",
    ];
    for (const conname of RESTRICT_FKS) {
      const fk = fks.find((f) => f.conname === conname);
      check(
        `FK ${conname} is ON DELETE RESTRICT`,
        fk?.confdeltype === "r",
        `found=${!!fk}, confdeltype=${fk?.confdeltype}`,
      );
    }

    // audit_logs actor/project FKs are ON DELETE SET NULL so audit history
    // survives actor/project deletion (AnD Section 3/13 CONFIRMED).
    for (const conname of ["fk_audit_logs_actor_user_id", "fk_audit_logs_project_id"]) {
      const fk = fks.find((f) => f.conname === conname);
      check(
        `FK ${conname} is ON DELETE SET NULL`,
        fk?.confdeltype === "n",
        `found=${!!fk}, confdeltype=${fk?.confdeltype}`,
      );
    }

    check(
      "No unexpected foreign keys beyond the 5 named ones",
      fks.every((fk) =>
        [...RESTRICT_FKS, "fk_audit_logs_actor_user_id", "fk_audit_logs_project_id"].includes(fk.conname),
      ),
      JSON.stringify(fks.map((f) => f.conname)),
    );

    // CHECK constraints via pg_constraint
    const checks = (
      await client.query(
        `select conname,
                conrelid::regclass::text as table_name,
                pg_get_constraintdef(oid) as definition
         from pg_constraint
         where contype = 'c' and connamespace = 'public'::regnamespace
         order by conrelid::regclass::text, conname`,
      )
    ).rows;

    const findCheck = (name) => checks.find((c) => c.conname === name);
    check(
      "ck_users_system_role CHECK exists",
      !!findCheck("ck_users_system_role"),
      findCheck("ck_users_system_role")?.definition,
    );
    check(
      "ck_users_account_status CHECK exists (INVITED, ACTIVE, INACTIVE, BLOCKED)",
      !!findCheck("ck_users_account_status") &&
        ["INVITED", "ACTIVE", "INACTIVE", "BLOCKED"].every((v) =>
          findCheck("ck_users_account_status").definition.includes(v),
        ),
      findCheck("ck_users_account_status")?.definition,
    );
    check(
      "ck_user_sessions_expires_at CHECK exists (expires_at > created_at)",
      !!findCheck("ck_user_sessions_expires_at") &&
        /expires_at\s*>\s*created_at/.test(findCheck("ck_user_sessions_expires_at").definition),
      findCheck("ck_user_sessions_expires_at")?.definition,
    );
    check(
      "ck_user_sessions_revoked_at CHECK exists (revoked_at IS NULL OR revoked_at >= created_at)",
      !!findCheck("ck_user_sessions_revoked_at") &&
        /revoked_at/.test(findCheck("ck_user_sessions_revoked_at").definition),
      findCheck("ck_user_sessions_revoked_at")?.definition,
    );
    check(
      "ck_projects_project_status CHECK exists (ACTIVE, INACTIVE)",
      !!findCheck("ck_projects_project_status") &&
        ["ACTIVE", "INACTIVE"].every((v) =>
          findCheck("ck_projects_project_status").definition.includes(v),
        ),
      findCheck("ck_projects_project_status")?.definition,
    );
    check(
      "ck_projects_deleted_at CHECK exists (deleted_at IS NULL OR deleted_at >= created_at)",
      !!findCheck("ck_projects_deleted_at") &&
        /deleted_at/.test(findCheck("ck_projects_deleted_at").definition),
      findCheck("ck_projects_deleted_at")?.definition,
    );
    check(
      "ck_audit_logs_result CHECK exists (SUCCESS, FAILURE, DENIED)",
      !!findCheck("ck_audit_logs_result") &&
        ["SUCCESS", "FAILURE", "DENIED"].every((v) =>
          findCheck("ck_audit_logs_result").definition.includes(v),
        ),
      findCheck("ck_audit_logs_result")?.definition,
    );
    check(
      "No CHECK constraint exists on audit_logs.event_type (taxonomy not yet frozen)",
      !checks.some((c) => c.table_name === "audit_logs" && /event_type/.test(c.definition)),
      JSON.stringify(checks.filter((c) => c.table_name === "audit_logs").map((c) => c.conname)),
    );
    check(
      "No unapproved CHECK constraints beyond the 7 named ones",
      checks.every((c) =>
        [
          "ck_users_system_role",
          "ck_users_account_status",
          "ck_user_sessions_expires_at",
          "ck_user_sessions_revoked_at",
          "ck_projects_project_status",
          "ck_projects_deleted_at",
          "ck_audit_logs_result",
        ].includes(c.conname),
      ),
      JSON.stringify(checks.map((c) => c.conname)),
    );

    // Report
    console.log("\n=== Schema Verification Report ===\n");
    let failures = 0;
    for (const r of results) {
      const marker = r.pass ? "PASS" : "FAIL";
      if (!r.pass) failures++;
      console.log(`[${marker}] ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
    }

    console.log("\n--- All indexes in public schema (for manual review) ---");
    for (const idx of indexes) {
      console.log(`  ${idx.tablename}.${idx.indexname}: ${idx.indexdef}`);
    }

    console.log(`\n${results.length - failures}/${results.length} checks passed.`);
    if (failures > 0) {
      console.log(`${failures} check(s) FAILED.`);
      process.exitCode = 1;
    } else {
      console.log("All checks passed.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[verify-schema] error:", err);
  process.exitCode = 1;
});
