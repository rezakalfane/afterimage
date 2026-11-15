import { defineConfig, devices } from "@playwright/test";

// E2E against a real Next.js PRODUCTION build (next build && next start) in REHEARSAL mode (no Napster calls) with its own database.
const PORT = 3197;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile|@screens/ },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, grep: /@mobile/ },
    // Screenshots for visual review and docs: npx playwright test --project=screens
    { name: "screens", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grep: /@screens/ },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      APP_ENV: "local",
      APP_URL: `http://localhost:${PORT}`,
      DATABASE_URL: "file:./var/e2e.db",
      CONVERSATION_MODE: "rehearsal",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
