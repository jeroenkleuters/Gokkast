// Spelinstellingen: standaardwaarden uit de omgevingsvariabelen (.env, zie .env.example),
// overschreven door de tabel game_settings in de database (zie settingsStore.ts).
// Alleen op de server lezen: page.tsx geeft ze als props door aan de gokkast.

export interface GameSettings {
  odds: number; // winkans 1 op odds per draai zonder vastgezette rollen
  maxTries: number; // pogingen per spel
  roundsPerPayment: number; // speelrondes (credits) per betaling, zie payments.ts
  priceCents: number; // prijs van één betaling in centen (versie 3, taak 2)
  design: Design; // uiterlijk van het spel (versie 3, taak 1)
  source?: SettingsSource; // waar de waarden vandaan komen (getoond in de game-manager)
}

export type SettingsSource = "database" | "env";

export type SettingKey = "odds" | "maxTries" | "roundsPerPayment" | "priceCents";
export const SETTING_KEYS: SettingKey[] = ["odds", "maxTries", "roundsPerPayment", "priceCents"];

// Betaalmethode (taak 13b). Niets gekozen in de game-manager: GAME_PAYMENT_PROVIDER, anders Mollie.
export const PAYMENT_PROVIDERS = ["mollie", "paypal"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export const DEFAULT_PAYMENT_PROVIDER: PaymentProvider = "mollie";
export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = { mollie: "Mollie (iDEAL)", paypal: "PayPal" };

export const isPaymentProvider = (value: unknown): value is PaymentProvider =>
  typeof value === "string" && (PAYMENT_PROVIDERS as readonly string[]).includes(value);

// Design (versie 3, taak 1 en 3): het jungle-design, het havendesign Harbor Jackpot of het originele.
// Niets gekozen in de game-manager: GAME_DESIGN, anders jungle.
export const DESIGNS = ["jungle", "haven", "origineel"] as const;
export type Design = (typeof DESIGNS)[number];
export const DEFAULT_DESIGN: Design = "jungle";
export const DESIGN_LABELS: Record<Design, string> = {
  jungle: "Jungle (nieuw)",
  haven: "Harbor Jackpot",
  origineel: "Origineel",
};

export const isDesign = (value: unknown): value is Design =>
  typeof value === "string" && (DESIGNS as readonly string[]).includes(value);

// De velden zoals ze in de tabel game_settings staan; null = "standaard" (de .env-waarde).
// paymentProvider en design ontbreken (undefined) als ze niet gelezen of niet meegestuurd zijn: dan
// blijven ze zoals ze zijn.
export type SettingsRow = Record<SettingKey, number | null> & {
  paymentProvider?: PaymentProvider | null;
  design?: Design | null;
};

export const DEFAULT_SETTINGS: GameSettings = {
  odds: 30,
  maxTries: 3,
  roundsPerPayment: 4, // 4 spelletjes voor € 1,00 (taak 10)
  priceCents: 100,
  design: DEFAULT_DESIGN,
};

// Bovengrenzen: de invoer kende al max 100000, en meer dan 5 lampjes passen niet in de kast
export const MAX_ODDS = 100000;
export const MAX_TRIES_LIMIT = 5;
export const MAX_ROUNDS_PER_PAYMENT = 100;
export const MAX_PRICE_CENTS = 10000; // € 100,00

export const SETTING_LIMITS: Record<SettingKey, number> = {
  odds: MAX_ODDS,
  maxTries: MAX_TRIES_LIMIT,
  roundsPerPayment: MAX_ROUNDS_PER_PAYMENT,
  priceCents: MAX_PRICE_CENTS,
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

// Bedrag in euro's zoals een beheerder het intypt ("1,50", "1.5", "2" of "€ 2") → centen;
// geen geldig bedrag, meer dan twee decimalen, < 1 cent of > max → null
export function parseEuroCents(value: string | null | undefined, max = MAX_PRICE_CENTS): number | null {
  const match = /^\s*(?:€\s*)?(\d{1,6})(?:[.,](\d{1,2}))?\s*$/.exec(value ?? "");
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents >= 1 && cents <= max ? cents : null;
}

// 150 → "1,50" (voor een invoerveld); formatEuro in payments.ts zet er "€ " voor
export function euroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function parseFlag(value: string | undefined): boolean {
  return ["1", "true", "ja", "aan"].includes((value ?? "").trim().toLowerCase());
}

// Standaard betaalmethode uit .env; leeg of onbekend → Mollie
export function readDefaultPaymentProvider(env: Env = process.env): PaymentProvider {
  const value = (env.GAME_PAYMENT_PROVIDER ?? "").trim().toLowerCase();
  return isPaymentProvider(value) ? value : DEFAULT_PAYMENT_PROVIDER;
}

// Standaard design uit .env; leeg of onbekend → jungle
export function readDefaultDesign(env: Env = process.env): Design {
  const value = (env.GAME_DESIGN ?? "").trim().toLowerCase();
  return isDesign(value) ? value : DEFAULT_DESIGN;
}

export function readSettings(env: Env = process.env): GameSettings {
  return {
    odds: parsePositiveInt(env.GAME_ODDS, MAX_ODDS) ?? DEFAULT_SETTINGS.odds,
    maxTries: parsePositiveInt(env.GAME_MAX_TRIES, MAX_TRIES_LIMIT) ?? DEFAULT_SETTINGS.maxTries,
    roundsPerPayment:
      parsePositiveInt(env.GAME_ROUNDS_PER_PAYMENT, MAX_ROUNDS_PER_PAYMENT) ?? DEFAULT_SETTINGS.roundsPerPayment,
    priceCents: parsePositiveInt(env.GAME_PRICE_CENTS, MAX_PRICE_CENTS) ?? DEFAULT_SETTINGS.priceCents,
    design: readDefaultDesign(env),
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
  if (isDesign(row.design)) {
    settings.design = row.design;
    settings.source = "database";
  }
  return settings;
}

export type SettingsFormKey = SettingKey | "paymentProvider" | "design";

export type SettingsFormResult =
  | { ok: true; values: SettingsRow }
  | { ok: false; errors: Partial<Record<SettingsFormKey, string>> };

// Formulier van de game-manager: per veld een geheel getal binnen de grenzen, of leeg = standaard.
// De prijs is een bedrag in euro's (bijv. 1,50), opgeslagen in centen.
// Betaalmethode: mollie, paypal of leeg (standaard); design: jungle, haven, origineel of leeg (standaard).
// Zonder zo'n veld blijft de opgeslagen keuze staan.
export function parseSettingsForm(form: { get(name: string): unknown }): SettingsFormResult {
  const values = {} as SettingsRow;
  const errors: Partial<Record<SettingsFormKey, string>> = {};
  for (const key of SETTING_KEYS) {
    const raw = form.get(key);
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      values[key] = null;
      continue;
    }
    if (key === "priceCents") {
      const cents = parseEuroCents(text);
      if (cents === null) errors[key] = `Vul een bedrag van € 0,01 t/m € ${euroInput(MAX_PRICE_CENTS)} in (bijv. 1,50), of laat het leeg voor de standaard.`;
      else values[key] = cents;
      continue;
    }
    const n = parsePositiveInt(text, SETTING_LIMITS[key]);
    if (n === null) errors[key] = `Vul een geheel getal van 1 t/m ${SETTING_LIMITS[key]} in, of laat het leeg voor de standaard.`;
    else values[key] = n;
  }
  const provider = form.get("paymentProvider");
  if (typeof provider === "string") {
    if (provider === "") values.paymentProvider = null;
    else if (isPaymentProvider(provider)) values.paymentProvider = provider;
    else errors.paymentProvider = "Kies Mollie, PayPal of de standaard.";
  }
  const design = form.get("design");
  if (typeof design === "string") {
    if (design === "") values.design = null;
    else if (isDesign(design)) values.design = design;
    else errors.design = "Kies Jungle, Harbor Jackpot, Origineel of de standaard.";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

// ?kans= (winkans) en ?design= in de adresbalk mogen de instellingen alleen overschrijven als dit aan
// staat (handig bij ontwikkelen en voor de Playwright-tests van taak 4, niet in productie).
export function oddsFromUrlAllowed(env: Env = process.env): boolean {
  return parseFlag(env.GAME_ALLOW_ODDS_URL);
}
