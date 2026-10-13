import { expect, test } from "@playwright/test";

// Zonder echte Google-login: de testserver heeft nep-sleutels (zie playwright.config.ts).
// We controleren dat de game-manager dicht zit en dat inloggen naar Google gaat.

test("zonder inloggen stuurt /game-manager door naar de inlogpagina", async ({ page }) => {
  await page.goto("/game-manager");

  await expect(page).toHaveURL(/\/game-manager\/inloggen$/);
  await expect(page.getByRole("heading", { name: "Inloggen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inloggen met Google" })).toBeVisible();
  await expect(page.getByText("Moeilijkheidsgraad")).toHaveCount(0);
});

test("een vervalste sessiecookie geeft geen toegang", async ({ page, context }) => {
  await context.addCookies([
    { name: "authjs.session-token", value: "vervalst", domain: "localhost", path: "/" },
  ]);
  await page.goto("/game-manager");

  await expect(page).toHaveURL(/\/game-manager\/inloggen$/);
});

test("inloggen met Google stuurt door naar Google met de juiste terugkeer-URL", async ({ page }) => {
  // Niet echt naar Google: het verzoek onderscheppen en de URL bekijken
  let googleUrl: URL | undefined;
  await page.route("https://accounts.google.com/**", (route) => {
    googleUrl = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "google" });
  });

  await page.goto("/game-manager/inloggen");
  await page.getByRole("button", { name: "Inloggen met Google" }).click();

  await expect.poll(() => googleUrl?.pathname).toContain("/o/oauth2/");
  expect(googleUrl!.searchParams.get("client_id")).toBe("test-google-id");
  expect(googleUrl!.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/callback\/google$/);
});

test("een niet-beheerder krijgt een duidelijke melding", async ({ page }) => {
  await page.goto("/game-manager/inloggen?error=AccessDenied");

  await expect(page.getByRole("alert").filter({ hasText: "Geen toegang" })).toBeVisible();
});

test("het spel blijft zonder inloggen speelbaar", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#display")).toHaveText("DRUK OP SPEEL!");
  await expect(page.locator("#playbtn")).toBeEnabled();
});
