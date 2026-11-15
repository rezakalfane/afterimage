// Integration test environment: a real SQLite file, real migrations, real Better Auth.
// Only the Napster HTTP API is stubbed (tests/support/napster-stub.ts).
import { rmSync } from "node:fs";
import { applyMigrations, openClient, seed } from "../../scripts/lib/db";

const file = `var/test-${process.pid}.db`;
for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });

Object.assign(process.env, {
  APP_ENV: "test",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-".padEnd(48, "x"),
  MEMORY_ID_SECRET: "test-memory-".padEnd(48, "y"),
  CRON_SECRET: "test-cron-".padEnd(32, "z"),
  DATABASE_URL: `file:${file}`,
  CONVERSATION_MODE: "live",
  NAPSTER_API_KEY: "test-key-not-real",
  NAPSTER_JEANNE_AGENT_ID: "agent-jeanne-test",
  NAPSTER_MALIK_AGENT_ID: "agent-malik-test",
  NAPSTER_MAX_ACTIVE: "2",
  PUBLIC_TENANT_SLUG: "demo",
});

const client = openClient(process.env.DATABASE_URL!);
await applyMigrations(client);
await seed(client, "demo");
client.close();
