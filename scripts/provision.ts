// Idempotent provisioning: content/ → Napster companions, tools and agents (one agent per
// character per locale). Writes the IDs to src/generated/napster-ids.json (commit that file).
//
//   npm run provision            create what is missing, update what exists
//   npm run provision -- --dry   print the plan without calling the API
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHARACTERS, LOCALES, LOCALE_CODES, WORLD, tr, type CharacterDef, type Locale } from "../src/lib/content";
import { napster } from "../src/lib/napster/api";
import type { NapsterIds } from "../src/lib/napster/ids";
import { toolDefinitions } from "../src/lib/tools";

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const IDS_PATH = root("src/generated/napster-ids.json");
const dry = process.argv.includes("--dry");

const ids: NapsterIds & { _comment?: string } = JSON.parse(readFileSync(IDS_PATH, "utf8"));
ids.companions ??= {};
ids.functions ??= {};
ids.agents ??= {};
const save = () => !dry && writeFileSync(IDS_PATH, JSON.stringify(ids, null, 2) + "\n");

async function call<T>(label: string, path: string, method: string, body?: unknown): Promise<T | null> {
  console.log(`  ${dry ? "[dry] " : ""}${method} ${path}  (${label})`);
  if (dry) return null;
  return napster<T>(path, { method, body });
}

/** The companion: a stock catalog avatar until a custom portrait is provided. */
async function ensureCompanion(c: CharacterDef): Promise<string | null> {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const custom = c.companion.picture && base ? `${base}/${c.companion.picture.replace(/^\//, "")}` : null;
  const source = custom ?? `stock:${c.companion.stockId}`;
  const existing = ids.companions[c.id];
  if (existing?.source === source) return existing.id;
  if (c.companion.picture && !base) console.warn(`  ! ${c.id}: picture set but PUBLIC_BASE_URL is empty — using the stock avatar`);
  if (!custom) {
    if (!c.companion.stockId) throw new Error(`${c.id}: set companion.stockId or companion.picture`);
    ids.companions[c.id] = { id: c.companion.stockId, source };
    return c.companion.stockId;
  }
  const created = await call<{ id: string }>(`${c.id} companion`, "/public/companions", "POST", {
    firstName: c.firstName,
    lastName: c.lastName,
    description: c.description,
    pictureUrl: custom,
    gender: c.companion.gender,
    version: c.companion.version,
    tags: { game: "afterimage", character: c.id },
  });
  if (!created) return null;
  ids.companions[c.id] = { id: created.id, source };
  return created.id;
}

async function ensureTools(): Promise<void> {
  for (const [name, def] of Object.entries(toolDefinitions())) {
    const existing = ids.functions[name];
    if (existing) {
      await call(`tool ${name}`, `/public/functions/${existing}`, "PUT", def);
    } else {
      const created = await call<{ id: string }>(`tool ${name}`, "/public/functions", "POST", def);
      if (created) ids.functions[name] = created.id;
    }
  }
}

function instructions(c: CharacterDef, locale: Locale): string {
  const prompt = readFileSync(root(`content/characters/${c.promptFile}`), "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
  const places = WORLD.locations.map((l) => `- ${l.id}: ${tr(l.label, locale)}`).join("\n");
  return [
    prompt,
    "## Places (use these ids with your tools)",
    places,
    "## Established facts",
    "The session profile field `faits_etablis` lists what is already true in this timeline. Trust it over anything else.",
    "## Language",
    `Always speak ${LOCALES[locale].speak}, whatever language the user uses. Translate place names naturally.`,
  ].join("\n\n");
}

async function ensureAgent(c: CharacterDef, locale: Locale, companionId: string): Promise<void> {
  const body = {
    companionId,
    name: `afterimage-${c.id}-${locale}`,
    voiceId: c.voiceId,
    language: locale, // strict lock: the agent never switches language mid-session
    useWebSearch: false,
    disableIdleTimeout: false,
    functions: c.tools.map((t) => ids.functions[t]).filter(Boolean),
    tags: { game: "afterimage", character: c.id, locale },
    providerSettings: {
      temperature: c.temperature,
      instructions: instructions(c, locale),
      noiseReduction: { type: "nearField" },
    },
  };
  ids.agents[c.id] ??= {};
  const existing = ids.agents[c.id]![locale];
  if (existing) {
    await call(`agent ${c.id}/${locale}`, `/public/agents/${existing}`, "PATCH", body);
  } else {
    const created = await call<{ id: string }>(`agent ${c.id}/${locale}`, "/public/agents", "POST", body);
    if (created) ids.agents[c.id]![locale] = created.id;
  }
}

async function main() {
  console.log(`Locales: ${LOCALE_CODES.join(", ")}${dry ? " (dry run)" : ""}`);
  console.log("Tools");
  await ensureTools();
  save();
  for (const c of Object.values(CHARACTERS)) {
    console.log(`Character ${c.id}`);
    const companionId = (await ensureCompanion(c)) ?? "<companion>";
    save();
    for (const locale of LOCALE_CODES) {
      await ensureAgent(c, locale, companionId);
      save();
    }
  }
  console.log(dry ? "Dry run done." : `Done. IDs written to src/generated/napster-ids.json`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
