// Live smoke test of the secret 2056 booth (consumes a few cents of Napster credit). Dev server in
// live mode on :3000. Malik → "2056" typed (Pixo) → a joke → "stop" → "1996" typed (Jeanne).
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ permissions: ["microphone"], viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 160)));
const log = (k, v) => console.log("•", k, typeof v === "string" ? v.slice(0, 260) : JSON.stringify(v));
const header = () => p.locator(".character__head h2").innerText();
async function waitLive(name) {
  await p.locator(".character__head .state").filter({ hasText: /En conversation|répond|Micro coupé/ }).waitFor({ state: "attached", timeout: 60000 });
  log(`${name}: header`, await header());
  const mute = p.getByRole("button", { name: "Couper le micro" });
  if (await mute.isVisible().catch(() => false)) await mute.click();
}
async function lines(ms = 20000) {
  await p.waitForTimeout(ms);
  return (await p.locator(".character__subtitles").innerText().catch(() => "")) + " | " + (await p.locator(".history__list").innerText().catch(() => ""));
}
async function type(text) {
  const write = p.getByRole("button", { name: /^Écrire à/ });
  if ((await write.getAttribute("aria-expanded")) !== "true") await write.click();
  await p.locator("#say").fill(text);
  await p.getByRole("button", { name: "Envoyer" }).click();
}
try {
  await p.goto(BASE + "/");
  await p.getByRole("button", { name: "Commencer" }).click();
  await p.waitForURL(/\/play\/run_/);
  await p.getByRole("button", { name: "Parler à Malik" }).click();
  const consent = p.getByRole("button", { name: "Autoriser le micro et parler" });
  if (await consent.isVisible({ timeout: 3000 }).catch(() => false)) await consent.click();
  await waitLive("Malik");
  await type("2056");
  await p.locator(".game--2056").waitFor({ timeout: 20000 });
  log("scene 2056", true);
  await waitLive("Pixo");
  // Prove the voice goes through the bit crusher: the effect's output level while he greets.
  let peak = [0, 0];
  let differ = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 14000) {
    const [l, r] = await p.evaluate(() => window.__afterimageVoice?.levels?.() ?? [-1, -1]);
    peak = [Math.max(peak[0], l), Math.max(peak[1], r)];
    if (Math.abs(l - r) > 1e-4) differ++;
    await p.waitForTimeout(150);
  }
  log("crusher output peak L/R (0 = silent, -1 = no effect chain)", peak);
  log("samples where L and R differ (stereo, not mono)", differ);
  log("Pixo greeting", await lines(1000));
  await p.screenshot({ path: "var/screens/after/live-pixo-1440.png" });
  await type("Salut Pixo, moi c'est Reza. Parle-moi de ton public de robots.");
  log("Pixo answer", await lines(20000));
  await type("Pixo, tu connais Alice, la clé ou l'année 1996 ?");
  log("Pixo story question", await lines(20000));
  await type("1996");
  await p.locator(".game--1996").waitFor({ timeout: 20000 });
  await waitLive("Jeanne");
  log("Jeanne greeting", await lines(12000));
  await p.getByRole("button", { name: "Terminer la conversation" }).click().catch(() => {});
} catch (e) {
  console.log("✗", e.message.slice(0, 300));
  await p.screenshot({ path: "var/screens/after/live-pixo-fail.png" }).catch(() => {});
}
await b.close();
