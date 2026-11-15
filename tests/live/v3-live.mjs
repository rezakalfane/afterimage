// Live test of chapter v2 (brief v3) on the REAL game screen (consumes Napster credits). Dev server in live mode on :3000.
// Distributed G7 by conversation, and what Jeanne knows before/after the player shares anything.
import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const out = {};
const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ permissions: ["microphone"], viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 160)));
const t0 = Date.now();
const log = (k, v) => { out[k] = v; console.log("•", k, typeof v === "string" ? v.slice(0, 220) : JSON.stringify(v)); };
async function goLive(name) {
  await p.getByRole("button", { name: `Parler à ${name}` }).click();
  const t = Date.now();
  const consent = p.getByRole("button", { name: "Autoriser le micro et parler" });
  if (await consent.isVisible({ timeout: 3000 }).catch(() => false)) await consent.click();
  await waitLive(name, t);
}
async function waitLive(name, t = Date.now()) {
  await p.locator(".character__head .state").filter({ hasText: /En conversation|répond|Micro coupé/ }).waitFor({ state: "attached", timeout: 60000 });
  log(`${name}: live after ms`, Date.now() - t);
  log(`${name}: name in header while live`, await p.locator(".character__head h2").innerText());
  const mute = p.getByRole("button", { name: "Couper le micro" });
  if (await mute.isVisible().catch(() => false)) await mute.click(); // mute the fake mic: typed turns only
}
async function waitSubtitle(re, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = (await p.locator(".character__subtitles").innerText().catch(() => "")) + " " + (await p.locator(".history__list").innerText().catch(() => ""));
    if (re.test(s)) return s;
    await p.waitForTimeout(700);
  }
  return (await p.locator(".character__subtitles").innerText().catch(() => ""));
}
async function type(text) {
  const write = p.getByRole("button", { name: /^Écrire à/ });
  if ((await write.getAttribute("aria-expanded")) !== "true") await write.click();
  await p.locator("#say").fill(text);
  await p.getByRole("button", { name: "Envoyer" }).click();
}
const lastJeanne = async () => (await p.locator(".character__subtitles").innerText().catch(() => "")).trim();
async function say(text, ms = 9000) {
  if (await p.locator("dialog[open]").count()) await p.keyboard.press("Escape");
  await type(text);
  await p.waitForTimeout(ms);
  return lastJeanne();
}
const card = (re) => p.getByRole("button", { name: re }).waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
try {
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "Commencer" }).click();
  await p.waitForURL(/\/play\/run_/);
  await goLive("Malik");
  await waitSubtitle(/Régina|reçois/);
  await type("Bonjour Malik. Peux-tu regarder la photo sur le bureau et me lire son verso ?");
  log("Malik: photo in notebook", await card(/Photographie du Régina/));
  log("Malik reaction (no seat named?)", await waitSubtitle(/place|habituelle/i));
  await p.keyboard.press("Escape");
  await p.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: "1996" }).click();
  await p.locator(".character__head h2").filter({ hasText: "Jeanne" }).waitFor({ timeout: 30000 });
  await waitLive("Jeanne");
  await waitSubtitle(/entendez|cabine/i);
  log("Q1 (nothing shared) Malik / 2026?", await say("Connaissez-vous Malik ? Et que se passera-t-il ici en 2026 ?", 10000));
  log("share note", await say("J’ai trouvé une note au dos d’une photo : « La clé est à notre place habituelle. — J. »", 10000));
  log("ask usual place", await say("Quelle était votre place habituelle, avec Alice ?", 10000));
  log("row memory card", await card(/Souvenir de Jeanne/));
  log("programme", await say("Pouvez-vous lire le programme de la séance, sur le bureau ?", 10000));
  log("programme card", await card(/Programme du 15 novembre/));
  await p.keyboard.press("Escape");
  log("propose seat", await say("Rangée G, place 7 : je propose le siège G7. Pouvez-vous chercher la clé dessous ?", 12000));
  log("key card", await card(/Clé au croissant/));
  log("Q2 temporal claim", await say("Je dois vous dire une chose : je viens de 2026.", 10000));
  log("Q3 after claim, Malik?", await say("Et Malik, vous savez qui c’est ?", 9000));
  await p.screenshot({ path: "var/screens/after/live-v3-1440.png" });
  await p.getByRole("button", { name: "Terminer la conversation" }).click();
  await p.getByRole("button", { name: "Parler à Jeanne" }).waitFor({ timeout: 20000 });
  log("hung up", true);
} catch (e) {
  log("ERROR", String(e.message ?? e).slice(0, 300));
  await p.screenshot({ path: "var/screens/live-error.png" });
} finally {
  await b.close();
  log("total ms", Date.now() - t0);
}
