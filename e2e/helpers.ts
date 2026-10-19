import { expect, type Page } from "@playwright/test";

// Uitkomst voorspelbaar maken. De server draait met GAME_ALLOW_ODDS_URL=true:
// - winst: ?kans=1 geeft winkans 1, dus elke draai wint;
// - verlies: ?kans=100000 en Math.random nooit onder 0,05. Zelfs met twee
//   vastgezette rollen is de winkans dan (1/100000)^(1/3) ≈ 0,02, dus nooit winst.
export type Outcome = "win" | "lose";

// Design (versie 3, taak 1 en 3): standaard het jungle-design; ?design=haven of ?design=origineel kiest
// een ander (alleen met GAME_ALLOW_ODDS_URL, net als ?kans=)
export type Design = "jungle" | "haven" | "origineel";
export const TEXTS: Record<Design, { ready: string; play: string }> = {
  jungle: { ready: "DRUK OP DRAAI OF TREK DE HENDEL!", play: "DRAAI" },
  haven: { ready: "DRUK OP UITHALEN!", play: "UITHALEN" },
  origineel: { ready: "DRUK OP SPEEL!", play: "SPEEL" },
};
export const READY = TEXTS.jungle.ready;
export const PLAY = TEXTS.jungle.play;

export async function openGame(page: Page, outcome: Outcome, design: Design = "jungle") {
  await page.addInitScript((lose) => {
    try {
      localStorage.setItem("gokkast-geluid", "uit"); // stil testen
    } catch {}
    if (lose) {
      const random = Math.random;
      Math.random = () => 0.05 + random() * 0.9;
    }
  }, outcome === "lose");
  const query = (outcome === "win" ? "?kans=1" : "?kans=100000") + (design !== "jungle" ? `&design=${design}` : "");
  await page.goto(`/${query}`);
  await expect(page.locator("#display")).toHaveText(TEXTS[design].ready);
}

export const reels = (page: Page) => page.locator("#reels .reel");
export const holdButtons = (page: Page) => page.locator("#panel .holdbtn");
export const playButton = (page: Page) => page.locator("#playbtn");
export const lever = (page: Page) => page.getByRole("button", { name: "Trek aan de hendel" });
export const display = (page: Page) => page.locator("#display");
export const litLamps = (page: Page) => page.locator("#tries-lamps .lamp.on");

// Plaatje op de winlijn per rol (de middelste cel), bijv. ["shot", "kakkerlak", "vraagteken"];
// in het havendesign de containers, bijv. ["msc", "maersk", "loyd"]
export async function symbols(page: Page): Promise<string[]> {
  const srcs = await page
    .locator("#reels .reel .cell:nth-child(2) img")
    .evaluateAll((imgs) => imgs.map((img) => decodeURIComponent((img as HTMLImageElement).src)));
  return srcs.map((src) => src.match(/images\/(?:haven\/)?(\w+)\.png/)?.[1] ?? src);
}

// Draaien en wachten tot alle rollen stilstaan (de speelknop is dan weer actief)
export async function spin(page: Page, via: "lever" | "button" = "button") {
  await (via === "lever" ? lever(page) : playButton(page)).click();
  await expect(playButton(page)).toBeDisabled();
  await expect(playButton(page)).toBeEnabled();
}
