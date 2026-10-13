// Spelinstellingen uit de omgevingsvariabelen (.env, zie .env.example).
// Alleen op de server lezen: page.tsx geeft ze als props door aan de gokkast.
// Taak 6 vervangt de bron door de database; deze waarden blijven dan de standaard.

export interface GameSettings {
  odds: number; // winkans 1 op odds per draai zonder vastgezette rollen
  maxTries: number; // pogingen per spel
  roundsPerPayment: number; // speelrondes per betaling (nog niet gebruikt, zie taak 10)
}

export const DEFAULT_SETTINGS: GameSettings = {
  odds: 30,
  maxTries: 3,
  roundsPerPayment: 1,
};

// Bovengrenzen: de invoer kende al max 100000, en meer dan 5 lampjes passen niet in de kast
export const MAX_ODDS = 100000;
export const MAX_TRIES_LIMIT = 5;
export const MAX_ROUNDS_PER_PAYMENT = 100;

type Env = Record<string, string | undefined>;

// "30" → 30; leeg, geen geheel getal, < 1 of > max → null
export function parsePositiveInt(value: string | null | undefined, max: number): number | null {
  if (!value || !/^\s*\d+\s*$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= max ? n : null;
}

export function parseFlag(value: string | undefined): boolean {
  return ["1", "true", "ja", "aan"].includes((value ?? "").trim().toLowerCase());
}

export function readSettings(env: Env = process.env): GameSettings {
  return {
    odds: parsePositiveInt(env.GAME_ODDS, MAX_ODDS) ?? DEFAULT_SETTINGS.odds,
    maxTries: parsePositiveInt(env.GAME_MAX_TRIES, MAX_TRIES_LIMIT) ?? DEFAULT_SETTINGS.maxTries,
    roundsPerPayment:
      parsePositiveInt(env.GAME_ROUNDS_PER_PAYMENT, MAX_ROUNDS_PER_PAYMENT) ?? DEFAULT_SETTINGS.roundsPerPayment,
  };
}

// ?kans= in de adresbalk mag de winkans alleen overschrijven als dit aan staat
// (handig bij ontwikkelen en voor de Playwright-tests van taak 4, niet in productie).
export function oddsFromUrlAllowed(env: Env = process.env): boolean {
  return parseFlag(env.GAME_ALLOW_ODDS_URL);
}
