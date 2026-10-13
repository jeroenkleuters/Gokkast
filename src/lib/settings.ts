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

export type SettingKey = "odds" | "maxTries" | "roundsPerPayment";
export const SETTING_KEYS: SettingKey[] = ["odds", "maxTries", "roundsPerPayment"];

// De velden zoals ze in de tabel game_settings staan; null = "standaard" (de .env-waarde)
export type SettingsRow = Record<SettingKey, number | null>;

export const DEFAULT_SETTINGS: GameSettings = {
  odds: 30,
  maxTries: 3,
  roundsPerPayment: 1,
};

// Bovengrenzen: de invoer kende al max 100000, en meer dan 5 lampjes passen niet in de kast
export const MAX_ODDS = 100000;
export const MAX_TRIES_LIMIT = 5;
export const MAX_ROUNDS_PER_PAYMENT = 100;

export const SETTING_LIMITS: Record<SettingKey, number> = {
  odds: MAX_ODDS,
  maxTries: MAX_TRIES_LIMIT,
  roundsPerPayment: MAX_ROUNDS_PER_PAYMENT,
};

// Snelkeuzes voor de winkans in de game-manager (een eigen getal mag ook)
export const ODDS_LEVELS = [
  { label: "Makkelijk", odds: 10 },
  { label: "Normaal", odds: 30 },
  { label: "Moeilijk", odds: 100 },
] as const;

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

// Databaserij over de standaardwaarden heen, per veld: leeg (null = "standaard") of ongeldig
// (buiten dezelfde grenzen als in .env) → de standaardwaarde. De bron is "database" zodra
// minstens één waarde uit de rij komt; geen rij → de standaardwaarden met bron "env".
export function mergeSettings(row: Partial<SettingsRow> | null, defaults: GameSettings): GameSettings {
  const settings: GameSettings = { ...defaults, source: "env" };
  if (!row) return settings;
  for (const key of SETTING_KEYS) {
    const value = row[key];
    if (inRange(value, SETTING_LIMITS[key])) {
      settings[key] = value;
      settings.source = "database";
    }
  }
  return settings;
}

export type SettingsFormResult =
  | { ok: true; values: SettingsRow }
  | { ok: false; errors: Partial<Record<SettingKey, string>> };

// Formulier van de game-manager: per veld een geheel getal binnen de grenzen, of leeg = standaard
export function parseSettingsForm(form: { get(name: string): unknown }): SettingsFormResult {
  const values = {} as SettingsRow;
  const errors: Partial<Record<SettingKey, string>> = {};
  for (const key of SETTING_KEYS) {
    const raw = form.get(key);
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      values[key] = null;
      continue;
    }
    const n = parsePositiveInt(text, SETTING_LIMITS[key]);
    if (n === null) errors[key] = `Vul een geheel getal van 1 t/m ${SETTING_LIMITS[key]} in, of laat het leeg voor de standaard.`;
    else values[key] = n;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

// ?kans= in de adresbalk mag de winkans alleen overschrijven als dit aan staat
// (handig bij ontwikkelen en voor de Playwright-tests van taak 4, niet in productie).
export function oddsFromUrlAllowed(env: Env = process.env): boolean {
  return parseFlag(env.GAME_ALLOW_ODDS_URL);
}
