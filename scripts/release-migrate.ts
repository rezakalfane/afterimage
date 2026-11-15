// npm run release:migrate — RELEASE JOB for staging/production (never run by `next build`).
// Applies migrations to the remote libSQL database in DATABASE_URL with DATABASE_AUTH_TOKEN, after
// an explicit confirmation of the target, then seeds idempotently. Take a backup/point-in-time
// reference with your database provider BEFORE running it (see docs/OPERATIONS.md).
//   APP_ENV=staging DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run release:migrate -- --confirm=staging
import { applyMigrations, openClient, seed } from "./lib/db";

const env = process.env.APP_ENV;
const url = process.env.DATABASE_URL ?? "";
const confirm = process.argv.find((a) => a.startsWith("--confirm="))?.split("=")[1];
if (env !== "staging" && env !== "production") throw new Error("APP_ENV must be staging or production for a release migration.");
if (!url.startsWith("libsql://") && !url.startsWith("https://")) throw new Error("DATABASE_URL must be a remote libSQL URL.");
if (confirm !== env) {
  console.error(`Refusing: pass --confirm=${env} to migrate ${new URL(url.replace(/^libsql:/, "https:")).host}.`);
  process.exit(1);
}
const c = openClient(url, process.env.DATABASE_AUTH_TOKEN);
const before = await c.execute("SELECT count(*) n FROM __drizzle_migrations").then((r) => Number(r.rows[0].n)).catch(() => 0);
await applyMigrations(c);
const after = await c.execute("SELECT count(*) n FROM __drizzle_migrations").then((r) => Number(r.rows[0].n));
const s = await seed(c, process.env.PUBLIC_TENANT_SLUG ?? "demo");
c.close();
console.log(`✓ ${env}: migrations ${before} → ${after}; seed ${s.episode}`);
if (s.episode === "differs") {
  console.error("✗ published episode content differs: ship a new episode version.");
  process.exit(1);
}
