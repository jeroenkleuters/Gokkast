import { defineConfig, devices } from "@playwright/test";
import { TEST_ADMIN, TEST_AUTH_SECRET } from "./e2e/auth";

// Visuele tests (e2e/*.spec.ts) in een browser van 1024x768. Playwright bouwt en
// start de app zelf op een eigen poort, zodat een draaiende `npm run dev` niet stoort.
// De unit-tests (src/**/*.test.ts) draaien apart met Vitest.
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: { timeout: 10_000 }, // een draai met drie rollen duurt ruim 2 seconden
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1024, height: 768 },
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Testinstellingen alleen voor deze server; gaan vóór .env en .env.local
    env: {
      GAME_ODDS: "30",
      GAME_MAX_TRIES: "3",
      GAME_ALLOW_ODDS_URL: "true",
      // Zonder database, ook als .env.local er een heeft: dan gelden de waarden hierboven
      DATABASE_URL: "",
      // Game-manager (taak 8): nep-sleutels en geen echte Google-login. De tests maken zelf
      // een sessiecookie met AUTH_SECRET (zie e2e/auth.ts) voor de testbeheerder hieronder.
      // AUTH_TRUST_HOST omdat `next start` buiten Vercel de host anders niet vertrouwt.
      AUTH_SECRET: TEST_AUTH_SECRET,
      AUTH_TRUST_HOST: "true",
      AUTH_GOOGLE_ID: "test-google-id",
      AUTH_GOOGLE_SECRET: "test-google-secret",
      GAME_MANAGER_ADMINS: TEST_ADMIN,
    },
  },
});
