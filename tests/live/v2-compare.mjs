// Live V1 vs V2 avatar comparison in the real game PiP (consumes credits). Dev server, live mode.
// For each locale and version: temporarily point the 2 agents of that locale to the V1 or V2
// companion (only when no session is open on them), play a short scene (Malik 2026, then Jeanne
// 1996), measure click→audio and click→video, record the page, then ALWAYS restore the adopted version (V2).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const res = JSON.parse(readFileSync("config/napster-resources.json", "utf8"));
const env = readFileSync(".env.local", "utf8") + "\n" + (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })();
const KEY = /^NAPSTER_API_KEY=(.*)$/m.exec(env)[1].replace(/^["']|["']$/g, "");
const API = "https://companion-api.napster.com";
const api = async (path, method = "GET", body) => {
  const r = await fetch(API + path, { method, headers: { "X-Api-Key": KEY, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 120)}`);
  return t ? JSON.parse(t) : null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function openSessionsOn(ids) {
  const s = await api("/public/sessions?pageSize=50");
  return s.items.filter((x) => (x.status === "pending" || x.status === "started") && x.agent && ids.includes(x.agent.id)).length;
}
async function setCompanions(locale, version) {
  const ids = [res.agents.jeanne[locale], res.agents.malik[locale]];
  if (await openSessionsOn(ids)) throw new Error(`session open on ${locale} agents: not touching them`);
  const src = version === "v2" ? res.companions : res.companionsV1;
  for (const c of ["jeanne", "malik"]) await api(`/public/agents/${res.agents[c][locale]}`, "PATCH", { companionId: src[c].id });
}

const out = [];
const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
async function scene(locale, version) {
  const ctx = await b.newContext({ permissions: ["microphone"], viewport: { width: 1440, height: 900 }, recordVideo: { dir: `var/v2-compare/${locale}-${version}`, size: { width: 1440, height: 900 } } });
  await ctx.addCookies([{ name: "afterimage_locale", value: locale, url: BASE }]);
  const p = await ctx.newPage();
  const L = locale === "fr" ? { start: "Commencer", talk: (n) => `Parler à ${n}`, allow: "Autoriser le micro et parler", live: /En conversation|répond|Micro coupé/, era: "Époque", end: "Terminer la conversation" }
                            : { start: "Start", talk: (n) => `Talk to ${n}`, allow: "Allow the microphone and talk", live: /In conversation|answering|Mic muted/, era: "Era", end: "End the conversation" };
  const row = { locale, version };
  try {
    await p.goto(BASE + "/");
    await p.getByRole("button", { name: L.start }).click();
    await p.waitForURL(/\/play\/run_/);
    const t0 = Date.now();
    await p.getByRole("button", { name: L.talk("Malik") }).click();
    const allow = p.getByRole("button", { name: L.allow });
    if (await allow.isVisible({ timeout: 2500 }).catch(() => false)) await allow.click();
    await p.locator(".character__head .state").filter({ hasText: L.live }).waitFor({ state: "attached", timeout: 60000 });
    row.malikAudioMs = Date.now() - t0;
    await p.locator(".character__portrait.is-hidden").waitFor({ state: "attached", timeout: 60000 });
    row.malikVideoMs = Date.now() - t0;
    row.malikVideo = await p.evaluate(() => { const v = document.querySelector(".character__live video"); return v ? `${v.videoWidth}x${v.videoHeight}` : "none"; });
    await sleep(9000); // opening line spoken (lip sync visible in the recording)
    await p.locator(".character").screenshot({ path: `var/v2-compare/pip-${locale}-${version}-malik.png` });
    const t1 = Date.now();
    await p.getByRole("navigation", { name: L.era }).getByRole("button", { name: "1996" }).click();
    await p.locator(".character__head h2").filter({ hasText: "Jeanne" }).waitFor({ timeout: 30000 });
    await p.locator(".character__head .state").filter({ hasText: L.live }).waitFor({ state: "attached", timeout: 60000 });
    row.switchAudioMs = Date.now() - t1;
    await p.locator(".character__portrait.is-hidden").waitFor({ state: "attached", timeout: 60000 });
    row.switchVideoMs = Date.now() - t1;
    await sleep(9000);
    await p.locator(".character").screenshot({ path: `var/v2-compare/pip-${locale}-${version}-jeanne.png` });
    await p.getByRole("button", { name: L.end }).click();
    await sleep(2500);
  } catch (e) {
    row.error = String(e.message ?? e).slice(0, 160);
    await p.getByRole("button", { name: L.end }).click({ timeout: 3000 }).catch(() => {});
  } finally {
    await ctx.close();
  }
  out.push(row);
  console.log("•", JSON.stringify(row));
}
try {
  for (const locale of ["fr", "en"]) {
    for (const version of ["v1", "v2"]) {
      await setCompanions(locale, version);
      await scene(locale, version);
      await sleep(3000);
    }
  }
} catch (e) {
  console.log("ERROR", String(e.message ?? e).slice(0, 200));
} finally {
  // Always back to the adopted version, V2 (wait for our sessions to close first).
  for (const locale of ["fr", "en"]) {
    for (let i = 0; i < 10 && (await openSessionsOn([res.agents.jeanne[locale], res.agents.malik[locale]])); i++) await sleep(3000);
    try { await setCompanions(locale, "v2"); console.log(`restored V2 on ${locale} agents`); } catch (e) { console.log("RESTORE FAILED", locale, e.message); }
  }
  await b.close();
}
