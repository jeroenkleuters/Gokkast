import { expect, test } from "@playwright/test";
import { loginAs, TEST_ADMIN } from "./auth";

// Zonder echte Google-login: de testserver heeft nep-sleutels (zie playwright.config.ts).
// We controleren dat de game-manager dicht zit en dat inloggen naar Google gaat; voor de
// ingelogde tests zet e2e/auth.ts zelf een sessiecookie (Google wordt dan niet gebruikt).

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

test.describe("ingelogd", () => {
  test("een ingelogde niet-beheerder krijgt geen toegang", async ({ page, context }) => {
    await loginAs(context, "iemand@example.test");
    await page.goto("/game-manager");

    await expect(page.getByRole("alert").filter({ hasText: "Geen toegang" })).toContainText("iemand@example.test");
    await expect(page.getByRole("heading", { name: "Moeilijkheidsgraad" })).toHaveCount(0);
  });

  test("de beheerder ziet de moeilijkheidsgraad met de .env-waarden", async ({ page, context }) => {
    await loginAs(context, TEST_ADMIN);
    await page.goto("/game-manager");

    await expect(page.getByText(`Ingelogd als Test Beheerder (${TEST_ADMIN})`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Moeilijkheidsgraad" })).toBeVisible();
    await expect(page.getByTestId("current-settings")).toContainText("winkans 1 op 30, 3 pogingen");
    await expect(page.getByTestId("current-settings")).toContainText("bron: .env");
    // De testserver heeft geen database
    const difficulty = page.getByRole("region", { name: "Moeilijkheidsgraad" });
    await expect(difficulty.getByRole("alert").filter({ hasText: "geen database" })).toBeVisible();
    await expect(page.getByLabel("Winkans", { exact: true })).toHaveAttribute("placeholder", "standaard: 30");
  });

  test("niveaus vullen de winkans in en 'terug naar standaard' maakt het veld leeg", async ({ page, context }) => {
    await loginAs(context, TEST_ADMIN);
    await page.goto("/game-manager");
    const odds = page.getByLabel("Winkans", { exact: true });

    await page.getByRole("button", { name: "Moeilijk (1 op 100)" }).click();
    await expect(odds).toHaveValue("100");
    await expect(page.getByRole("button", { name: "Moeilijk (1 op 100)" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Makkelijk (1 op 10)" }).click();
    await expect(odds).toHaveValue("10");

    await page.getByRole("button", { name: "Winkans: terug naar standaard" }).click();
    await expect(odds).toHaveValue("");
  });

  test("de server controleert de invoer en meldt dat er zonder database niets wordt opgeslagen", async ({
    page,
    context,
  }) => {
    await loginAs(context, TEST_ADMIN);
    await page.goto("/game-manager");
    const tries = page.getByLabel("Pogingen per spel", { exact: true });

    // Browsercontrole uit, zodat de controle op de server getest wordt
    await page.locator("form").filter({ has: tries }).evaluate((form) => form.setAttribute("novalidate", ""));
    await tries.fill("9");
    await page.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.getByRole("status")).toHaveText("Niet opgeslagen: controleer de invoer.");
    await expect(page.getByText("Vul een geheel getal van 1 t/m 5 in")).toBeVisible();
    await expect(tries).toHaveAttribute("aria-invalid", "true");

    await tries.fill("4");
    await page.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.getByRole("status")).toHaveText("Niet opgeslagen: er is geen database ingesteld.");
  });

  test("speelrondes en statistieken: zonder database een melding in plaats van een overzicht", async ({ page, context }) => {
    await loginAs(context, TEST_ADMIN);
    await page.goto("/game-manager?periode=vandaag&pagina=abc");

    const section = page.getByRole("region", { name: "Speelrondes en statistieken" });
    await expect(section.getByRole("alert")).toContainText("geen database");
    await expect(section.getByRole("table")).toHaveCount(0);
    // Taak 13 heeft de plek-tekst vervangen
    await expect(page.getByText("komt hier (taak 13)")).toHaveCount(0);
  });
});
