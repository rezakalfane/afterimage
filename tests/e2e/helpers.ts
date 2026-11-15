// Shared steps for the end-to-end tests (real UI controls only).
import { expect, type Page } from "@playwright/test";

export const PHRASE = `<script>alert("x")</script> Les étoiles restent allumées — Café 🌙`;

export async function hotspot(page: Page, label: RegExp) {
  await page.getByRole("button", { name: label }).first().click();
}
/** Click an action in the open dialog and wait for the SERVER's answer to that command. */
export async function inDialog(page: Page, button: RegExp) {
  const answered = page.waitForResponse((r) => r.url().includes("/commands") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: button }).click();
  const r = await answered;
  expect(r.status(), `server answer for ${button}`).toBeLessThan(500);
}
export async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}
export async function era(page: Page, year: "1996" | "2026") {
  await page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: year }).click();
  await expect(page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: year })).toHaveAttribute("aria-pressed", "true");
}

export async function playToDecision(page: Page) {
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
  // The cabinet stays locked until the key is found behind the projector.
  await hotspot(page, /Armoire au croissant/);
  await expect(page.getByRole("dialog").getByText(/Il faudrait d’abord trouver la clé/)).toBeVisible();
  await closeDialog(page);
  await hotspot(page, /Derrière le projecteur/);
  await inDialog(page, /Chercher derrière le projecteur/);
  await closeDialog(page);
  await expect(page.getByRole("button", { name: /Clé au croissant/ })).toBeVisible();
  await hotspot(page, /Armoire au croissant/);
  await inDialog(page, /Ouvrir l’armoire/);
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

