// Live smoke test of the REAL game screen (consumes Napster credits). Dev server in live mode on :3000.
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
  await p.locator(".character__head .state").filter({ hasText: /À l’écoute|répond|Micro coupé/ }).waitFor({ timeout: 60000 });
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
  await p.getByLabel(/Écrire à/).fill(text);
  await p.getByRole("button", { name: "Envoyer" }).click();
}
try {
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "Commencer" }).click();
  await p.waitForURL(/\/play\/run_/);
  log("state before live", await p.locator(".character__head .state").innerText());
  await goLive("Malik");
  log("video element", await p.evaluate(() => { const v = document.querySelector(".character__live video"); return v ? `${v.videoWidth}x${v.videoHeight} paused=${v.paused}` : "none"; }));
  log("Malik opening", await waitSubtitle(/Régina|reçois/));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "var/screens/after/live-malik-1440.png" });
  await type("Bonjour Malik. Peux-tu examiner la photo sur le bureau et me lire son verso ?");
  await p.getByRole("button", { name: /Photographie du Régina/ }).waitFor({ timeout: 60000 });
  log("notebook updated by tool", true);
  log("Malik reaction", await waitSubtitle(/G\s?7|G sept/i));
  // The photo Malik just read opened on its own (auto-open): look at it, then close it.
  log("photo opened automatically", await p.getByRole("dialog").isVisible().catch(() => false));
  await p.screenshot({ path: "var/screens/after/live-autoopen-1440.png" });
  await p.keyboard.press("Escape");
  await p.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: "1996" }).click();
  // During a call, the era switch closes Malik's session then reconnects Jeanne by itself.
  await p.locator(".character__head h2").filter({ hasText: "Jeanne" }).waitFor({ timeout: 30000 });
  log("era switched to 1996 after closing Malik", true);
  await waitLive("Jeanne");
  log("Jeanne opening", await waitSubtitle(/entendez|cabine/i));
  await p.getByRole("button", { name: /Photographie du Régina/ }).click();
  await p.getByRole("dialog").getByRole("button", { name: /Transmettre cet indice à Jeanne/ }).click();
  await p.keyboard.press("Escape");
  log("Jeanne reaction to UI-relayed clue (context push)", await waitSubtitle(/G\s?7|G sept|siège|chercher/i));
  await type("Peux-tu aller chercher la clé sous le siège G7, s’il te plaît ?");
  await p.getByRole("button", { name: /Clé au croissant/ }).waitFor({ timeout: 60000 }).then(() => log("Jeanne tool → key in notebook", true)).catch(() => log("Jeanne tool → key in notebook", false));
  log("Jeanne after search", await waitSubtitle(/clé|trouv/i));
  await p.screenshot({ path: "var/screens/after/live-jeanne-1440.png" });
  await p.getByRole("button", { name: "Terminer la conversation" }).click();
  await p.getByRole("button", { name: "Parler à Jeanne" }).waitFor({ timeout: 20000 });
  log("hung up", true);
} catch (e) {
  log("ERROR", String(e.message ?? e).slice(0, 300));
  await p.screenshot({ path: "var/screens/live-error.png" });
} finally {
  await p.screenshot({ path: "var/screens/live-final.png" });
  await b.close();
  log("total ms", Date.now() - t0);
}
