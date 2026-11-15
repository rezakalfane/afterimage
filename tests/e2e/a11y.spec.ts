// Accessibility (kit §8/§20): keyboard-only play, automated WCAG scan, small viewport, 200% zoom.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function startRun(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
}

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of serious) console.log(`[axe ${label}] ${v.id}: ${v.help} (${v.nodes.length})`);
  expect(serious.map((v) => v.id), `serious axe violations on ${label}`).toEqual([]);
}

test("no serious WCAG violation on home, game and an open dialog", async ({ page }) => {
  await page.goto("/");
  await axe(page, "home");
  await startRun(page);
  await axe(page, "game 2026");
  await page.getByRole("button", { name: /^Photographie$/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await axe(page, "inspector dialog");
});

test("keyboard only: start, inspect the photo, read the note, close with Escape, switch era", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/play\/run_/);
  // Tab until the photo hotspot is focused (focus must be visible).
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    if (/^Photographie$/.test(name)) break;
  }
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toMatch(/^Photographie$/);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const name = await page.evaluate(() => document.activeElement?.textContent ?? "");
    if (/Retourner la photo/.test(name)) break;
    await page.keyboard.press("Tab");
  }
  const answered = page.waitForResponse((r) => r.url().includes("/commands"));
  await page.keyboard.press("Enter");
  await answered;
  await expect(page.getByRole("dialog").getByText(/notre place habituelle/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: "1996" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: "1996" })).toHaveAttribute("aria-pressed", "true");
});

test("1280×720: scene, character and notebook fit without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await startRun(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("region", { name: /Décor interactif/ })).toBeVisible();
  await expect(page.getByRole("complementary", { name: /Malik/ })).toBeVisible();
});

test("200% zoom keeps the game usable (no horizontal scroll, hotspot list available)", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 }); // 1440×900 at 200%
  await startRun(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("list", { name: "Éléments à examiner" })).toBeVisible();
});
