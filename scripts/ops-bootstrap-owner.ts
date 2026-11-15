// npm run ops:bootstrap-owner -- --email=you@example.com [--tenant=ten_…]
// Prints a one-time owner invitation link. Works on any environment the operator can reach.
import { loadEnv } from "./lib/env-file";
import { openClient } from "./lib/db";
import { createBootstrapInvitation } from "./lib/bootstrap";

loadEnv();
const email = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1];
const tenant = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("usage: npm run ops:bootstrap-owner -- --email=vous@exemple.fr");
  process.exit(1);
}
const client = openClient(process.env.DATABASE_URL!, process.env.DATABASE_AUTH_TOKEN);
const link = await createBootstrapInvitation(client, process.env.APP_URL!, email, tenant);
client.close();
console.log("Lien d’amorçage (usage unique, 24 h) — à ouvrir par l’owner, ne pas partager :");
console.log(link);
