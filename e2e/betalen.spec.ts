import { expect, test, type Page } from "@playwright/test";
import { loginAs, TEST_ADMIN } from "./auth";
import { display, playButton } from "./helpers";
import { MOCK_CONSUMER_ACCOUNT, MOCK_CONSUMER_NAME, PAID_APP_URL } from "./payments";

// Betalen met Mollie (taak 10) op de tweede server: betalen aan, nep-Mollie, winkans 1
// (elk spel is na één draai gewonnen en klaar), 4 spelletjes voor € 1,00.
test.use({ baseURL: PAID_APP_URL });

const popup = (page: Page) => page.getByRole("dialog", { name: "Betalen" });
const credits = (page: Page) => page.getByTestId("credits");
const payLink = (page: Page) => popup(page).getByRole("link", { name: "Of betaal op dit apparaat" });
const prizes = (page: Page) => page.getByRole("dialog", { name: "Gewonnen!" });

// lose: elke draai verliest (zie e2e/helpers.ts), anders wint elke draai (winkans 1)
async function openGame(page: Page, lose = false) {
  await page.addInitScript((lose) => {
    try {
      localStorage.setItem("gokkast-geluid", "uit"); // stil testen
    } catch {}
    if (lose) {
      const random = Math.random;
      Math.random = () => 0.05 + random() * 0.9;
    }
  }, lose);
  await page.goto(lose ? "/?kans=100000" : "/");
  await expect(display(page)).toHaveText("DRUK OP SPEEL!");
}

