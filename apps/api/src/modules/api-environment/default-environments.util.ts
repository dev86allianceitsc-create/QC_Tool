import type { Prisma, Environment } from "@prisma/client";

// Phase 1 auto-scaffold (customer feedback #4): every new Project is seeded
// with exactly these 3 Environments. allowRun follows the same
// classification-derived default as manual creation (EnvironmentsService.create) —
// NON_PRODUCTION -> true, PRODUCTION -> false.
export const DEFAULT_ENVIRONMENT_SEEDS: ReadonlyArray<{ environmentName: string; classification: "PRODUCTION" | "NON_PRODUCTION" }> = [
  { environmentName: "Dev", classification: "NON_PRODUCTION" },
  { environmentName: "UAT", classification: "NON_PRODUCTION" },
  { environmentName: "Production", classification: "PRODUCTION" },
];

// Plain function (not an injectable service method) so ProjectsService.create()
// can call it with its own already-open `tx` — Prisma interactive
// transactions cannot nest another $transaction, which rules out calling
// EnvironmentsService.create() (it opens its own).
//
// createdAt is set explicitly (not left to the column's @default(now()))
// because Postgres freezes now() at transaction start: all 3 inserts here
// share one transaction, so an unmodified default would give every seeded
// row the identical timestamp, leaving EnvironmentsService.list()'s
// `orderBy: { createdAt: "desc" }` with nothing to break the tie — the
// Dev/UAT/Production order shown to the user would then be whatever
// arbitrary order Postgres happens to return. Staggering by 1ms per seed
// (latest = Dev) keeps that list's newest-first order showing Dev, UAT,
// Production, matching seed order.
export async function createDefaultEnvironments(tx: Prisma.TransactionClient, projectId: string): Promise<Environment[]> {
  const now = Date.now();
  const created: Environment[] = [];
  for (const [index, seed] of DEFAULT_ENVIRONMENT_SEEDS.entries()) {
    const env = await tx.environment.create({
      data: {
        projectId,
        environmentName: seed.environmentName,
        classification: seed.classification,
        allowRun: seed.classification === "NON_PRODUCTION",
        environmentStatus: "ACTIVE",
        createdAt: new Date(now + (DEFAULT_ENVIRONMENT_SEEDS.length - 1 - index)),
      },
    });
    created.push(env);
  }
  return created;
}
