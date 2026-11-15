// English: choose the language in Settings, then the game, its documents and the rehearsal
// characters are in English; switching back to French keeps the same game.
import { expect, test } from "@playwright/test";

test("settings → English; documents and characters in English; back to French keeps the game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Réglages" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Choosing a language reloads the page (the cookie is read by the server).
  await Promise.all([page.waitForEvent("load"), page.getByRole("dialog").getByLabel("English").click()]);
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/\/play\/run_/);
  await expect(page.locator(".character__subtitles")).toContainText("I can hear you");
  await page.getByRole("button", { name: /^Photograph$/ }).first().click();
  const answered = page.waitForResponse((r) => r.url().includes("/commands"));
  await page.getByRole("dialog").getByRole("button", { name: /Turn the photo over/ }).click();
  await answered;
  await expect(page.getByRole("dialog").getByText("The key is at our usual place. — J.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Find a way to open the crescent cabinet/)).toBeVisible();
  await page.getByRole("navigation", { name: "Era" }).getByRole("button", { name: "1996" }).click();
  await expect(page.locator(".character__subtitles")).toContainText("Can you hear me?");
  // Back to French: same game, French documents.
  await Promise.all([page.waitForEvent("load"), page.getByRole("navigation", { name: "Language" }).getByRole("button", { name: "FR" }).click()]);
  await expect(page.getByRole("button", { name: /Photographie du Régina/ })).toBeVisible();
});
