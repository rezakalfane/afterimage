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
/** Open a document whose reading runs on opening, and wait for the SERVER's answer. */
export async function openReading(page: Page, label: RegExp) {
  const answered = page.waitForResponse((r) => r.url().includes("/commands") && r.request().method() === "POST");
  await hotspot(page, label);
  const r = await answered;
  expect(r.status(), `server answer for ${label}`).toBeLessThan(500);
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

  // Énigme 1 — la clé d’un autre temps (v3 : photo + souvenir de Jeanne + programme)
  await hotspot(page, /^Photographie$/);
  await inDialog(page, /Retourner la photo/);
  await expect(page.getByRole("dialog").getByText(/notre place habituelle/)).toBeVisible();
  await closeDialog(page);
  await openReading(page, /^Bas de l’armoire$/);
  await closeDialog(page);
  await era(page, "1996");
  // Early refusal: the cabinet is locked, nothing changes.
  await hotspot(page, /^Armoire$/);
  await expect(page.getByRole("dialog").getByText(/Il me manque la clé/)).toBeVisible();
  await closeDialog(page);
  await page.getByRole("button", { name: /Photographie du Régina/ }).click(); // notebook card
  await inDialog(page, /En parler à Jeanne/);
  await inDialog(page, /leur place habituelle/);
  await closeDialog(page);
  await expect(page.getByRole("button", { name: /Souvenir de Jeanne/ })).toBeVisible();
  await openReading(page, /^Programme$/);
  await expect(page.getByRole("dialog").getByText(/Alice — place 7/)).toBeVisible();
  await closeDialog(page);
  await hotspot(page, /^Salle$/);
  await page.getByLabel(/Quel siège proposer/).fill("G5");
  await inDialog(page, /Proposer ce siège/);
  await expect(page.getByText(/Ce n’est pas la place d’Alice/)).toBeVisible(); // wrong seat: a reason, no change
  await page.getByLabel(/Quel siège proposer/).fill("G sept");
  await inDialog(page, /Proposer ce siège/);
  await inDialog(page, /aller chercher la clé/);
  await closeDialog(page);
  await hotspot(page, /^Armoire$/);
  await inDialog(page, /Ouvrir l’armoire/);
  await closeDialog(page);

  // Énigme 2 — la promesse et la trace
  await openReading(page, /^Lettre$/);
  await inDialog(page, /Je reconnais la condition d’Alice/);
  await closeDialog(page);
  await page.getByRole("button", { name: /Rapport de conservation/ }).click();
  await inDialog(page, /Avertir Jeanne du risque d’eau/);
  await closeDialog(page);
  // Wrong place is refused with a reason (no softlock).
  await page.getByRole("button", { name: "Vos mots" }).click();
  await page.getByLabel(/Écrivez ou dictez/).fill(PHRASE);
  const saved = page.waitForResponse((r) => r.url().includes("/commands"));
  await page.getByRole("button", { name: /Relire mon message/ }).click();
  await saved;
  await expect(page.locator(".paper__text")).toHaveText(PHRASE.normalize("NFC"));
  const confirmed = page.waitForResponse((r) => r.url().includes("/commands"));
  await page.getByRole("button", { name: /Confier ces mots à Jeanne/ }).click();
  await confirmed;
  await expect(page.getByText(/Jeanne a gardé vos mots/)).toBeVisible();
  await closeDialog(page);
  await hotspot(page, /^Étagère$/);
  await page.getByRole("dialog").getByLabel(/Dans le tiroir du bureau/).check();
  await inDialog(page, /tout ranger ici/);
  await expect(page.getByText(/à l’abri des regards, pas de l’eau/)).toBeVisible(); // a reason, no answer
  await page.getByRole("dialog").getByLabel(/En haut de l’armoire/).check();
  await inDialog(page, /tout ranger ici/);
  await closeDialog(page);

  // Énigme 3 — retrouver et décider
  await era(page, "2026");
  // The cabinet stays locked until the key is found behind the projector.
  await hotspot(page, /^Armoire$/);
  await expect(page.getByRole("dialog").getByText(/Il faudrait d’abord trouver la clé/)).toBeVisible();
  await closeDialog(page);
  await hotspot(page, /^Projecteur$/);
  await inDialog(page, /Chercher ce que Jeanne a pu laisser/);
  await closeDialog(page);
  await expect(page.getByRole("button", { name: /Clé au croissant/ })).toBeVisible();
  await hotspot(page, /^Armoire$/);
  await inDialog(page, /Ouvrir l’armoire/);
  // The window then shows what is inside, and stays open (no auto-close after opening).
  await page.waitForTimeout(3000);
  await expect(page.getByRole("dialog").getByRole("button", { name: /Déplier le papier/ })).toBeVisible();
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

