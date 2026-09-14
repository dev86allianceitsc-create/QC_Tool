#!/usr/bin/env node
// Verifies that the PHYSICAL schema of the local dev database exactly matches
// the approved Database AnD (document/database/Database_AnD.docx) after the
// existing Prisma migration has been applied. Read-only: issues no DDL/DML
// beyond SELECT queries against information_schema / pg_catalog.
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const EXPECTED_TABLES = [
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
      "Exactly the 4 approved tables exist (no audit_logs, no extras)",
      JSON.stringify(applicationTables) === JSON.stringify(EXPECTED_TABLES),
      `found: ${JSON.stringify(tables)}`,
    );
    check(
      "audit_logs does NOT exist",
      !tables.includes("audit_logs"),
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

    // VARCHAR lengths per Database AnD 9.1
    for (const [table, name, len] of [
      ["users", "email", 320],
      ["users", "google_subject_id", 255],
      ["users", "system_role", 20],
      ["users", "account_status", 30],
      ["user_sessions", "revocation_reason", 255],
      ["projects", "project_name", 255],
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
      ["project_memberships", "created_at"],
    ]) {
      const c = col(table, name);
      check(
        `${table}.${name} is TIMESTAMPTZ`,
        c?.data_type === "timestamp with time zone",
        `data_type=${c?.data_type}`,
      );
    }

    // note fields are TEXT
    for (const table of ["users", "user_sessions", "projects", "project_memberships"]) {
      const c = col(table, "note");
      check(
        `${table}.note is TEXT`,
        c?.data_type === "text",
        `data_type=${c?.data_type}`,
      );
    }

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
      "Exactly 3 foreign keys exist",
      fks.length === 3,
      JSON.stringify(fks),
    );
    for (const fk of fks) {
      check(
        `FK ${fk.conname} (${fk.table_name} -> ${fk.ref_table}) is ON DELETE RESTRICT`,
        fk.confdeltype === "r",
        `confdeltype=${fk.confdeltype}`,
      );
    }

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
      "NO users.account_status CHECK exists",
      !checks.some((c) => c.table_name === "users" && /account_status/.test(c.definition)),
      JSON.stringify(checks.filter((c) => c.table_name === "users").map((c) => c.conname)),
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
      "No unapproved CHECK constraints beyond the 3 named ones",
      checks.every((c) =>
        ["ck_users_system_role", "ck_user_sessions_expires_at", "ck_user_sessions_revoked_at"].includes(
          c.conname,
        ),
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
