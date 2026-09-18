#!/usr/bin/env node
// Verifies that the PHYSICAL schema of the local dev database exactly matches
// the approved Group 3B — Request Input Database AnD
// (document/database/AnD_Database_Request_Input_3B.docx, status: FINAL/FROZEN)
// after prisma/migrations/20260918060000_add_request_input_3b has been
// applied. Read-only: issues no DDL/DML beyond SELECT queries against
// information_schema / pg_catalog.
//
// Companion, 3B-scoped script — see NOTE at the bottom of this file for why
// this does not extend scripts/verify-schema.mjs.
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

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

    for (const t of ["request_parameter_definitions", "request_body_definitions"]) {
      check(`${t} table exists`, tables.includes(t), `tables: ${JSON.stringify(tables)}`);
    }

    // No Path Parameter / Run Value / payload / credential tables were
    // created — Section 5 and Section 13 of the frozen AnD.
    for (const t of [
      "path_parameter_definitions",
      "run_parameter_values",
      "json_payloads",
      "request_payloads",
      "credentials",
      "authentications",
    ]) {
      check(`${t} table does NOT exist`, !tables.includes(t), tables.includes(t) ? "unexpectedly found" : "absent, as expected");
    }

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

    // request_parameter_definitions columns
    check(
      "request_parameter_definitions.request_parameter_definition_id is UUID",
      col("request_parameter_definitions", "request_parameter_definition_id")?.data_type === "uuid",
    );
    check(
      "request_parameter_definitions.api_id is UUID",
      col("request_parameter_definitions", "api_id")?.data_type === "uuid",
    );
    {
      const c = col("request_parameter_definitions", "location");
      check(
        "request_parameter_definitions.location is VARCHAR(20) NOT NULL",
        c?.data_type === "character varying" && c?.character_maximum_length === 20 && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, length=${c?.character_maximum_length}, is_nullable=${c?.is_nullable}`,
      );
    }
    {
      const c = col("request_parameter_definitions", "parameter_name");
      check(
        "request_parameter_definitions.parameter_name is VARCHAR(255) NOT NULL",
        c?.data_type === "character varying" && c?.character_maximum_length === 255 && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, length=${c?.character_maximum_length}, is_nullable=${c?.is_nullable}`,
      );
    }
    {
      const c = col("request_parameter_definitions", "is_required");
      check(
        "request_parameter_definitions.is_required is BOOLEAN NOT NULL",
        c?.data_type === "boolean" && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, is_nullable=${c?.is_nullable}`,
      );
    }
    {
      const c = col("request_parameter_definitions", "note");
      check(
        "request_parameter_definitions.note is TEXT, nullable",
        c?.data_type === "text" && c?.is_nullable === "YES",
        `data_type=${c?.data_type}, is_nullable=${c?.is_nullable}`,
      );
    }
    for (const name of ["created_at", "updated_at"]) {
      const c = col("request_parameter_definitions", name);
      check(
        `request_parameter_definitions.${name} is TIMESTAMPTZ NOT NULL`,
        c?.data_type === "timestamp with time zone" && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, is_nullable=${c?.is_nullable}`,
      );
    }

    // request_body_definitions columns
    check(
      "request_body_definitions.request_body_definition_id is UUID",
      col("request_body_definitions", "request_body_definition_id")?.data_type === "uuid",
    );
    {
      const c = col("request_body_definitions", "api_id");
      check(
        "request_body_definitions.api_id is UUID NOT NULL",
        c?.data_type === "uuid" && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, is_nullable=${c?.is_nullable}`,
      );
    }
    {
      const c = col("request_body_definitions", "body_type");
      check(
        "request_body_definitions.body_type is VARCHAR(30) NOT NULL",
        c?.data_type === "character varying" && c?.character_maximum_length === 30 && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, length=${c?.character_maximum_length}, is_nullable=${c?.is_nullable}`,
      );
    }
    {
      const c = col("request_body_definitions", "note");
      check(
        "request_body_definitions.note is TEXT, nullable",
        c?.data_type === "text" && c?.is_nullable === "YES",
        `data_type=${c?.data_type}, is_nullable=${c?.is_nullable}`,
      );
    }
    for (const name of ["created_at", "updated_at"]) {
      const c = col("request_body_definitions", name);
      check(
        `request_body_definitions.${name} is TIMESTAMPTZ NOT NULL`,
        c?.data_type === "timestamp with time zone" && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, is_nullable=${c?.is_nullable}`,
      );
    }

    // api_configurations.path and api_environment_configs.full_url are
    // unchanged by 3B (Section 3/10/16 — no column added).
    {
      const c = col("api_configurations", "path");
      check(
        "api_configurations.path is unchanged: VARCHAR(2048) NOT NULL",
        c?.data_type === "character varying" && c?.character_maximum_length === 2048 && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, length=${c?.character_maximum_length}, is_nullable=${c?.is_nullable}`,
      );
    }
    check(
      "api_configurations has NO has_json_body / json_body column",
      !col("api_configurations", "has_json_body") && !col("api_configurations", "json_body"),
      "absent, as expected",
    );
    {
      const c = col("api_environment_configs", "full_url");
      check(
        "api_environment_configs.full_url is unchanged: VARCHAR(4096) NOT NULL",
        c?.data_type === "character varying" && c?.character_maximum_length === 4096 && c?.is_nullable === "NO",
        `data_type=${c?.data_type}, length=${c?.character_maximum_length}, is_nullable=${c?.is_nullable}`,
      );
    }

    // PK constraints
    const tableConstraints = (
      await client.query(
        `select tc.table_name, tc.constraint_name, tc.constraint_type,
                array_agg(kcu.column_name::text order by kcu.ordinal_position) as columns
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on tc.constraint_name = kcu.constraint_name
          and tc.table_schema = kcu.table_schema
         where tc.table_schema = 'public'
           and tc.table_name in ('request_parameter_definitions', 'request_body_definitions')
         group by tc.table_name, tc.constraint_name, tc.constraint_type
         order by tc.table_name, tc.constraint_type`,
      )
    ).rows;
    const rpdPk = tableConstraints.find(
      (c) => c.table_name === "request_parameter_definitions" && c.constraint_type === "PRIMARY KEY",
    );
    check(
      "request_parameter_definitions PK is (request_parameter_definition_id)",
      JSON.stringify(rpdPk?.columns) === JSON.stringify(["request_parameter_definition_id"]),
      `columns=${JSON.stringify(rpdPk?.columns)}`,
    );
    const rbdPk = tableConstraints.find(
      (c) => c.table_name === "request_body_definitions" && c.constraint_type === "PRIMARY KEY",
    );
    check(
      "request_body_definitions PK is (request_body_definition_id)",
      JSON.stringify(rbdPk?.columns) === JSON.stringify(["request_body_definition_id"]),
      `columns=${JSON.stringify(rbdPk?.columns)}`,
    );

    // Indexes via pg_indexes
    const indexes = (
      await client.query(
        `select indexname, tablename, indexdef
         from pg_indexes
         where schemaname = 'public'
           and tablename in ('request_parameter_definitions', 'request_body_definitions')
         order by tablename, indexname`,
      )
    ).rows;
    const hasIndex = (name) => indexes.some((i) => i.indexname === name);

    check(
      "idx_request_parameter_definitions_api_id_location exists",
      hasIndex("idx_request_parameter_definitions_api_id_location"),
    );
    check(
      "ux_request_parameter_definitions_query exists (case-sensitive, partial WHERE location = 'QUERY')",
      hasIndex("ux_request_parameter_definitions_query") &&
        /unique index/i.test(indexes.find((i) => i.indexname === "ux_request_parameter_definitions_query")?.indexdef ?? "") &&
        /WHERE\s*\(\(location\)::text\s*=\s*'QUERY'/i.test(
          indexes.find((i) => i.indexname === "ux_request_parameter_definitions_query")?.indexdef ?? "",
        ),
      indexes.find((i) => i.indexname === "ux_request_parameter_definitions_query")?.indexdef,
    );
    check(
      "ux_request_parameter_definitions_header_ci exists (LOWER(parameter_name), partial WHERE location = 'HEADER')",
      hasIndex("ux_request_parameter_definitions_header_ci") &&
        /lower\(/i.test(indexes.find((i) => i.indexname === "ux_request_parameter_definitions_header_ci")?.indexdef ?? "") &&
        /WHERE\s*\(\(location\)::text\s*=\s*'HEADER'/i.test(
          indexes.find((i) => i.indexname === "ux_request_parameter_definitions_header_ci")?.indexdef ?? "",
        ),
      indexes.find((i) => i.indexname === "ux_request_parameter_definitions_header_ci")?.indexdef,
    );
    check(
      "request_body_definitions.api_id has a UNIQUE index (0..1 body definition per API)",
      indexes.some((i) => i.tablename === "request_body_definitions" && /unique index/i.test(i.indexdef) && /\(api_id\)/.test(i.indexdef)),
      JSON.stringify(indexes.filter((i) => i.tablename === "request_body_definitions").map((i) => i.indexdef)),
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
           and conrelid::regclass::text in ('request_parameter_definitions', 'request_body_definitions')
         order by conrelid::regclass::text, conname`,
      )
    ).rows;
    check("Exactly 2 new foreign keys exist (one per new table)", fks.length === 2, JSON.stringify(fks));
    for (const fk of fks) {
      check(
        `FK ${fk.conname} references api_configurations and is ON DELETE RESTRICT`,
        fk.ref_table === "api_configurations" && fk.confdeltype === "r",
        `ref_table=${fk.ref_table}, confdeltype=${fk.confdeltype}`,
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
           and conrelid::regclass::text in ('request_parameter_definitions', 'request_body_definitions')
         order by conrelid::regclass::text, conname`,
      )
    ).rows;
    const findCheck = (name) => checks.find((c) => c.conname === name);
    check(
      "ck_request_parameter_definitions_location CHECK exists (QUERY, HEADER)",
      !!findCheck("ck_request_parameter_definitions_location") &&
        ["QUERY", "HEADER"].every((v) => findCheck("ck_request_parameter_definitions_location").definition.includes(v)),
      findCheck("ck_request_parameter_definitions_location")?.definition,
    );
    check(
      "ck_request_body_definitions_body_type CHECK exists (JSON only)",
      !!findCheck("ck_request_body_definitions_body_type") &&
        findCheck("ck_request_body_definitions_body_type").definition.includes("JSON"),
      findCheck("ck_request_body_definitions_body_type")?.definition,
    );
    check(
      "No unapproved CHECK constraints beyond the 2 named ones",
      checks.every((c) =>
        ["ck_request_parameter_definitions_location", "ck_request_body_definitions_body_type"].includes(c.conname),
      ),
      JSON.stringify(checks.map((c) => c.conname)),
    );

    // Report
    console.log("\n=== Group 3B (Request Input) Schema Verification Report ===\n");
    let failures = 0;
    for (const r of results) {
      const marker = r.pass ? "PASS" : "FAIL";
      if (!r.pass) failures++;
      console.log(`[${marker}] ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
    }

    console.log("\n--- request_parameter_definitions / request_body_definitions indexes (for manual review) ---");
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
  console.error("[verify-request-input-3b-schema] error:", err);
  process.exitCode = 1;
});

// NOTE ON VERIFIER SCOPE (pre-existing debt, not introduced by 3B):
// scripts/verify-schema.mjs and scripts/verify-db-behavior.mjs hard-code an
// exhaustive table/FK/CHECK inventory that predates Group 3A — they were
// never updated when api_configurations/environments/api_environment_configs
// were added, so `pnpm db:verify` / `pnpm db:verify-behavior` already report
// stale expectations (e.g. "exactly 5 tables", "exactly 5 foreign keys")
// that do not include 3A's tables, and would be equally wrong about 3B's.
// Rather than weaken or silently expand those two pre-existing exhaustive
// scripts as an unrelated fix bundled into this task, this migration adds
// dedicated, 3B-scoped verification scripts instead (this file and
// verify-request-input-3b-behavior.mjs), following the same query
// conventions. Updating verify-schema.mjs/verify-db-behavior.mjs to also
// cover 3A and 3B is flagged as follow-up debt, not fixed here.
