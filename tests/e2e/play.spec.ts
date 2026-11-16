// Full chapter in a real browser, rehearsal mode: every step through visible UI controls.
import { expect, test } from "@playwright/test";

import { closeDialog, era, hotspot, inDialog, playToDecision } from "./helpers";

for (const [ending, label, closing] of [
  ["public_cut", /Projeter la version autorisée/, /La salle se rallume/],
  ["sealed_archive", /Confier le film aux archives/, /La séance attendra/],
  ["broken_promise", /Tout projeter malgré la lettre/, /Le film a été montré intégralement/],
] as const) {
  test(`chapter to ending ${ending}`, async ({ page }) => {
    page.on("dialog", () => { throw new Error("A JS dialog opened (XSS?)"); });
    await playToDecision(page);
    // The decision belongs to 2026: no button in 1996.
    await era(page, "1996");
    await expect(page.getByRole("button", { name: "Décider du sort du film" })).toHaveCount(0);
    await era(page, "2026");
    await page.getByRole("button", { name: "Décider du sort du film" }).click();
    await page.getByRole("dialog").getByRole("button", { name: label }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Je confirme|Je comprends/ }).click();
    await expect(page.getByRole("main", { name: "Épilogue" })).toBeVisible();
    await expect(page.getByText(closing)).toBeVisible();
    // A standalone epilogue: the booth is no longer rendered behind it.
    await expect(page.locator(".scene")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rejouer le chapitre" })).toBeVisible();
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
  await hotspot(page, /^Photographie$/);
  await inDialog(page, /Retourner la photo/);
  await closeDialog(page);
  await context.setOffline(true);
  await hotspot(page, /^Bas de l’armoire$/); // opening the report reads it: fails offline
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
  await expect(page.getByText(/Regardez le verso de la photo, en 2026/)).toBeVisible();
  // After progress, the next hint concerns the new step and starts gently again.
  await page.getByRole("button", { name: /^Photographie$/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Retourner la photo/ }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Aide" }).click();
  await expect(page.getByText(/Cette note parle d’une place qu’on partageait/)).toBeVisible();
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
  // Clipped content does not scroll: also check the top-bar controls are fully on screen.
  await page.keyboard.press("Escape");
  for (const nav of ["Époque", "Langue"]) {
    const box = await page.getByRole("navigation", { name: nav }).boundingBox();
    expect(box && box.x + box.width, `${nav} switch inside the viewport`).toBeLessThanOrEqual(390);
  }
});

test("after an era switch the panel shows only the new character's lines", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
  await expect(page.locator(".character__subtitles")).toContainText("Je vous reçois");
  await page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: "1996" }).click();
  await expect(page.locator(".character__subtitles")).toContainText("Vous m’entendez");
  await expect(page.locator(".character__subtitles")).not.toContainText("Je vous reçois");
  await page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: "2026" }).click();
  await expect(page.locator(".character__subtitles")).not.toContainText("Vous m’entendez");
});
