// Full chapter in a real browser, rehearsal mode: every step through visible UI controls.
import { expect, test, type Page } from "@playwright/test";

const PHRASE = `<script>alert("x")</script> Les étoiles restent allumées — Café 🌙`;

async function hotspot(page: Page, label: RegExp) {
  await page.getByRole("button", { name: label }).first().click();
}
/** Click an action in the open dialog and wait for the SERVER's answer to that command. */
async function inDialog(page: Page, button: RegExp) {
  const answered = page.waitForResponse((r) => r.url().includes("/commands") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: button }).click();
  const r = await answered;
  expect(r.status(), `server answer for ${button}`).toBeLessThan(500);
}
async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}
async function era(page: Page, year: "1996" | "2026") {
  await page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: year }).click();
  await expect(page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: year })).toHaveAttribute("aria-pressed", "true");
}

async function playToDecision(page: Page) {
  await page.goto("/");
  await expect(page.getByText(/Mode répétition/)).toBeVisible();
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
  await expect(page.getByText(/Mode répétition — aucun appel Napster/)).toBeVisible();
  await expect(page.getByText("Je vous reçois.", { exact: false }).first()).toBeVisible();

  // Énigme 1 — la clé d’un autre temps
  await hotspot(page, /Photographie sur le bureau/);
  await inDialog(page, /Retourner la photo/);
  await expect(page.getByRole("dialog").getByText(/G7/)).toBeVisible();
  await closeDialog(page);
  await hotspot(page, /Trace d’humidité/);
  await inDialog(page, /Lire le rapport/);
  await closeDialog(page);
  await era(page, "1996");
  // Early refusal: the cabinet is locked, nothing changes.
  await hotspot(page, /Armoire au croissant/);
  await expect(page.getByRole("dialog").getByText(/Il me manque la clé/)).toBeVisible();
  await closeDialog(page);
  await page.getByRole("button", { name: /Photographie du Régina/ }).click(); // notebook card
  await inDialog(page, /Transmettre cet indice à Jeanne/);
  await closeDialog(page);
  await hotspot(page, /La salle, par la vitre/);
  await inDialog(page, /aller chercher la clé/);
  await closeDialog(page);
  await hotspot(page, /Armoire au croissant/);
  await inDialog(page, /Ouvrir l’armoire/);
  await closeDialog(page);

  // Énigme 2 — la promesse et la trace
  await hotspot(page, /Programme de la séance/);
  await inDialog(page, /Lire le programme/);
  await closeDialog(page);
  await hotspot(page, /La lettre dans l’armoire/);
  await inDialog(page, /Lire la lettre/);
  await inDialog(page, /Je reconnais la condition d’Alice/);
  await closeDialog(page);
  await page.getByRole("button", { name: /Rapport de conservation/ }).click();
  await inDialog(page, /Avertir Jeanne du risque d’eau/);
  await closeDialog(page);
  // Wrong place is refused with a reason (no softlock).
  await page.getByRole("button", { name: "Vos mots" }).click();
  await page.getByLabel(/Écrivez ou dictez/).fill(PHRASE);
  const saved = page.waitForResponse((r) => r.url().includes("/commands"));
  await page.getByRole("button", { name: /Enregistrer ce brouillon/ }).click();
  await saved;
  await expect(page.locator(".paper__text")).toHaveText(PHRASE.normalize("NFC"));
  const confirmed = page.waitForResponse((r) => r.url().includes("/commands"));
  await page.getByRole("button", { name: /Je confirme ces mots exacts/ }).click();
  await confirmed;
  await expect(page.getByText(/Confirmé, mot pour mot/)).toBeVisible();
  await closeDialog(page);
  await hotspot(page, /Étagère haute de l’armoire/);
  await page.getByRole("dialog").getByLabel(/Sur le bureau/).check();
  await inDialog(page, /tout ranger ici/);
  await expect(page.getByText(/Pas sur le bureau/)).toBeVisible();
  await page.getByRole("dialog").getByLabel(/Étagère haute de l’armoire/).check();
  await inDialog(page, /tout ranger ici/);
  await closeDialog(page);

  // Énigme 3 — retrouver et décider
  await era(page, "2026");
  await hotspot(page, /Derrière le projecteur/);
  await inDialog(page, /Chercher derrière le projecteur/);
  await closeDialog(page);
  await hotspot(page, /Étagère haute de l’armoire/);
  await inDialog(page, /Déplier le papier/);
  await expect(page.getByRole("dialog").locator(".paper__text")).toHaveText(PHRASE.normalize("NFC")); // exact, as text
  await inDialog(page, /Lire la lettre de l’enveloppe/);
  await closeDialog(page);
  // The notebook keeps the recovered words, exact and rendered as text (no injected element).
  await page.getByRole("button", { name: /Votre message/ }).click();
  await expect(page.getByRole("dialog").locator(".paper__text")).toHaveText(PHRASE.normalize("NFC"));
  expect(await page.evaluate(() => [...document.scripts].some((s) => s.textContent?.includes('alert("x")')))).toBe(false);
  await closeDialog(page);
}

for (const [ending, label, closing] of [
  ["public_cut", /Projeter la version autorisée/, /La salle se rallume/],
  ["sealed_archive", /Confier le film aux archives/, /La séance attendra/],
  ["broken_promise", /Tout projeter malgré la lettre/, /Le film a été montré intégralement/],
] as const) {
  test(`chapter to ending ${ending}`, async ({ page }) => {
    page.on("dialog", () => { throw new Error("A JS dialog opened (XSS?)"); });
    await playToDecision(page);
    await page.getByRole("button", { name: "Décider du sort du film" }).click();
    await page.getByRole("dialog").getByRole("button", { name: label }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Je confirme|Je comprends/ }).click();
    await expect(page.getByRole("region", { name: "Épilogue" })).toBeVisible();
    await expect(page.getByText(closing)).toBeVisible();
    // Finished runs are read-only after reload.
    await page.reload();
    await expect(page.getByText(closing)).toBeVisible();
    await expect(page.getByRole("button", { name: "Aide" })).toHaveCount(0);
  });
}

test("resume after reload and network cut keeps a consistent state", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
  await hotspot(page, /Photographie sur le bureau/);
  await inDialog(page, /Retourner la photo/);
  await closeDialog(page);
  await context.setOffline(true);
  await hotspot(page, /Trace d’humidité/);
  await page.getByRole("dialog").getByRole("button", { name: /Lire le rapport/ }).click();
  await expect(page.getByText(/Connexion au serveur impossible|Failed to fetch/)).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("button", { name: /Photographie du Régina/ })).toBeVisible(); // persisted
  await expect(page.getByRole("button", { name: /Rapport de conservation/ })).toHaveCount(0); // offline action never committed
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Reprendre" })).toBeVisible();
});

test("hints are progressive and requested by the player", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
  await page.getByRole("button", { name: "Aide" }).click();
  await expect(page.getByText(/Certains objets racontent deux histoires/)).toBeVisible();
  await page.getByRole("button", { name: "Aide" }).click();
  await expect(page.getByText(/Retournez la photo en 2026/)).toBeVisible();
});

test("mobile layout is usable @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
  await expect(page.getByRole("list", { name: "Éléments à examiner" })).toBeVisible();
  await page.getByRole("list", { name: "Éléments à examiner" }).getByRole("button", { name: /Photographie/ }).click();
  await inDialog(page, /Retourner la photo/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
