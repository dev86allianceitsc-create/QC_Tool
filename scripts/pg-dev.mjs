#!/usr/bin/env node
// Local development tooling ONLY — not the production/company database
// architecture. Spawns a disposable PostgreSQL 17 cluster (via
// `embedded-postgres`) into a gitignored data directory so `prisma migrate
// deploy` and schema verification can run against a real Postgres engine
// without Docker or an admin install.
//
// Usage:
//   node scripts/pg-dev.mjs start   (also: `pnpm db:start`) — keeps running in
//                                    the foreground until stopped.
//   node scripts/pg-dev.mjs stop    (also: `pnpm db:stop`)  — stops the
//                                    cluster via pg_ctl, independent of which
//                                    process started it.
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import { Client as PgClient } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, ".local", "pgdata");
const PORT = 55432;
const USER = "postgres";
const PASSWORD = "postgres";
const DATABASE = "qc_tool_dev";

function makeCluster() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    persistent: true,
  });
}

async function isInitialised() {
  try {
    await fs.access(path.join(DATA_DIR, "PG_VERSION"));
    return true;
  } catch {
    return false;
  }
}

async function findPgCtl() {
  // embedded-postgres's package.json only exports its root ("."), so a bare
  // subpath import of "embedded-postgres/dist/binary.js" is rejected by
  // Node's ESM exports-map enforcement (ERR_PACKAGE_PATH_NOT_EXPORTED). A
  // file:// URL import bypasses exports-map enforcement entirely, so resolve
  // the package root first and import the internal module by path instead.
  const indexUrl = import.meta.resolve("embedded-postgres");
  const pkgDistDir = path.dirname(fileURLToPath(indexUrl));
  const binaryUrl = pathToFileURL(path.join(pkgDistDir, "binary.js"));
  const { default: getBinaries } = await import(binaryUrl.href);
  const { postgres } = await getBinaries();
  // postgres binary path looks like <pkg>/native/bin/postgres(.exe); pg_ctl
  // lives alongside it in the same bin directory.
  const ext = path.extname(postgres);
  return path.join(path.dirname(postgres), `pg_ctl${ext}`);
}

async function forceUtcTimezone() {
  const client = new PgClient({
    host: "127.0.0.1",
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
  });
  await client.connect();
  try {
    await client.query("ALTER SYSTEM SET timezone = 'UTC';");
    await client.query("SELECT pg_reload_conf();");
    console.log("[pg-dev] cluster default TimeZone forced to UTC");
  } finally {
    await client.end();
  }
}

async function start() {
  console.log(
    `[pg-dev] LOCAL DEV ONLY — disposable PostgreSQL 17 at 127.0.0.1:${PORT}, data dir ${DATA_DIR}`,
  );
  await fs.mkdir(DATA_DIR, { recursive: true });
  const pg = makeCluster();

  if (!(await isInitialised())) {
    console.log("[pg-dev] initialising cluster...");
    await pg.initialise();
  }

  console.log("[pg-dev] starting cluster...");
  await pg.start();

  try {
    await pg.createDatabase(DATABASE);
    console.log(`[pg-dev] created database "${DATABASE}"`);
  } catch (err) {
    if (!/already exists/i.test(err?.message ?? "")) {
      throw err;
    }
    console.log(`[pg-dev] database "${DATABASE}" already exists`);
  }

  // embedded-postgres inherits the host OS timezone (e.g. AEST) instead of
  // UTC. Prisma's pg driver adapter sends timestamp literals without
  // normalizing them to the session's TimeZone GUC, so a non-UTC session
  // default silently corrupts every timestamptz read/write by the local
  // offset. Force UTC as the cluster-wide default so timestamptz handling
  // is correct regardless of which client connects.
  await forceUtcTimezone();

  console.log(
    `[pg-dev] ready: postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}?schema=public`,
  );
  console.log("[pg-dev] press Ctrl+C, or run `pnpm db:stop`, to stop.");

  // Keep this process (and the postgres child it spawned) alive.
  await new Promise(() => {});
}

async function stop() {
  if (!(await isInitialised())) {
    console.log("[pg-dev] no data directory found, nothing to stop.");
    return;
  }
  const pgCtl = await findPgCtl();
  console.log(`[pg-dev] stopping cluster via pg_ctl (${pgCtl})...`);
  await new Promise((resolve, reject) => {
    const child = spawn(pgCtl, ["stop", "-D", DATA_DIR, "-m", "fast"], {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      // pg_ctl exits non-zero if the server was already stopped — treat
      // that as success rather than a failure of this script.
      resolve(code);
    });
    child.on("error", reject);
  });
  console.log("[pg-dev] stop command issued.");
}

const command = process.argv[2];
if (command === "start") {
  await start();
} else if (command === "stop") {
  await stop();
} else {
  console.error("Usage: node scripts/pg-dev.mjs <start|stop>");
  process.exit(1);
}
