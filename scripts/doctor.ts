// npm run doctor — sanitized diagnostics. Prints variable NAMES and states, never values.
import { existsSync } from "node:fs";
import { loadEnv } from "./lib/env-file";
import { openClient } from "./lib/db";

loadEnv();
const ok = (b: boolean) => (b ? "✓" : "✗");
let failures = 0;
const check = (label: string, pass: boolean, hint = "") => {
  if (!pass) failures++;
  console.log(`${ok(pass)} ${label}${!pass && hint ? ` — ${hint}` : ""}`);
};

const [maj, min] = process.versions.node.split(".").map(Number);
check(`Node ${process.versions.node}`, maj > 22 || (maj === 22 && min >= 12), "Node >= 22.12 requis");
check(".env.local présent", existsSync(".env.local"), "npm run setup");
const { checkEnv } = await import("../src/server/env");
const issues = checkEnv(process.env);
check("configuration serveur valide", issues.length === 0, issues.join("; "));
for (const k of Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_"))) check(`aucun secret public (${k})`, !/KEY|SECRET|TOKEN|PASSWORD/.test(k), "ne jamais préfixer un secret par NEXT_PUBLIC_");

const url = process.env.DATABASE_URL;
if (url) {
  try {
    const c = openClient(url, process.env.DATABASE_AUTH_TOKEN);
    const m = await c.execute("SELECT count(*) n FROM __drizzle_migrations").catch(() => null);
    check(`base ${url.startsWith("file:") ? "locale" : "distante"} joignable`, true);
    check(`migrations appliquées (${m ? m.rows[0].n : 0})`, Boolean(m && Number(m.rows[0].n) > 0), "npm run db:migrate");
    const t = await c.execute("SELECT count(*) n FROM tenants WHERE is_public = 1").catch(() => null);
    check("tenant public de démonstration", Boolean(t && Number(t.rows[0].n) > 0), "npm run db:seed");
    const o = await c.execute("SELECT count(*) n FROM memberships WHERE role = 'owner'").catch(() => null);
    console.log(`${o && Number(o.rows[0].n) > 0 ? "✓" : "•"} owner ${o && Number(o.rows[0].n) > 0 ? "présent" : "absent (optionnel : npm run ops:bootstrap-owner -- --email=…)"}`);
    c.close();
  } catch (e) {
    check("base joignable", false, (e as Error).message.slice(0, 120));
  }
}

const mode = process.env.CONVERSATION_MODE ?? "rehearsal";
console.log(`• mode de conversation : ${mode === "live" ? "Napster réel" : "répétition (aucun appel Napster)"}`);
if (mode === "live" && process.env.NAPSTER_API_KEY) {
  // Non-destructive, read-only check of the key and of the two agents.
  const h = { "X-Api-Key": process.env.NAPSTER_API_KEY };
  for (const [name, id] of [["Jeanne", process.env.NAPSTER_JEANNE_AGENT_ID], ["Malik", process.env.NAPSTER_MALIK_AGENT_ID]] as const) {
    const r = id ? await fetch(`https://companion-api.napster.com/public/agents/${id}`, { headers: h }).catch(() => null) : null;
    check(`agent Napster ${name} accessible`, Boolean(r?.ok), r ? `HTTP ${r.status}` : "ID manquant");
  }
}
console.log(failures ? `\n${failures} problème(s).` : "\nTout est prêt.");
process.exit(failures ? 1 : 0);
