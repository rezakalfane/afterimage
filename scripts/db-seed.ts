// npm run db:seed — idempotent seed (public tenant + immutable episode version).
import { loadEnv } from "./lib/env-file";
import { openClient, seed } from "./lib/db";

loadEnv();
const client = openClient(process.env.DATABASE_URL!, process.env.DATABASE_AUTH_TOKEN);
const r = await seed(client, process.env.PUBLIC_TENANT_SLUG ?? "demo");
client.close();
console.log(`✓ seed (épisode ${r.episode}, empreinte ${r.hash.slice(0, 12)}…)`);
if (r.episode === "differs") {
  console.error("✗ le contenu de l’épisode publié a changé : publiez une nouvelle version au lieu de modifier v1.");
  process.exit(1);
}
