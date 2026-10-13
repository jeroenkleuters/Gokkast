// Gespeelde rondes opslaan in de tabel games (alleen op de server, via src/app/actions.ts).
// De invoer komt uit de browser en is dus niet te vertrouwen: alles wordt hier gecontroleerd.
import type { GameOutcome as DbGameOutcome } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import type { SymbolName } from "@/lib/game";
import { loadSettings } from "@/lib/settingsStore";

// Bij winst met het gewonnen plaatje, bijv. "WON shot"
export type GameOutcome = `WON ${SymbolName}` | "LOST";

// Uitkomst → waarde van de Prisma-enum (in de database staat de uitkomst zelf, zie schema.prisma)
const DB_OUTCOMES: Record<GameOutcome, DbGameOutcome> = {
  "WON shot": "WON_SHOT",
  "WON kakkerlak": "WON_KAKKERLAK",
  "WON vraagteken": "WON_VRAAGTEKEN",
  LOST: "LOST",
};

const isGameOutcome = (value: unknown): value is GameOutcome => typeof value === "string" && Object.hasOwn(DB_OUTCOMES, value);

export interface GameResult {
  outcome: GameOutcome;
  tries: number; // gebruikte pogingen
}

// { outcome, tries } van de browser → GameResult, of null als het niet klopt.
// Verloren kan alleen na alle pogingen; gewonnen (met plaatje) na 1 t/m maxTries pogingen.
export function parseGameResult(input: unknown, maxTries: number): GameResult | null {
  if (typeof input !== "object" || input === null) return null;
  const { outcome, tries } = input as Record<string, unknown>;
  if (!isGameOutcome(outcome)) return null;
  if (!Number.isInteger(tries) || (tries as number) < 1 || (tries as number) > maxTries) return null;
  if (outcome === "LOST" && tries !== maxTries) return null;
  return { outcome, tries: tries as number };
}

export interface SaveGameDeps {
  maxTries(): Promise<number>;
  create: ((result: GameResult) => Promise<unknown>) | null; // null: geen database
}

function defaultDeps(): SaveGameDeps {
  const db = getDb();
  return {
    maxTries: async () => (await loadSettings()).maxTries,
    create: db && ((result) => db.game.create({ data: { ...result, outcome: DB_OUTCOMES[result.outcome] } })),
  };
}

// true als de ronde is opgeslagen. Ongeldige invoer, geen database of een databasefout
// geeft false (met een waarschuwing in de serverlog); het spel gaat gewoon door.
export async function saveGameResult(input: unknown, deps: SaveGameDeps = defaultDeps()): Promise<boolean> {
  if (!deps.create) return false;
  try {
    const result = parseGameResult(input, await deps.maxTries());
    if (!result) {
      console.warn("Ronde niet opgeslagen, ongeldige invoer:", input);
      return false;
    }
    await deps.create(result);
    return true;
  } catch (error) {
    console.warn("Ronde niet opgeslagen:", error);
    return false;
  }
}
