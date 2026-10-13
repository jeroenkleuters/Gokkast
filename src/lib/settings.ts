// Spelinstellingen: standaardwaarden uit de omgevingsvariabelen (.env, zie .env.example),
// overschreven door de tabel game_settings in de database (zie settingsStore.ts).
// Alleen op de server lezen: page.tsx geeft ze als props door aan de gokkast.

export interface GameSettings {
  odds: number; // winkans 1 op odds per draai zonder vastgezette rollen
  maxTries: number; // pogingen per spel
  roundsPerPayment: number; // speelrondes per betaling (nog niet gebruikt, zie taak 10)
  source?: SettingsSource; // waar de waarden vandaan komen (getoond bij het tandwiel)
}

export type SettingsSource = "database" | "env";

// De velden zoals ze in de tabel game_settings staan
export type SettingsRow = Pick<GameSettings, "odds" | "maxTries" | "roundsPerPayment">;

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

function inRange(value: unknown, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
}

// Databaserij over de standaardwaarden heen; ongeldige waarden (buiten dezelfde grenzen
// als in .env) worden genegeerd. Geen rij → de standaardwaarden met bron "env".
export function mergeSettings(row: Partial<SettingsRow> | null, defaults: GameSettings): GameSettings {
  if (!row) return { ...defaults, source: "env" };
  return {
    odds: inRange(row.odds, MAX_ODDS) ? row.odds : defaults.odds,
    maxTries: inRange(row.maxTries, MAX_TRIES_LIMIT) ? row.maxTries : defaults.maxTries,
    roundsPerPayment: inRange(row.roundsPerPayment, MAX_ROUNDS_PER_PAYMENT)
      ? row.roundsPerPayment
      : defaults.roundsPerPayment,
    source: "database",
  };
}

// ?kans= in de adresbalk mag de winkans alleen overschrijven als dit aan staat
// (handig bij ontwikkelen en voor de Playwright-tests van taak 4, niet in productie).
export function oddsFromUrlAllowed(env: Env = process.env): boolean {
  return parseFlag(env.GAME_ALLOW_ODDS_URL);
}
