// npm run db:migrate — apply migrations to DATABASE_URL (local). Remote: use `npm run release:migrate`.
import { loadEnv } from "./lib/env-file";
import { applyMigrations, openClient } from "./lib/db";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant (npm run setup).");
if (!url.startsWith("file:")) {
  console.error("✗ base distante : utilisez `npm run release:migrate` (procédure de release avec sauvegarde).");
  process.exit(1);
}
const client = openClient(url);
await applyMigrations(client);
client.close();
console.log("✓ migrations appliquées");
