// Prisma 7 CLI/Migrate configuration. Connection URL is CLI-only here —
// no PrismaClient/runtime usage exists in this repo yet (Phase B scope is
// schema + migration files only). dotenv is loaded explicitly because
// @prisma/config's env() reads only process.env and does not load .env itself.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
