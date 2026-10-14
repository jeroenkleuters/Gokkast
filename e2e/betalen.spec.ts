import { expect, test, type Page } from "@playwright/test";
import { display, playButton } from "./helpers";
import { PAID_APP_URL } from "./payments";

// Betalen met Mollie (taak 10) op de tweede server: betalen aan, nep-Mollie, winkans 1
// (elk spel is na één draai gewonnen en klaar), 4 spelletjes voor € 1,00.
test.use({ baseURL: PAID_APP_URL });

const popup = (page: Page) => page.getByRole("dialog", { name: "Betalen" });
const credits = (page: Page) => page.getByTestId("credits");
const payLink = (page: Page) => popup(page).getByRole("link", { name: "Of betaal op dit apparaat" });

async function openGame(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("gokkast-geluid", "uit"); // stil testen
    } catch {}
  });
  await page.goto("/");
  await expect(display(page)).toHaveText("DRUK OP SPEEL!");
}

// Popup openen met SPEEL en wachten tot de QR-code er staat
async function openPopup(page: Page) {
  await playButton(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(popup(page).getByRole("img", { name: "QR-code om te betalen" })).toBeVisible();
}

// Eén spel spelen (winkans 1: na één draai klaar) en klaarzetten voor het volgende
async function playOneGame(page: Page) {
  await playButton(page).click();
  await expect(playButton(page)).toHaveText("NIEUW SPEL");
  await playButton(page).click();
  await expect(playButton(page)).toHaveText("SPEEL");
}

test("zonder credits opent SPEEL de betaalpopup met QR-code", async ({ page }) => {
  await openGame(page);
  await expect(credits(page)).toHaveText("0");

  await openPopup(page);
  await expect(popup(page)).toContainText("4 spelletjes voor € 1,00");
  await expect(popup(page)).toContainText("Testomgeving");
  const qr = popup(page).getByRole("img", { name: "QR-code om te betalen" });
  expect(await qr.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  await expect(payLink(page)).toHaveAttribute("href", /\/checkout\/tr_e2e\d+$/);

  // De rollen draaien niet zonder betaling
  await expect(display(page)).toHaveText("DRUK OP SPEEL!");

  // Sluiten en opnieuw openen: dezelfde betaling (geen nieuwe bij Mollie)
  const href = await payLink(page).getAttribute("href");
  await popup(page).getByRole("button", { name: "Sluiten" }).click();
  await expect(popup(page)).toBeHidden();
  await openPopup(page);
  await expect(payLink(page)).toHaveAttribute("href", href!);
});

test("betalen op dit apparaat: terug naar het spel met 4 credits, elk spel kost 1 credit", async ({ page }) => {
  await openGame(page);
  await openPopup(page);

  await payLink(page).click();
  await expect(page.getByRole("heading", { name: /Testbetaling tr_e2e/ })).toBeVisible();
  await page.getByRole("button", { name: "Betaald" }).click();

  // Mollie stuurt terug naar /betaald; zelfde browser en betaald → door naar het spel
  await expect(page).toHaveURL(`${PAID_APP_URL}/`);
  await expect(credits(page)).toHaveText("4");

  for (const left of ["3", "2", "1", "0"]) {
    await playOneGame(page);
    await expect(credits(page)).toHaveText(left);
  }

  // Op: SPEEL opent weer de popup, met een nieuwe betaling
  await openPopup(page);
  await expect(display(page)).toHaveText("DRUK OP SPEEL!");
});

test("betalen met een telefoon via de QR-code: de popup ziet de betaling zelf", async ({ page, browser }) => {
  await openGame(page);
  await openPopup(page);
  const checkoutUrl = (await payLink(page).getAttribute("href"))!;

  // De telefoon is een andere browser zonder de cookie van het spel
  const phone = await browser.newPage();
  await phone.goto(checkoutUrl);
  await phone.getByRole("button", { name: "Betaald" }).click();
  await expect(phone.getByRole("heading", { name: "Bedankt!" })).toBeVisible();
  await phone.close();

  // De popup vraagt elke paar seconden de status op en sluit na betalen
  await expect(popup(page)).toBeHidden();
  await expect(credits(page)).toHaveText("4");
  await playOneGame(page);
  await expect(credits(page)).toHaveText("3");
});

test("een afgebroken betaling geeft een melding; opnieuw proberen maakt een nieuwe betaling", async ({ page, browser }) => {
  await openGame(page);
  await openPopup(page);
  const first = (await payLink(page).getAttribute("href"))!;

  const phone = await browser.newPage();
  await phone.goto(first);
  await phone.getByRole("button", { name: "Geannuleerd" }).click();
  await phone.close();

  await expect(popup(page).getByRole("alert")).toHaveText("De betaling is niet gelukt of afgebroken.");
  await popup(page).getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(payLink(page)).toBeVisible();
  expect(await payLink(page).getAttribute("href")).not.toBe(first);
  await expect(credits(page)).toHaveText("0");
});

test("de webhook accepteert alleen een Mollie-ID", async ({ request }) => {
  const post = (form: Record<string, string>) => request.post("/api/mollie/webhook", { form });
  expect((await post({ id: "tr_onbekend" })).status()).toBe(200);
  expect((await post({ id: "geen-id" })).status()).toBe(400);
  expect((await post({})).status()).toBe(400);
});
