// Full chapter in a real browser, rehearsal mode: every step through visible UI controls.
import { expect, test } from "@playwright/test";

import { closeDialog, hotspot, inDialog, PHRASE, playToDecision } from "./helpers";

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
