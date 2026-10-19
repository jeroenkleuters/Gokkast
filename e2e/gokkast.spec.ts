import { expect, test, type Page } from "@playwright/test";
import {
  display,
  holdButtons,
  lever,
  litLamps,
  openGame,
  PLAY,
  playButton,
  READY,
  reels,
  spin,
  symbols,
  TEXTS,
} from "./helpers";

// Het speelveld (1024x768) staat helemaal in het venster
async function expectFieldInView(page: Page, width: number, height: number) {
  const box = await page.locator("#game").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-0.5);
  expect(box!.y).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height + 0.5);
  return box!;
}

// Standaard het jungle-design (versie 3, taak 1); het originele design staat onderaan
test("het spel laadt op 1024x768 in het jungle-design", async ({ page }) => {
  const images: string[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/images/jungle/") && res.ok()) images.push(new URL(res.url()).pathname);
  });
  await openGame(page, "lose");

  await expect(page).toHaveTitle("Jackpot");
  await expect(page.locator("#game")).toHaveClass("jungle");
  await expect(page.locator("#cabinet")).toHaveCount(0); // de kast staat in de achtergrond
  await expect(reels(page)).toHaveCount(3);
  for (const reel of await reels(page).all()) await expect(reel).toBeVisible();
  await expect(lever(page)).toBeVisible();
  await expect(display(page)).toBeVisible();
  await expect(playButton(page)).toHaveText("DRAAI");
  await expect(litLamps(page)).toHaveCount(0); // geen lampjes: het berichtenbord meldt de pogingen
  await expect(page.locator("#info")).toHaveText("Hoe Speel Je?Druk op DRAAI. Je hebt 3 pogingen per hand.");
  await expect(page.locator("#stats")).not.toContainText("Credits"); // betalen staat uit op deze server
  await expect.poll(() => images).toContain("/images/jungle/achtergrond.jpg");

  // Precies het speelveld op 1024x768: geen balken
  const box = await expectFieldInView(page, 1024, 768);
  expect(box.x).toBeCloseTo(0, 0);
  expect(box.width).toBeCloseTo(1024, 0);

  // Begin met drie verschillende plaatjes
  expect(new Set(await symbols(page)).size).toBe(3);
});

test("jungle: knoppen VAST VAST VAST DRAAI, elke VAST onder zijn rol", async ({ page }) => {
  await openGame(page, "lose");

  const buttons = page.locator("#panel button");
  await expect(buttons).toHaveText(["VAST", "VAST", "VAST", "DRAAI"]);
  const boxes = await Promise.all((await buttons.all()).map((b) => b.boundingBox()));
  for (let k = 1; k < boxes.length; k++) expect(boxes[k]!.x).toBeGreaterThan(boxes[k - 1]!.x + boxes[k - 1]!.width);

  for (let i = 0; i < 3; i++) {
    const reel = (await reels(page).nth(i).boundingBox())!;
    const btn = boxes[i]!;
    const center = btn.x + btn.width / 2;
    expect(center).toBeGreaterThan(reel.x);
    expect(center).toBeLessThan(reel.x + reel.width);
    expect(btn.y).toBeGreaterThan(reel.y + reel.height); // onder de rol
  }
  // Het berichtenbord onder de knoppen, de hendel rechts van de knoppen
  const board = (await display(page).boundingBox())!;
  expect(board.y).toBeGreaterThan(boxes[3]!.y + boxes[3]!.height);
  expect((await lever(page).boundingBox())!.x).toBeGreaterThan(boxes[3]!.x + boxes[3]!.width);
});

