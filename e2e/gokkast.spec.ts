import { expect, test } from "@playwright/test";
import {
  display,
  holdButtons,
  lever,
  litLamps,
  openGame,
  playButton,
  reels,
  spin,
  symbols,
} from "./helpers";

test("het spel laadt op 1024x768", async ({ page }) => {
  await openGame(page, "lose");

  await expect(page.locator("#cabinet")).toBeVisible();
  await expect(reels(page)).toHaveCount(3);
  for (const reel of await reels(page).all()) await expect(reel).toBeVisible();
  await expect(lever(page)).toBeVisible();
  await expect(display(page)).toBeVisible();
  await expect(playButton(page)).toHaveText("SPEEL");
  await expect(litLamps(page)).toHaveCount(3);

  // Het speelveld past precies in het venster
  const box = await page.locator("#game").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1024.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(768.5);

  // Begin met drie verschillende plaatjes
  expect(new Set(await symbols(page)).size).toBe(3);
});

test("draaien met de hendel verbruikt een poging en draait de rollen", async ({ page }) => {
  await openGame(page, "lose");

  await lever(page).click();
  await expect(display(page)).toHaveText("ROLLEN DRAAIEN...");
  await expect(litLamps(page)).toHaveCount(2);
  // Tijdens het draaien ligt er een lange strook plaatjes in elke rol
  for (const reel of await reels(page).all()) {
    expect(await reel.locator(".cell").count()).toBeGreaterThan(3);
  }

  await expect(playButton(page)).toBeEnabled();
  await expect(display(page)).toHaveText("NOG 2 POGINGEN — ZET ROLLEN VAST!");
  for (const reel of await reels(page).all()) await expect(reel.locator(".cell")).toHaveCount(3);
  await expect(page.locator("#stats")).toContainText("Gespeeld: 0");
});

test("rollen vastzetten met VAST, maximaal 2", async ({ page }) => {
  await openGame(page, "lose");
  const [vast1, vast2, vast3] = await holdButtons(page).all();

  // Voor de eerste draai kan er niets vast
  for (const btn of [vast1, vast2, vast3]) await expect(btn).toBeDisabled();

  await spin(page);
  for (const btn of [vast1, vast2, vast3]) await expect(btn).toBeEnabled();

  await vast1.click();
  await expect(vast1).toHaveClass(/\bon\b/);
  await expect(reels(page).nth(0)).toHaveClass(/\bheld\b/);

  await vast2.click();
  await expect(vast2).toHaveClass(/\bon\b/);
  await expect(vast3).toBeDisabled(); // maximaal 2 rollen vast

  // Een vastgezette rol los kan wel, en dan mag de derde weer
  await vast2.click();
  await expect(vast2).not.toHaveClass(/\bon\b/);
  await expect(vast3).toBeEnabled();

  // Rol 1 blijft staan bij de volgende draai
  const before = await symbols(page);
  await spin(page);
  expect((await symbols(page))[0]).toBe(before[0]);
  await expect(vast1).toHaveClass(/\bon\b/);
});

test("winstmelding bij een gewonnen draai", async ({ page }) => {
  await openGame(page, "win");
  expect(new Set(await symbols(page)).size).toBe(3);

  await spin(page, "lever");

  await expect(display(page)).toHaveText("★ JACKPOT! JE HEBT GEWONNEN! ★");
  await expect(display(page)).toHaveClass(/\bwin\b/);
  expect(new Set(await symbols(page)).size).toBe(1); // drie dezelfde plaatjes
  for (const reel of await reels(page).all()) await expect(reel).toHaveClass(/\bwin\b/);
  await expect(playButton(page)).toHaveText("NIEUW SPEL");
  await expect(page.locator("#stats")).toContainText("Gewonnen: 1");
});

test("verliesmelding als alle pogingen op zijn", async ({ page }) => {
  await openGame(page, "lose");

  await spin(page);
  await expect(display(page)).toHaveText("NOG 2 POGINGEN — ZET ROLLEN VAST!");
  await spin(page);
  await expect(display(page)).toHaveText("NOG 1 POGING — ZET ROLLEN VAST!");
  await spin(page);

  await expect(display(page)).toHaveText("HELAAS... PROBEER HET NOG EENS");
  await expect(display(page)).toHaveClass(/\blose\b/);
  await expect(litLamps(page)).toHaveCount(0);
  await expect(playButton(page)).toHaveText("NIEUW SPEL");
  for (const btn of await holdButtons(page).all()) await expect(btn).toBeDisabled();
  await expect(page.locator("#stats")).toContainText("Gespeeld: 1");
  await expect(page.locator("#stats")).toContainText("Gewonnen: 0");
});

test("NIEUW SPEL zet het spel terug naar de beginstand", async ({ page }) => {
  await openGame(page, "lose");
  for (let k = 0; k < 3; k++) await spin(page);
  await expect(playButton(page)).toHaveText("NIEUW SPEL");

  await playButton(page).click();

  await expect(display(page)).toHaveText("DRUK OP SPEEL!");
  await expect(playButton(page)).toHaveText("SPEEL");
  await expect(litLamps(page)).toHaveCount(3);
  for (const btn of await holdButtons(page).all()) {
    await expect(btn).toBeDisabled();
    await expect(btn).not.toHaveClass(/\bon\b/);
  }
  // De statistieken blijven bewaard
  await expect(page.locator("#stats")).toContainText("Gespeeld: 1");

  // En er kan weer gespeeld worden
  await spin(page);
  await expect(display(page)).toHaveText("NOG 2 POGINGEN — ZET ROLLEN VAST!");
});

// Aan het eind van elk spel gaat de ronde precies één keer naar de server action saveGame
// (die zonder database niets opslaat, zie src/lib/gameStore.ts)
test("stuurt de ronde na afloop één keer naar de server", async ({ page }) => {
  const sent: unknown[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.headers()["next-action"]) sent.push(req.postDataJSON());
  });

  await openGame(page, "win");
  await spin(page);
  await expect(display(page)).toHaveText("★ JACKPOT! JE HEBT GEWONNEN! ★");
  await expect.poll(() => sent).toEqual([[{ outcome: "WON", tries: 1 }]]);

  await playButton(page).click(); // NIEUW SPEL: geen nieuwe ronde
  await expect(display(page)).toHaveText("DRUK OP SPEEL!");
  await page.waitForTimeout(300);
  expect(sent).toHaveLength(1);
});

test("stuurt een verloren ronde met alle pogingen naar de server", async ({ page }) => {
  const sent: unknown[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.headers()["next-action"]) sent.push(req.postDataJSON());
  });

  await openGame(page, "lose");
  await spin(page);
  await spin(page);
  expect(sent).toHaveLength(0); // nog niet af
  await spin(page);
  await expect(display(page)).toHaveText("HELAAS... PROBEER HET NOG EENS");
  await expect.poll(() => sent).toEqual([[{ outcome: "LOST", tries: 3 }]]);
});
