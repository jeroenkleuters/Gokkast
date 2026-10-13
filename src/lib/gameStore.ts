// Gespeelde rondes opslaan in de tabel games (alleen op de server, via src/app/actions.ts).
// De invoer komt uit de browser en is dus niet te vertrouwen: alles wordt hier gecontroleerd.
import { getDb } from "@/lib/db";
import { loadSettings } from "@/lib/settingsStore";

export type GameOutcome = "WON" | "LOST";

export interface GameResult {
  outcome: GameOutcome;
  tries: number; // gebruikte pogingen
}

// { outcome, tries } van de browser → GameResult, of null als het niet klopt.
// Verloren kan alleen na alle pogingen; gewonnen na 1 t/m maxTries pogingen.
export function parseGameResult(input: unknown, maxTries: number): GameResult | null {
  if (typeof input !== "object" || input === null) return null;
  const { outcome, tries } = input as Record<string, unknown>;
  if (outcome !== "WON" && outcome !== "LOST") return null;
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
    create: db && ((result) => db.game.create({ data: result })),
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