test("jungle: op een breed scherm en een telefoon past het hele speelveld, de achtergrond schaalt mee", async ({
  page,
}) => {
  for (const [width, height] of [
    [1920, 1080],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await openGame(page, "lose");
    await expectFieldInView(page, width, height);
    // De rest van het venster is de vervaagde schildering
    const backdrop = (await page.locator("#backdrop").boundingBox())!;
    expect(backdrop.width).toBeGreaterThanOrEqual(width);
    expect(backdrop.height).toBeGreaterThanOrEqual(height);
  }
});

test("jungle: het tandwiel toont het design", async ({ page }) => {
  await openGame(page, "lose");
  await page.locator("#gear").click();
  await expect(page.locator("#settings")).toContainText("DesignJungle (nieuw)");
});

test("draaien met de hendel verbruikt een poging en draait de rollen", async ({ page }) => {
  await openGame(page, "lose");

  await lever(page).click();
  await expect(display(page)).toHaveText("ROLLEN DRAAIEN...");
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

  await expect(display(page)).toHaveText(READY);
  await expect(playButton(page)).toHaveText(PLAY);
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
  // De uitkomst noemt het gewonnen plaatje, bijv. "WON shot"
  const [won] = await symbols(page);
  await expect.poll(() => sent).toEqual([[{ outcome: `WON ${won}`, tries: 1 }]]);

  await playButton(page).click(); // NIEUW SPEL: geen nieuwe ronde
  await expect(display(page)).toHaveText(READY);
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

// Het originele design (te kiezen in de game-manager; hier met ?design=origineel)
test.describe("origineel design", () => {
  test("laadt met de kast, de lampjes en SPEEL", async ({ page }) => {
    await openGame(page, "lose", "origineel");

    await expect(page.locator("#game")).toHaveClass("origineel");
    await expect(page.locator("#cabinet")).toBeVisible();
    await expect(page.locator("#backdrop")).toHaveCount(0);
    await expect(reels(page)).toHaveCount(3);
    await expect(page.locator("#panel button")).toHaveText(["VAST", "VAST", "VAST", "SPEEL"]);
    await expect(litLamps(page)).toHaveCount(3);
    await expect(page.locator("#info")).toContainText("Druk op SPEEL of trek aan de hendel. Je hebt 3 pogingen.");
    await expectFieldInView(page, 1024, 768);
    expect(new Set(await symbols(page)).size).toBe(3);
  });

  test("lampjes gaan uit per poging en weer aan bij NIEUW SPEL", async ({ page }) => {
    await openGame(page, "lose", "origineel");

    await spin(page, "lever");
    await expect(litLamps(page)).toHaveCount(2);
    await expect(display(page)).toHaveText("NOG 2 POGINGEN — ZET ROLLEN VAST!");
    await spin(page);
    await spin(page);
    await expect(display(page)).toHaveText("HELAAS... PROBEER HET NOG EENS");
    await expect(litLamps(page)).toHaveCount(0);

    await playButton(page).click();
    await expect(display(page)).toHaveText(TEXTS.origineel.ready);
    await expect(playButton(page)).toHaveText("SPEEL");
    await expect(litLamps(page)).toHaveCount(3);
  });
});

// Het havendesign Harbor Jackpot (versie 3, taak 3; te kiezen in de game-manager, hier met ?design=haven)
test.describe("havendesign", () => {
  // Achter de schermen blijven het de plaatjes shot, kakkerlak en vraagteken
  const SYMBOL_OF = { msc: "shot", maersk: "kakkerlak", loyd: "vraagteken" } as Record<string, string>;
  const tries = (page: Page) => page.locator("#tries");

  test("laadt met de foto, de titel, containers, spelregels, POGING en UITHALEN", async ({ page }) => {
    const images: string[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/images/haven/") && res.ok()) images.push(new URL(res.url()).pathname);
    });
    await openGame(page, "lose", "haven");

    await expect(page.locator("#game")).toHaveClass("haven");
    await expect(page.getByRole("heading", { level: 1, name: "Harbor Jackpot" })).toBeVisible();
    await expect(page.locator("#housing")).toBeVisible();
    await expect(page.locator("#cabinet")).toHaveCount(0);
    await expect(lever(page)).toHaveCount(0); // geen hendel
    await expect(page.locator("#backdrop")).toHaveClass("haven");
    await expect(reels(page)).toHaveCount(3);
    await expect(page.locator("#panel button")).toHaveText(["VAST", "VAST", "VAST", "UITHALEN"]);
    await expect(tries(page)).toContainText("POGING");
    await expect(litLamps(page)).toHaveCount(3);

    // Spelregels met per container de prijs; zonder betalen alleen de stand
    const info = page.locator("#info");
    await expect(info.getByRole("heading", { name: "SPELREGELS" })).toBeVisible();
    await expect(info).toContainText("Druk op UITHALEN. Je hebt 3 pogingen per spel.");
    await expect(info.locator(".pay li")).toHaveText(["gratis shotje", "kakkerlak om te blingen", "vrije keuze"]);
    await expect(page.locator("#stats .head")).toHaveText("STAND");
    await expect(page.getByTestId("credits")).toHaveCount(0);

    await expect.poll(() => images).toContain("/images/haven/achtergrond.jpg");
    await expect.poll(() => images).toEqual(expect.arrayContaining(["/images/haven/kast.png", "/images/haven/titel.png"]));
    const box = await expectFieldInView(page, 1024, 768);
    expect(box.width).toBeCloseTo(1024, 0);

    // Containers op de rollen, drie verschillende
    const shown = await symbols(page);
    expect(new Set(shown).size).toBe(3);
    for (const name of shown) expect(Object.keys(SYMBOL_OF)).toContain(name);
  });

  test("POGING staat links naast de VAST-knoppen, elke VAST onder zijn rol", async ({ page }) => {
    await openGame(page, "lose", "haven");

    const buttons = page.locator("#panel button");
    const boxes = await Promise.all((await buttons.all()).map((b) => b.boundingBox()));
    const board = (await tries(page).boundingBox())!;
    expect(board.x + board.width).toBeLessThan(boxes[0]!.x); // links van de eerste VAST
    expect(board.y).toBeLessThan(boxes[0]!.y + boxes[0]!.height); // op dezelfde hoogte
    expect(board.y + board.height).toBeGreaterThan(boxes[0]!.y);
    for (let k = 1; k < boxes.length; k++) expect(boxes[k]!.x).toBeGreaterThan(boxes[k - 1]!.x + boxes[k - 1]!.width);

    for (let i = 0; i < 3; i++) {
      const reel = (await reels(page).nth(i).boundingBox())!;
      const center = boxes[i]!.x + boxes[i]!.width / 2;
      expect(center).toBeGreaterThan(reel.x);
      expect(center).toBeLessThan(reel.x + reel.width);
      expect(boxes[i]!.y).toBeGreaterThan(reel.y + reel.height);
    }
    expect((await display(page).boundingBox())!.y).toBeGreaterThan(boxes[3]!.y + boxes[3]!.height);
  });

  test("lampjes gaan uit per poging, vastzetten werkt, daarna NIEUW SPEL", async ({ page }) => {
    await openGame(page, "lose", "haven");

    await spin(page);
    await expect(litLamps(page)).toHaveCount(2);
    await expect(display(page)).toHaveText("NOG 2 POGINGEN — ZET ROLLEN VAST!");
    await holdButtons(page).first().click();
    await expect(holdButtons(page).first()).toHaveClass(/\bon\b/);
    await spin(page);
    await spin(page);
    await expect(display(page)).toHaveText("HELAAS... PROBEER HET NOG EENS");
    await expect(litLamps(page)).toHaveCount(0);
    await expect(playButton(page)).toHaveText("NIEUW SPEL");

    await playButton(page).click();
    await expect(display(page)).toHaveText(TEXTS.haven.ready);
    await expect(playButton(page)).toHaveText("UITHALEN");
    await expect(litLamps(page)).toHaveCount(3);
  });

  test("winst: de ronde noemt het plaatje achter de container (MSC = shot, MAERSK = kakkerlak, Loyd = vraagteken)", async ({
    page,
  }) => {
    const sent: unknown[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) sent.push(req.postDataJSON());
    });
    await openGame(page, "win", "haven");
    await spin(page);
    await expect(display(page)).toHaveText("★ JACKPOT! JE HEBT GEWONNEN! ★");
    const [won] = await symbols(page);
    await expect.poll(() => sent).toEqual([[{ outcome: `WON ${SYMBOL_OF[won]}`, tries: 1 }]]);
  });

  test("op een breed scherm en een telefoon past het hele speelveld, de foto schaalt mee", async ({ page }) => {
    for (const [width, height] of [
      [1920, 1080],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await openGame(page, "lose", "haven");
      await expectFieldInView(page, width, height);
      const backdrop = (await page.locator("#backdrop").boundingBox())!;
      expect(backdrop.width).toBeGreaterThanOrEqual(width);
      expect(backdrop.height).toBeGreaterThanOrEqual(height);
    }
  });

  test("het tandwiel toont het design", async ({ page }) => {
    await openGame(page, "lose", "haven");
    await page.locator("#gear").click();
    await expect(page.locator("#settings")).toContainText("DesignHarbor Jackpot");
  });
});
