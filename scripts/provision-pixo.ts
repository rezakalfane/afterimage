// npm run provision:pixo [-- --apply]
// Creates (once, idempotently) the secret 2056 companion Pixo: a V1 companion from the reference
// portrait, then one agent per language with NO tools and NO game knowledge. Dry run by default.
// IDs go into config/napster-resources.json; the app reads NAPSTER_PIXO_AGENT_ID[_EN].
// Creating a companion and agents spends a few cents of Napster credit: see AGENTS.md budget.
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/env-file";
import { PIXO_PROMPTS } from "../src/content/episodes/last-screening/v1/pixo";

loadEnv();
const BASE = "https://companion-api.napster.com";
const KEY = process.env.NAPSTER_API_KEY;
const apply = process.argv.includes("--apply");
if (!KEY) throw new Error("NAPSTER_API_KEY absent (.env.local / .env).");
const RES_PATH = "config/napster-resources.json";
const res = JSON.parse(readFileSync(RES_PATH, "utf8"));
const PICTURE = process.env.PIXO_PICTURE ?? "https://raw.githubusercontent.com/rezakalfane/afterimage/main/assets-src/afterimage/characters/pixo-reference.png";
const VOICE = process.env.PIXO_VOICE ?? "verse";
// V1 refuses a robot face ("No face detected"); V2 is tried with --version=v2.
const VERSION = (process.argv.find((a) => a.startsWith("--version="))?.split("=")[1] ?? "v1") as "v1" | "v2";

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, { method, headers: { "X-Api-Key": KEY!, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Pixo provisioning — ${apply ? "APPLY" : "dry run"} — voice ${VOICE}`);
  res.companionsV1 ??= {};
  res.agents.pixo ??= {};

  // Napster refuses a robot face ("No face detected", V1 and V2, full portrait and tight crop), and
  // has no audio-only agent. --reuse-companion=<character> lends that character's V1 companion for
  // the voice session only: its video is never shown (the app shows the Pixo portrait instead).
  const reuse = process.argv.find((a) => a.startsWith("--reuse-companion="))?.split("=")[1];
  let companionId: string | undefined = reuse ? res.companionsV1[reuse]?.id : res.companionsV1.pixo?.id;
  if (reuse && !companionId) throw new Error(`No V1 companion for ${reuse} in ${RES_PATH}.`);
  if (reuse) {
    console.log(`  borrowing the V1 companion of ${reuse} (${companionId!.slice(0, 8)}…); video hidden by the app`);
    res.pixoCompanion = { borrowedFrom: reuse, id: companionId, note: "Napster rejects robot faces; the app never shows this video." };
  } else
  if (companionId && !reuse) console.log(`  companion V1 exists: ${companionId.slice(0, 8)}…`);
  else {
    console.log(`  POST companion Pixo (${VERSION}) from ${PICTURE.split("/").slice(-2).join("/")}`);
    if (apply) {
      const c = await api<{ id: string }>("/public/companions", "POST", {
        firstName: "Pixo",
        lastName: "2056",
        gender: "nonBinary",
        description: "Pixo, a cheerful and absurd robot projectionist in a retro-futuristic cinema booth in 2056. He shows old human films, in black and white, to an audience of robots.",
        pictureUrl: PICTURE,
        tags: { app: "afterimage", character: "pixo", version: VERSION, portrait: "pixo-reference" },
        version: VERSION,
      });
      companionId = c.id;
      res.companionsV1.pixo = { id: companionId, kind: `custom-${VERSION}`, source: PICTURE, note: "Secret 2056 companion, created by provision:pixo." };
      writeFileSync(RES_PATH, JSON.stringify(res, null, 2) + "\n");
    }
  }

  if (apply && companionId) {
    for (let i = 0; i < 60; i++) {
      const c = await api<{ status: string }>(`/public/companions/${companionId}`);
      console.log(`  companion status: ${c.status}`);
      if (c.status === "readyToUse" || c.status === "completed") break;
      if (c.status === "failed") throw new Error("Companion creation failed.");
      await sleep(10_000);
    }
  }

  for (const locale of ["fr", "en"] as const) {
    if (res.agents.pixo[locale]) {
      const id = String(res.agents.pixo[locale]);
      const cur = apply ? await api<{ companionId?: string }>(`/public/agents/${id}`) : null;
      // Pixo must own its companion (no shared persona or memory with another character).
      if (apply && companionId && cur?.companionId !== companionId) {
        console.log(`  PATCH agent pixo/${locale} (${id.slice(0, 8)}…): companion → ${companionId.slice(0, 8)}…`);
        await api(`/public/agents/${id}`, "PATCH", { companionId });
      } else console.log(`  agent pixo/${locale} exists: ${id.slice(0, 8)}…`);
      continue;
    }
    console.log(`  POST agent afterimage-pixo-${locale}: voice ${VOICE}, no tools, ${PIXO_PROMPTS[locale].length} chars of instructions`);
    if (!apply || !companionId) continue;
    const a = await api<{ id: string }>("/public/agents", "POST", {
      companionId,
      name: `afterimage-pixo-${locale}`,
      language: locale,
      voiceId: VOICE,
      functions: [],
      useWebSearch: false,
      mode: "conversation",
      tags: { app: "afterimage", character: "pixo", locale },
      providerSettings: { temperature: 0.9, instructions: PIXO_PROMPTS[locale], noiseReduction: { type: "nearField" } },
    });
    res.agents.pixo[locale] = a.id;
    await api(`/public/agents/${a.id}/channels/webrtc`, "PUT", { videoPolicy: "deferred" });
    writeFileSync(RES_PATH, JSON.stringify(res, null, 2) + "\n");
  }

  if (apply) {
    console.log(`Done. NAPSTER_PIXO_AGENT_ID=${res.agents.pixo.fr ?? "?"}  NAPSTER_PIXO_AGENT_ID_EN=${res.agents.pixo.en ?? "?"}`);
  } else console.log("Dry run only. Re-run with `-- --apply` to perform this plan.");
}
main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
