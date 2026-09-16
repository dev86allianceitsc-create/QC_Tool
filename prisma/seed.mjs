#!/usr/bin/env node
// Development/demo-only seed data so the USR requirements (API-USR-001,
// API-USR-005, SessionGuard account-status behavior) can be demonstrated.
//
// NOT for production. Idempotent: re-running this script never creates
// duplicate rows and never overwrites a row that already exists — this
// matters because the Demo Admin is meant to go through the real Google
// first-login flow live during the demo (INVITED -> ACTIVE, googleSubjectId
// set); re-running the seed afterwards must not reset that progress.
//
// Seeds only: 1 Admin (INVITED, email from SEED_ADMIN_EMAIL), 1 Demo Invited
// User, 1 Demo Blocked User, 1 Demo Project. No sessions, no Google subject
// ids, no project memberships, no audit logs, no PRJ-002 behavior.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const DEMO_NOTE = "Development/demo bootstrap data (prisma/seed.mjs) — not a real account.";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function ensureUser(prisma, { email, systemRole, accountStatus, note }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] user ${email} already exists (userId=${existing.userId}, accountStatus=${existing.accountStatus}) — left unchanged`);
    return existing;
  }

  const created = await prisma.user.create({
    data: {
      email,
      systemRole,
      accountStatus,
      googleSubjectId: null,
      activatedAt: null,
      note,
    },
  });
  console.log(`[seed] created user ${created.email} (userId=${created.userId}, accountStatus=${created.accountStatus})`);
  return created;
}

async function ensureProject(prisma, { projectName, note }) {
  const existing = await prisma.project.findFirst({ where: { projectName } });
  if (existing) {
    console.log(`[seed] project "${projectName}" already exists (projectId=${existing.projectId}) — left unchanged`);
    return existing;
  }

  // projectStatus: Initial Business Value "ACTIVE" (Database AnD Section 4
  // Notes), set explicitly here — not a SQL DEFAULT (Database Standard v2.0
  // Section 14), same pattern as accountStatus above.
  const created = await prisma.project.create({ data: { projectName, projectStatus: "ACTIVE", note } });
  console.log(`[seed] created project "${created.projectName}" (projectId=${created.projectId}, projectStatus=${created.projectStatus})`);
  return created;
}

async function main() {
  const adminEmailRaw = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmailRaw) {
    throw new Error(
      "SEED_ADMIN_EMAIL is not set. Set it in your local .env to a development email you control " +
        "(never a real personal address, and never commit it) before running the seed.",
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    await ensureUser(prisma, {
      email: normalizeEmail(adminEmailRaw),
      systemRole: "ADMIN",
      accountStatus: "INVITED",
      note: `${DEMO_NOTE} Demo Admin — intentionally INVITED so the mentor demo can show the real Google first-login flow (INVITED -> Google identity linking -> ACTIVE -> session creation).`,
    });

    await ensureUser(prisma, {
      email: normalizeEmail("demo.invited@example.com"),
      systemRole: "USER",
      accountStatus: "INVITED",
      note: `${DEMO_NOTE} Demo Invited User — target account for API-USR-005 (invited-user email edit).`,
    });

    await ensureUser(prisma, {
      email: normalizeEmail("demo.blocked@example.com"),
      systemRole: "USER",
      accountStatus: "BLOCKED",
      note: `${DEMO_NOTE} Demo Blocked User — no Google identity; demonstrates login/session rejection for a BLOCKED account.`,
    });

    await ensureProject(prisma, {
      projectName: "QC Tool Demo Project",
      note: `${DEMO_NOTE} Demo project for USR requirement demonstrations. No memberships seeded; no PRJ-002 behavior implied.`,
    });

    console.log("[seed] done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exitCode = 1;
});
