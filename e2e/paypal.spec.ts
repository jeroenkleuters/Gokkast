import { expect, test, type Page } from "@playwright/test";
import { loginAs, TEST_ADMIN } from "./auth";
import { display, playButton } from "./helpers";
import { MOCK_PAYPAL_PAYER, MOCK_PAYPAL_QR, PAYPAL_APP_URL } from "./payments";

// Betalen met PayPal (taak 13b) op de derde server: PayPal is de standaard, nep-PayPal, winkans 1
// (elk spel is na één draai gewonnen en klaar), 4 spelletjes voor € 1,00.
test.use({ baseURL: PAYPAL_APP_URL });

const popup = (page: Page) => page.getByRole("dialog", { name: "Betalen" });
const credits = (page: Page) => page.getByTestId("credits");
const qr = (page: Page) => popup(page).getByRole("img", { name: "QR-code om te betalen" });
const payLink = (page: Page) => popup(page).getByRole("link", { name: "Of betaal op dit apparaat (nieuw tabblad)" });
const prizes = (page: Page) => page.getByRole("dialog", { name: "Gewonnen!" });

async function openGame(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("gokkast-geluid", "uit"); // stil testen
    } catch {}
  });
  await page.goto("/");
  await expect(display(page)).toHaveText("DRUK OP SPEEL!");
}

async function openPopup(page: Page) {
  await playButton(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(qr(page)).toBeVisible();
}

// Betalen in een nieuw tabblad bij de nep-PayPal (PayPal stuurt niet terug naar het spel)
async function payInNewTab(page: Page, button: "Betaald" | "Geannuleerd") {
  const [tab] = await Promise.all([page.context().waitForEvent("page"), payLink(page).click()]);
  await expect(tab.getByRole("heading", { name: /Factuur INV2-/ })).toBeVisible();
  await tab.getByRole("button", { name: button }).click();
  await expect(tab.getByText(button === "Betaald" ? "Status: PAID" : "Status: CANCELLED")).toBeVisible();
  await tab.close();
}

async function finishOneGame(page: Page) {
  while ((await playButton(page).textContent()) !== "NIEUW SPEL") {
    await playButton(page).click();
    await expect(playButton(page)).toBeDisabled();
    await expect(playButton(page)).toBeEnabled();
  }
}

test("met PayPal: QR-code van PayPal, betalen in een nieuw tabblad, de popup ziet de betaling", async ({ page }) => {
  await openGame(page);
  await openPopup(page);

  await expect(popup(page)).toContainText("4 spelletjes voor € 1,00");
  await expect(popup(page)).toContainText("betaal met PayPal");
  // De QR-code komt van PayPal (generate-qr-code), niet van onze eigen QR-maker
  expect(await qr(page).getAttribute("src")).toBe(`data:image/png;base64,${MOCK_PAYPAL_QR}`);
  await expect(payLink(page)).toHaveAttribute("href", /\/invoice\/p\/INV2-E2E0-0000-0000-\d{4}$/);
  await expect(payLink(page)).toHaveAttribute("target", "_blank");

  await payInNewTab(page, "Betaald");

  // De popup vraagt elke 3 seconden de status op en geeft dan de credits
  await expect(credits(page)).toHaveText("4", { timeout: 10_000 });
  await expect(popup(page)).toBeHidden();

  for (let game = 0; game < 4; game++) {
    await finishOneGame(page);
    if (game < 3) {
      await playButton(page).click(); // NIEUW SPEL
      await expect(playButton(page)).toHaveText("SPEEL");
    }
  }
  // Score-popup met de naam van de PayPal-betaler
  await expect(prizes(page)).toBeVisible();
  await expect(prizes(page)).toContainText(MOCK_PAYPAL_PAYER);
});

test("een afgebroken PayPal-betaling geeft geen credits en een melding", async ({ page }) => {
  await openGame(page);
  await openPopup(page);
  await payInNewTab(page, "Geannuleerd");

  await expect(popup(page).getByRole("alert")).toHaveText("De betaling is niet gelukt of afgebroken.", { timeout: 10_000 });
  await expect(credits(page)).toHaveText("0");

  // Opnieuw proberen maakt een nieuwe factuur
  await popup(page).getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(qr(page)).toBeVisible();
  await expect(payLink(page)).toHaveAttribute("href", /\/invoice\/p\/INV2-/);
});

test("game-manager: PayPal is de betaalmethode en betalingen tonen de methode", async ({ page, context }) => {
  // Eerst een betaalde PayPal-betaling
  await openGame(page);
  await openPopup(page);
  await payInNewTab(page, "Betaald");
  await expect(credits(page)).toHaveText("4", { timeout: 10_000 });

  await loginAs(context, TEST_ADMIN);
  await page.goto("/game-manager");

  await page.getByRole("tab", { name: "Instellingen" }).click();
  await expect(page.getByTestId("current-settings")).toContainText("Betalen met PayPal.");
  const select = page.getByLabel("Betaalmethode");
  await expect(select).toHaveValue("");
  await expect(select.locator("option")).toHaveText(["Standaard: PayPal", "Mollie (iDEAL)", "PayPal"]);

  await page.getByRole("tab", { name: "Betalingen" }).click();
  const table = page.getByRole("table", { name: "Betalingen" });
  await expect(table.getByRole("columnheader", { name: "Methode" })).toBeVisible();
  const row = table.getByRole("row").filter({ hasText: MOCK_PAYPAL_PAYER }).first();
  await expect(row).toContainText("PayPal");
  await expect(row).toContainText("Betaald");
  // Geen rekeningnummer bij PayPal
  await expect(row.getByRole("cell").nth(3)).toHaveText("—");
});
