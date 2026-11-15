// Visual review captures of identical game states at several viewports (not assertions).
//   SCREENS_DIR=var/screens/before npx playwright test --project=capture
// States are reached through the real command API (same validation as the UI), then the page is
// reloaded, so before/after captures show exactly the same server state.
import { test, type Page } from "@playwright/test";

const DIR = process.env.SCREENS_DIR ?? "var/screens/after";
const VIEWPORTS = [
  { id: "1920", width: 1920, height: 1080, scale: 1 },
  { id: "1440", width: 1440, height: 900, scale: 1 },
  { id: "1280", width: 1280, height: 720, scale: 1 },
  { id: "390", width: 390, height: 844, scale: 3, mobile: true },
  // 200 % zoom of a 1440×900 window = a 720×450 CSS viewport at device scale 2.
  { id: "zoom200", width: 720, height: 450, scale: 2 },
];
type Step = [string, Record<string, unknown>?];
const TO_KEY: Step[] = [["inspect_photo"], ["inspect_waterline"], ["switch_era", { era: 1996 }], ["share_photo_note"], ["ask_usual_place"], ["inspect_programme"], ["propose_seat", { seat: "G7" }], ["retrieve_key"], ["open_cabinet"]];
const TO_LETTER: Step[] = [...TO_KEY, ["read_letter"]];
const TO_WORDS: Step[] = [...TO_LETTER, ["acknowledge_permission"], ["relay_flood_warning"], ["write_message", { text: "Les étoiles restent allumées. Je reviendrai." }]];
const TO_STORED: Step[] = [...TO_WORDS, ["confirm_message", { text: "Les étoiles restent allumées. Je reviendrai." }], ["preserve_cache", { location: "upper_cabinet" }]];
const TO_DECIDE: Step[] = [...TO_STORED, ["switch_era", { era: 2026 }], ["find_future_key"], ["recover_cache"], ["read_message"], ["read_future_letter"]];

let lastRun: string | null = null;
async function newRun(page: Page): Promise<string> {
  // Guests may keep 3 active games: delete the previous capture game first.
  if (lastRun) await page.request.delete(`/api/runs/${lastRun}`, { headers: { Origin: new URL(page.url()).origin } });
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
  lastRun = page.url().split("/play/")[1];
  return lastRun;
}
async function apply(page: Page, runId: string, steps: Step[]) {
  const origin = new URL(page.url()).origin;
  let rev = (await (await page.request.get(`/api/runs/${runId}`)).json()).publicState.revision as number;
  for (const [action, args] of steps) {
    const r = await page.request.post(`/api/runs/${runId}/commands`, { headers: { Origin: origin }, data: { commandId: `cap:${runId}:${action}:${rev}`, expectedRevision: rev, action, ...(args ? { args } : {}) } });
    const b = await r.json();
    if (!b.ok) throw new Error(`${action}: ${JSON.stringify(b).slice(0, 200)}`);
    rev = b.revision;
  }
  await page.reload();
  await page.waitForTimeout(700);
}
const shot = (page: Page, vp: string, name: string, full = false) => page.screenshot({ path: `${DIR}/${vp}/${name}.png`, fullPage: full });

for (const vp of VIEWPORTS) {
  test(`capture ${vp.id} @capture`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    lastRun = null;
    const full = Boolean(vp.mobile);
    await page.goto("/");
    await shot(page, vp.id, "01-home", full);
    const run = await newRun(page);
    await page.waitForTimeout(700);
    await shot(page, vp.id, "02-start-2026", full);
    // A long exchange: the history must not stretch the page.
    await page.getByRole("button", { name: /^Écrire à/ }).click({ timeout: 3000 }).catch(() => {}); // open the write panel
    for (const q of ["Bonjour Malik, que voyez-vous ?", "Et sur le bureau ?", "Parlez-moi de la photo.", "Qui était Alice Mercier ?", "Que s'est-il passé en 1996 ?", "Et l'armoire ?"]) {
      await page.locator("#say").fill(q);
      await page.locator("#say").press("Enter");
      await page.waitForTimeout(250);
    }
    // Open the history (new drawer, or the former <details> on old builds), without waiting long.
    await page.getByRole("button", { name: /^Historique/ }).click({ timeout: 2000 }).catch(() => page.locator(".transcript summary").click({ timeout: 2000 }).catch(() => {}));
    await page.waitForTimeout(300);
    await shot(page, vp.id, "03-history", full);
    await page.getByRole("button", { name: /Fermer l’historique/ }).click({ timeout: 2000 }).catch(() => {});
    await page.getByRole("button", { name: /^Bas de l’armoire$/ }).first().click();
    await page.waitForTimeout(300);
    await shot(page, vp.id, "04-inspect-waterline");
    await page.keyboard.press("Escape");
    await apply(page, run, TO_KEY);
    await shot(page, vp.id, "05-1996-cabinet-open", full);
    const r2 = await newRun(page);
    await apply(page, r2, TO_LETTER);
    await page.getByRole("button", { name: /Lettre d’Alice Mercier/ }).first().click();
    await page.waitForTimeout(300);
    await shot(page, vp.id, "06-letter");
    await page.keyboard.press("Escape");
    const r3 = await newRun(page);
    await apply(page, r3, TO_WORDS);
    await page.getByRole("button", { name: "Vos mots" }).click();
    await page.waitForTimeout(300);
    await shot(page, vp.id, "07-words");
    await page.keyboard.press("Escape");
    const r4 = await newRun(page);
    await apply(page, r4, TO_STORED);
    await shot(page, vp.id, "08-1996-stored", full);
    const r5 = await newRun(page);
    await apply(page, r5, TO_DECIDE);
    await shot(page, vp.id, "09-2026-recovered", full);
    await page.getByRole("button", { name: /Votre message/ }).first().click();
    await page.waitForTimeout(300);
    await shot(page, vp.id, "10-message-2026");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Décider du sort du film" }).click();
    await page.waitForTimeout(300);
    await shot(page, vp.id, "11-ending-choice");
    await page.getByRole("dialog").getByRole("button", { name: /Projeter la version autorisée/ }).click();
    await page.waitForTimeout(300);
    await shot(page, vp.id, "12-ending-confirm");
    await page.getByRole("dialog").getByRole("button", { name: /Je confirme/ }).click();
    await page.waitForTimeout(2600);
    await shot(page, vp.id, "13-epilogue", full);
    await ctx.close();
  });
}
