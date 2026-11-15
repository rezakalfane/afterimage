// Visual review captures (not assertions): npx playwright test --project=screens → var/screens/*.png
import { test, devices } from "@playwright/test";
import { closeDialog, era, hotspot, inDialog, playToDecision } from "./helpers";

const shot = (name: string) => ({ path: `var/screens/${name}.png` });

test("capture key screens @screens", async ({ page, browser }) => {
  await page.goto("/");
  await page.screenshot(shot("01-home"));
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/play\/run_/);
  await page.waitForTimeout(600);
  await page.screenshot(shot("02-2026-start"));
  await hotspot(page, /^Photographie$/);
  await inDialog(page, /Retourner la photo/);
  await page.screenshot(shot("03-photo-verso"));
  await closeDialog(page);
  await era(page, "1996");
  await page.waitForTimeout(600);
  await page.screenshot(shot("04-1996"));
  await page.goto("/");
  await playToDecision(page);
  await page.screenshot(shot("05-2026-open-cache"));
  await page.getByRole("button", { name: "Décider du sort du film" }).click();
  await page.screenshot(shot("06-ending-choice"));
  await page.getByRole("dialog").getByRole("button", { name: /Projeter la version autorisée/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Je confirme/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot(shot("07-epilogue"));
  const m = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
  const mp = await m.newPage();
  await mp.goto("/");
  await mp.screenshot(shot("08-mobile-home"));
  await mp.getByRole("button", { name: "Commencer" }).click();
  await mp.waitForURL(/\/play\/run_/);
  await mp.waitForTimeout(600);
  await mp.screenshot({ ...shot("09-mobile-play"), fullPage: true });
  await m.close();
});