// Popup openen met SPEEL en wachten tot de QR-code er staat
async function openPopup(page: Page) {
  await playButton(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(popup(page).getByRole("img", { name: "QR-code om te betalen" })).toBeVisible();
}

// Eén spel spelen tot het klaar is (winst: na één draai, verlies: na drie)
async function finishOneGame(page: Page) {
  while ((await playButton(page).textContent()) !== "NIEUW SPEL") {
    await playButton(page).click();
    await expect(playButton(page)).toBeDisabled();
    await expect(playButton(page)).toBeEnabled();
  }
}

// Eén spel spelen en klaarzetten voor het volgende
async function playOneGame(page: Page) {
  await finishOneGame(page);
  await playButton(page).click();
  await expect(playButton(page)).toHaveText("SPEEL");
}

// Betalen op dit apparaat bij de nep-Mollie; daarna terug in het spel met 4 credits
async function pay(page: Page, url = "/") {
  await openPopup(page);
  await payLink(page).click();
  await page.getByRole("button", { name: "Betaald" }).click();
  await expect(page).toHaveURL(`${PAID_APP_URL}/`);
  if (url !== "/") await page.goto(url);
  await expect(credits(page)).toHaveText("4");
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

test("betalen op dit apparaat: terug naar het spel met 4 credits, elk spel kost 1 credit, daarna de score-popup", async ({ page }) => {
  // Het rekeningnummer (taak 11) mag nooit in een antwoord van de app naar de browser staan
  const leaks: string[] = [];
  page.on("response", async (response) => {
    if (!response.url().startsWith(PAID_APP_URL)) return;
    const text = await response.text().catch(() => "");
    if (text.includes(MOCK_CONSUMER_ACCOUNT)) leaks.push(response.url());
  });
  await openGame(page);
  await openPopup(page);

  await payLink(page).click();
  await expect(page.getByRole("heading", { name: /Testbetaling tr_e2e/ })).toBeVisible();
  await page.getByRole("button", { name: "Betaald" }).click();

  // Mollie stuurt terug naar /betaald; zelfde browser en betaald → door naar het spel
  await expect(page).toHaveURL(`${PAID_APP_URL}/`);
  await expect(credits(page)).toHaveText("4");

  for (const left of ["3", "2", "1"]) {
    await playOneGame(page);
    await expect(credits(page)).toHaveText(left);
    await expect(prizes(page)).toBeHidden();
  }

  // Laatste spelletje: daarna de score-popup met de prijzen (winkans 1: alle vier gewonnen)
  await finishOneGame(page);
  await expect(credits(page)).toHaveText("0");
  await expect(prizes(page)).toBeVisible();
  await expect(prizes(page)).toContainText(MOCK_CONSUMER_NAME);
  expect(await page.content()).not.toContain(MOCK_CONSUMER_ACCOUNT);
  expect(leaks).toEqual([]);
  await expect(prizes(page)).toContainText("4 van de 4 spelletjes gewonnen");
  const counts = await prizes(page).locator("li").allTextContents();
  expect(counts.reduce((sum, text) => sum + Number(text.match(/^\d+/)![0]), 0)).toBe(4);
  for (const text of counts) expect(text).toMatch(/^\d+ (gratis shotjes?|kakkerlak(ken)? om te blingen|vrije keuzes?)$/);

  // Sluit niet met spatie, Enter, Escape of ernaast klikken, alleen met de knop
  for (const key of ["Space", "Enter", "Escape"]) await page.keyboard.press(key);
  await page.mouse.click(10, 10);
  await expect(prizes(page)).toBeVisible();
  await prizes(page).getByRole("button", { name: "Prijzen uitgedeeld" }).click();
  await expect(prizes(page)).toBeHidden();

  await playButton(page).click(); // NIEUW SPEL
  await expect(playButton(page)).toHaveText("SPEEL");

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

  // De telefoon ziet op /betaald dat het gelukt is en wat er betaald is
  await expect(phone).toHaveURL(/\/betaald\?ref=[\w-]{16}$/);
  await expect(phone.getByRole("heading", { name: "Betaald!" })).toBeVisible();
  await expect(phone.getByTestId("betaald")).toContainText("€ 1,00 is betaald voor 4 spelletjes");
  await expect(phone.getByRole("link", { name: "Terug naar het spel" })).toHaveCount(0); // terug naar de gokkast zelf
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
  await expect(phone.getByRole("heading", { name: "Betaling niet gelukt" })).toBeVisible();
  await phone.close();

  await expect(popup(page).getByRole("alert")).toHaveText("De betaling is niet gelukt of afgebroken.");
  await popup(page).getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(payLink(page)).toBeVisible();
  expect(await payLink(page).getAttribute("href")).not.toBe(first);
  await expect(credits(page)).toHaveText("0");
});

test("geen score-popup als er met een betaling niets gewonnen is", async ({ page }) => {
  test.slow(); // vier verloren spelletjes van drie draaien
  await openGame(page, true);
  await pay(page, "/?kans=100000");

  for (const left of ["3", "2", "1", "0"]) {
    await playOneGame(page);
    await expect(credits(page)).toHaveText(left);
  }
  await expect(display(page)).toHaveText("DRUK OP SPEEL!");
  await page.waitForTimeout(2000); // de popup zou na 1,5 s verschijnen
  await expect(prizes(page)).toBeHidden();
});

test("de game-manager toont de gespeelde ronde met de naam van de rekeninghouder", async ({ page, context }) => {
  await openGame(page);
  await pay(page);
  await playOneGame(page); // winkans 1: gewonnen
  await expect(credits(page)).toHaveText("3");

  // Andere tests op deze server spelen ook met deze naam: alleen controleren dat de ronde er staat
  await loginAs(context, TEST_ADMIN);
  await page.goto("/game-manager");
  await page.getByRole("tab", { name: "Speelrondes" }).click();
  const section = page.getByRole("region", { name: "Speelrondes en statistieken" });
  const perName = section.getByRole("table", { name: /Per naam/ });
  const rounds = section.getByRole("table", { name: /Speelrondes/ });

  await expect(perName.getByRole("columnheader")).toHaveText(["Naam", "Gespeeld", "Shot", "Kakkerlak", "Vraagteken", "Gewonnen", "Verloren"]);
  const row = perName.getByRole("row").filter({ has: page.getByRole("rowheader", { name: MOCK_CONSUMER_NAME }) });
  await expect(row).toHaveCount(1);
  expect(Number(await row.getByRole("cell").nth(4).textContent())).toBeGreaterThanOrEqual(1); // gewonnen
  await expect(rounds.getByRole("row").filter({ hasText: MOCK_CONSUMER_NAME }).first()).toContainText(/Gewonnen: (shot|kakkerlak|vraagteken)\s*1$/);

  // Vandaag: zelfde ronde, de keuze staat in de URL en de tab blijft gekozen
  await section.getByRole("link", { name: "Vandaag" }).click();
  await expect(page).toHaveURL(/\/game-manager\?periode=vandaag$/);
  await expect(section.getByRole("link", { name: "Vandaag" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tab", { name: "Speelrondes" })).toHaveAttribute("aria-selected", "true");
  await expect(perName.getByRole("rowheader", { name: MOCK_CONSUMER_NAME })).toBeVisible();

  // Filter op een deel van de naam, zonder op hoofdletters te letten
  await section.getByLabel("Naam bevat").fill("t. te");
  await section.getByRole("button", { name: "Filteren" }).click();
  await expect(page).toHaveURL(/\?periode=vandaag&naam=t\.\+te$/);
  await expect(perName.getByRole("rowheader")).toHaveText([MOCK_CONSUMER_NAME]);
  await section.getByLabel("Naam bevat").fill("niemand");
  await section.getByRole("button", { name: "Filteren" }).click();
  await expect(section).toContainText('Geen speelrondes met een naam die "niemand" bevat (vandaag).');
  await section.getByRole("link", { name: "Wissen" }).click();
  await expect(page).toHaveURL(/\?periode=vandaag$/);
  await expect(section.getByLabel("Naam bevat")).toHaveValue("");
  await expect(page.getByRole("tab", { name: "Speelrondes" })).toHaveAttribute("aria-selected", "true");
});

// MOCK_CONSUMER_ACCOUNT in groepjes van vier
const MOCK_ACCOUNT_SHOWN = MOCK_CONSUMER_ACCOUNT.replace(/(.{4})(?=.)/g, "$1 ");

test("de game-manager toont de betaling met het ontsleutelde rekeningnummer", async ({ page, context }) => {
  await openGame(page);
  await pay(page);
  await playOneGame(page);
  await expect(credits(page)).toHaveText("3");

  await loginAs(context, TEST_ADMIN);
  await page.goto("/game-manager");
  await page.getByRole("tab", { name: "Betalingen" }).click();
  const section = page.getByRole("region", { name: "Betalingen" });
  const table = section.getByRole("table", { name: "Betalingen" });

  await expect(table.getByRole("columnheader")).toHaveText(["Datum", "Naam", "Methode", "Rekeningnummer", "Bedrag", "Status", "Gespeeld"]);
  // Andere tests op deze server betalen ook met deze naam: een betaalde betaling van T. TEST zoeken
  const paid = table.getByRole("row").filter({ hasText: MOCK_CONSUMER_NAME }).filter({ hasText: "Betaald" }).first();
  await expect(paid.getByRole("cell")).toHaveText([/^\d\d-\d\d-\d{4}/, MOCK_CONSUMER_NAME, "Mollie (iDEAL)", MOCK_ACCOUNT_SHOWN, "€ 1,00", "Betaald", /^\d van 4$/]);
  // Ontsleuteld op de server: de versleutelde tekst en de betaallink staan niet op de pagina
  const html = await page.content();
  expect(html).not.toMatch(/v1:[A-Za-z0-9+/=]+:/);
  expect(html).not.toContain("/checkout/");

  // Sorteren: eerste klik A-Z, tweede klik Z-A; de tab blijft gekozen
  const nameHeader = table.getByRole("columnheader", { name: "Naam" });
  await nameHeader.getByRole("link").click();
  await expect(page).toHaveURL(/\?betalingen_sorteer=naam$/);
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await nameHeader.getByRole("link").click();
  await expect(page).toHaveURL(/\?betalingen_sorteer=-naam$/);
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect(page.getByRole("tab", { name: "Betalingen" })).toHaveAttribute("aria-selected", "true");

  // Filteren op naam houdt de sortering
  await section.getByLabel("Naam bevat").fill("test");
  await section.getByRole("button", { name: "Filteren" }).click();
  await expect(page).toHaveURL(/\?betalingen_sorteer=-naam&betalingen_naam=test$/);
  await expect(table.getByRole("row").filter({ hasText: MOCK_CONSUMER_NAME }).first()).toBeVisible();
  await expect(table.getByRole("row").filter({ hasNotText: MOCK_CONSUMER_NAME })).toHaveCount(1); // alleen de kop
  await section.getByLabel("Naam bevat").fill("niemand");
  await section.getByRole("button", { name: "Filteren" }).click();
  await expect(section).toContainText('Geen betalingen met een naam die "niemand" bevat.');
});

test("de betalingen gaan per 15 over pagina's", async ({ page, context, browser }) => {
  test.slow();
  // 16 spelers openen de betaalpopup: elk een eigen (open) betaling
  for (let i = 0; i < 16; i++) {
    const player = await browser.newContext({ baseURL: PAID_APP_URL });
    const playerPage = await player.newPage();
    await openGame(playerPage);
    await openPopup(playerPage);
    await player.close();
  }

  await loginAs(context, TEST_ADMIN);
  await page.goto("/game-manager");
  await page.getByRole("tab", { name: "Betalingen" }).click();
  const section = page.getByRole("region", { name: "Betalingen" });
  const table = section.getByRole("table", { name: "Betalingen" });
  const pages = section.getByRole("navigation", { name: "Pagina's betalingen" });

  await expect(table.getByRole("row")).toHaveCount(16); // kop + 15
  await expect(pages).toContainText(/Pagina 1 van \d+/);
  await pages.getByRole("link", { name: "Volgende" }).click();
  await expect(page).toHaveURL(/\?betalingen_pagina=2$/);
  await expect(pages).toContainText(/Pagina 2 van \d+/);
  await expect(page.getByRole("tab", { name: "Betalingen" })).toHaveAttribute("aria-selected", "true");
  await expect(pages.getByRole("link", { name: "Vorige" })).toBeVisible();
});

test("/betaald zonder of met een onbekende referentie geeft alleen een bedankje", async ({ page }) => {
  for (const url of ["/betaald", "/betaald?ref=onbekend", "/betaald?ref=AAAAAAAAAAAAAAAA"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Bedankt!" })).toBeVisible();
    await expect(page.getByTestId("betaald")).toHaveAttribute("data-status", "none");
  }
});

test("de webhook accepteert alleen een Mollie-ID", async ({ request }) => {
  const post = (form: Record<string, string>) => request.post("/api/mollie/webhook", { form });
  expect((await post({ id: "tr_onbekend" })).status()).toBe(200);
  expect((await post({ id: "geen-id" })).status()).toBe(400);
  expect((await post({})).status()).toBe(400);
});
