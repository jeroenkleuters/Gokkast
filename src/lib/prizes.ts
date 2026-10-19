// Score-popup (taak 10b): na het laatste spelletje van een betaling de gewonnen prijzen tellen,
// zodat de beheerder ze kan uitdelen. Zonder database of netwerk, dus ook bruikbaar in de browser.
import { SYMBOL_NAMES, type SymbolName } from "@/lib/game";
import type { GameOutcome } from "@/lib/gameStore";

// Aantal keer gewonnen per plaatje
export type Prizes = Record<SymbolName, number>;

export interface PrizeSummary {
  name: string | null; // rekeninghouder van de betaling
  games: number; // spelletjes voor de betaling
  prizes: Prizes;
}

export function countPrizes(outcomes: readonly GameOutcome[]): Prizes {
  const prizes = Object.fromEntries(SYMBOL_NAMES.map((name) => [name, 0])) as Prizes;
  for (const outcome of outcomes) {
    if (outcome !== "LOST") prizes[outcome.slice("WON ".length) as SymbolName]++;
  }
  return prizes;
}

export const totalPrizes = (prizes: Prizes) => SYMBOL_NAMES.reduce((sum, name) => sum + prizes[name], 0);

// Overzicht voor de popup, of null als er niets gewonnen is (dan geen popup)
export function prizeSummary(
  payment: { name: string | null; credits: number },
  outcomes: readonly GameOutcome[],
): PrizeSummary | null {
  const prizes = countPrizes(outcomes);
  if (totalPrizes(prizes) === 0) return null;
  return { name: payment.name, games: payment.credits, prizes };
}

// Wat de prijs voor een plaatje is, bijv. "2 gratis shotjes"
const LABELS: Record<SymbolName, [one: string, more: string]> = {
  shot: ["gratis shotje", "gratis shotjes"],
  kakkerlak: ["kakkerlak om te blingen", "kakkerlakken om te blingen"],
  vraagteken: ["vrije keuze", "vrije keuzes"],
};

// Naam van de prijs zonder aantal, bijv. "gratis shotje" (spelregels in het havendesign)
export const prizeName = (name: SymbolName) => LABELS[name][0];

export function prizeLabel(name: SymbolName, count: number): string {
  return `${count} ${LABELS[name][count === 1 ? 0 : 1]}`;
}
