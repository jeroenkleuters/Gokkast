import { defineConfig, devices } from "@playwright/test";
import { TEST_ADMIN, TEST_AUTH_SECRET } from "./e2e/auth";
import {
  MOCK_API_KEY,
  MOCK_ENCRYPTION_KEY,
  MOCK_PAYPAL_CLIENT_ID,
  MOCK_PAYPAL_CLIENT_SECRET,
  MOLLIE_MOCK_PORT,
  PAID_APP_PORT,
  PAYPAL_APP_PORT,
  PAYPAL_MOCK_PORT,
} from "./e2e/payments";

// Visuele tests (e2e/*.spec.ts) in een browser van 1024x768. Playwright bouwt en
// start de app zelf op een eigen poort, zodat een draaiende `npm run dev` niet stoort.
// De unit-tests (src/**/*.test.ts) draaien apart met Vitest.
// Betalen (taak 10): een nep-Mollie en een tweede server van dezelfde build met betalen aan
// (e2e/betalen.spec.ts); op de eerste server staat betalen uit en is het spel gratis.
// PayPal (taak 13b): een nep-PayPal en een derde server die met PayPal betaalt (e2e/paypal.spec.ts).
const PORT = 3100;

// Testinstellingen gelden alleen voor deze servers; ze gaan vóór .env en .env.local
const testEnv = {
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
  // Betalen uit, ook als .env.local Mollie- of PayPal-sleutels heeft
  MOLLIE_API_KEY: "",
  PAYPAL_CLIENT_ID: "",
  PAYPAL_CLIENT_SECRET: "",
  PAYPAL_WEBHOOK_ID: "",
  PAYPAL_ENV: "",
  GAME_PAYMENT_PROVIDER: "",
};

// Betalen aan (tweede en derde server): nep-Mollie, betalingen in het geheugen, winkans 1
const paidEnv = {
  ...testEnv,
  GAME_ODDS: "1", // elke draai wint: een spel is na één draai klaar
  GAME_ROUNDS_PER_PAYMENT: "4",
  GAME_PRICE_CENTS: "150", // geen standaardprijs: zo is te zien dat de ingestelde prijs overal doorkomt
  MOLLIE_API_KEY: MOCK_API_KEY,
  MOLLIE_API_URL: `http://localhost:${MOLLIE_MOCK_PORT}/v2`,
  PAYMENTS_TEST_STORE: "true", // betalingen in het geheugen (er is geen database)
  PAYMENT_ENCRYPTION_KEY: MOCK_ENCRYPTION_KEY, // rekeningnummer versleuteld (taak 11)
};

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
  webServer: [
    {
      command: `npm run build && npm run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: testEnv,
    },
    {
      command: "npx tsx e2e/mollie-mock.ts",
      url: `http://localhost:${MOLLIE_MOCK_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Start pas na de build hierboven (Playwright start de servers na elkaar)
      command: `npm run start -- -p ${PAID_APP_PORT}`,
      url: `http://localhost:${PAID_APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: paidEnv,
    },
    {
      command: "npx tsx e2e/paypal-mock.ts",
      url: `http://localhost:${PAYPAL_MOCK_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Zelfde build; Mollie en PayPal allebei ingesteld, PayPal is de standaard (er is geen
      // database om de keuze van de game-manager in op te slaan)
      command: `npm run start -- -p ${PAYPAL_APP_PORT}`,
      url: `http://localhost:${PAYPAL_APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: {
        ...paidEnv,
        GAME_PAYMENT_PROVIDER: "paypal",
        PAYPAL_CLIENT_ID: MOCK_PAYPAL_CLIENT_ID,
        PAYPAL_CLIENT_SECRET: MOCK_PAYPAL_CLIENT_SECRET,
        PAYPAL_API_URL: `http://localhost:${PAYPAL_MOCK_PORT}`,
      },
    },
  ],
});
