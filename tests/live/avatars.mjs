// Live screenshot of each character's avatar in the real game (consumes a few credits).
import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ permissions: ["microphone"], viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
async function live(name, file) {
  await p.getByRole("button", { name: `Parler à ${name}` }).click();
  await p.getByRole("button", { name: "Autoriser le micro et parler" }).click();
  await p.getByRole("status").filter({ hasText: /^En direct$/ }).waitFor({ timeout: 90000 });
  await p.getByRole("button", { name: "Micro ouvert" }).click();
  await p.waitForTimeout(6000);
  await p.screenshot({ path: file });
  console.log(name, "video", await p.evaluate(() => { const v = document.querySelector(".character__live video"); return v ? `${v.videoWidth}x${v.videoHeight}` : "none"; }));
  await p.getByRole("button", { name: "Raccrocher" }).click();
  await p.getByRole("button", { name: `Parler à ${name}` }).waitFor({ timeout: 20000 });
}
try {
  await p.goto("http://localhost:3000/");
  await p.getByRole("button", { name: "Commencer" }).click();
  await p.waitForURL(/\/play\/run_/);
  await live("Malik", "var/screens/avatar-malik.png");
  await p.getByRole("navigation", { name: "Époque" }).getByRole("button", { name: "1996" }).click();
  await p.getByRole("button", { name: "Parler à Jeanne" }).waitFor({ timeout: 30000 });
  await live("Jeanne", "var/screens/avatar-jeanne.png");
} catch (e) { console.log("ERROR", String(e.message).slice(0, 200)); await p.screenshot({ path: "var/screens/avatar-error.png" }); }
await b.close();
