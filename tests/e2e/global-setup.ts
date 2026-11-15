import { rmSync } from "node:fs";
import { applyMigrations, openClient, seed } from "../../scripts/lib/db";

export default async function globalSetup() {
  for (const f of ["var/e2e.db", "var/e2e.db-wal", "var/e2e.db-shm"]) rmSync(f, { force: true });
  const c = openClient("file:./var/e2e.db");
  await applyMigrations(c);
  await seed(c, "demo");
  c.close();
}
