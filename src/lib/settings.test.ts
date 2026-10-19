import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  MAX_ODDS,
  MAX_ROUNDS_PER_PAYMENT,
  MAX_TRIES_LIMIT,
  mergeSettings,
  ODDS_LEVELS,
  oddsFromUrlAllowed,
  parseFlag,
  parsePositiveInt,
  parseSettingsForm,
  readDefaultDesign,
  readDefaultPaymentProvider,
  readSettings,
} from "@/lib/settings";

describe("parsePositiveInt", () => {
  it("leest gehele getallen binnen de grenzen", () => {
    expect(parsePositiveInt("30", 100)).toBe(30);
    expect(parsePositiveInt(" 7 ", 100)).toBe(7);
    expect(parsePositiveInt("1", 100)).toBe(1);
    expect(parsePositiveInt("100", 100)).toBe(100);
  });

  it("geeft null bij lege of ongeldige waarden", () => {
    for (const value of [undefined, null, "", "  ", "abc", "3.5", "-1", "0", "1e3", "101"]) {
      expect(parsePositiveInt(value, 100), String(value)).toBeNull();
    }
  });
});

describe("parseFlag", () => {
  it("herkent aan-waarden, ook met hoofdletters en spaties", () => {
    for (const value of ["1", "true", "TRUE", "ja", " aan "]) expect(parseFlag(value), value).toBe(true);
  });

  it("staat standaard uit", () => {
    for (const value of [undefined, "", "0", "false", "nee", "uit"]) expect(parseFlag(value), String(value)).toBe(false);
  });
});

describe("readSettings", () => {
  it("gebruikt de standaardwaarden zonder .env", () => {
    expect(readSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ odds: 30, maxTries: 3, roundsPerPayment: 4, design: "jungle" });
  });

  it("leest geldige waarden uit .env", () => {
    expect(readSettings({ GAME_ODDS: "50", GAME_MAX_TRIES: "5", GAME_ROUNDS_PER_PAYMENT: "10" })).toEqual({
      odds: 50,
      maxTries: 5,
      roundsPerPayment: 10,
      design: "jungle",
    });
  });

  it("valt per instelling terug op de standaard bij een ongeldige waarde", () => {
    expect(readSettings({ GAME_ODDS: "abc", GAME_MAX_TRIES: "4", GAME_ROUNDS_PER_PAYMENT: "0" })).toEqual({
      odds: DEFAULT_SETTINGS.odds,
      maxTries: 4,
      roundsPerPayment: DEFAULT_SETTINGS.roundsPerPayment,
      design: "jungle",
    });
  });

  it("houdt zich aan de bovengrenzen", () => {
    const atMax = readSettings({
      GAME_ODDS: String(MAX_ODDS),
      GAME_MAX_TRIES: String(MAX_TRIES_LIMIT),
      GAME_ROUNDS_PER_PAYMENT: String(MAX_ROUNDS_PER_PAYMENT),
    });
    expect(atMax).toEqual({ odds: MAX_ODDS, maxTries: MAX_TRIES_LIMIT, roundsPerPayment: MAX_ROUNDS_PER_PAYMENT, design: "jungle" });

    const overMax = readSettings({
      GAME_ODDS: String(MAX_ODDS + 1),
      GAME_MAX_TRIES: String(MAX_TRIES_LIMIT + 1),
      GAME_ROUNDS_PER_PAYMENT: String(MAX_ROUNDS_PER_PAYMENT + 1),
    });
    expect(overMax).toEqual(DEFAULT_SETTINGS);
  });
});

describe("oddsFromUrlAllowed", () => {
  it("staat alleen aan met GAME_ALLOW_ODDS_URL", () => {
    expect(oddsFromUrlAllowed({})).toBe(false);
    expect(oddsFromUrlAllowed({ GAME_ALLOW_ODDS_URL: "false" })).toBe(false);
    expect(oddsFromUrlAllowed({ GAME_ALLOW_ODDS_URL: "true" })).toBe(true);
  });
});

describe("mergeSettings", () => {
  const defaults = { odds: 30, maxTries: 3, roundsPerPayment: 1, design: "jungle" as const };

  it("neemt de waarden uit de databaserij", () => {
    expect(mergeSettings({ odds: 7, maxTries: 5, roundsPerPayment: 10 }, defaults)).toEqual({
      odds: 7,
      maxTries: 5,
      roundsPerPayment: 10,
      design: "jungle",
      source: "database",
    });
  });

  it("gebruikt de standaard zonder rij", () => {
    expect(mergeSettings(null, defaults)).toEqual({ ...defaults, source: "env" });
  });

  it("negeert ongeldige databasewaarden per veld, met dezelfde grenzen als .env", () => {
    expect(mergeSettings({ odds: 0, maxTries: MAX_TRIES_LIMIT + 1, roundsPerPayment: 2.5 }, defaults)).toEqual({
      ...defaults,
      source: "env",
    });
    expect(mergeSettings({ odds: MAX_ODDS + 1, maxTries: 2, roundsPerPayment: MAX_ROUNDS_PER_PAYMENT + 1 }, defaults)).toEqual({
      odds: 30,
      maxTries: 2,
      roundsPerPayment: 1,
      design: "jungle",
      source: "database",
    });
  });

  it("gebruikt de standaard voor lege velden (null = terug naar standaard)", () => {
    expect(mergeSettings({ odds: null, maxTries: 4, roundsPerPayment: null }, defaults)).toEqual({
      odds: 30,
      maxTries: 4,
      roundsPerPayment: 1,
      design: "jungle",
      source: "database",
    });
    expect(mergeSettings({ odds: null, maxTries: null, roundsPerPayment: null }, defaults)).toEqual({
      ...defaults,
      source: "env",
    });
  });

  it("neemt het design uit de rij; leeg of onbekend → de standaard", () => {
    const numbers = { odds: null, maxTries: null, roundsPerPayment: null };
    expect(mergeSettings({ ...numbers, design: "origineel" }, defaults)).toEqual({
      ...defaults,
      design: "origineel",
      source: "database",
    });
    expect(mergeSettings({ ...numbers, design: null }, defaults)).toEqual({ ...defaults, source: "env" });
    expect(mergeSettings({ ...numbers, design: "neon" as never }, defaults)).toEqual({ ...defaults, source: "env" });
  });
});

describe("parseSettingsForm", () => {
  const form = (fields: Record<string, string>) => new Map(Object.entries(fields));

  it("leest de drie velden als gehele getallen", () => {
    expect(parseSettingsForm(form({ odds: "100", maxTries: " 5 ", roundsPerPayment: "1" }))).toEqual({
      ok: true,
      values: { odds: 100, maxTries: 5, roundsPerPayment: 1 },
    });
  });

  it("maakt van lege of ontbrekende velden null (standaard)", () => {
    expect(parseSettingsForm(form({ odds: "", maxTries: "  " }))).toEqual({
      ok: true,
      values: { odds: null, maxTries: null, roundsPerPayment: null },
    });
  });

  it("accepteert de grenzen en weigert alles daarbuiten, per veld", () => {
    expect(parseSettingsForm(form({ odds: String(MAX_ODDS), maxTries: "1", roundsPerPayment: String(MAX_ROUNDS_PER_PAYMENT) })).ok).toBe(true);
    const result = parseSettingsForm(form({ odds: "0", maxTries: String(MAX_TRIES_LIMIT + 1), roundsPerPayment: "2" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["maxTries", "odds"]);
      expect(result.errors.odds).toContain(`1 t/m ${MAX_ODDS}`);
    }
  });

  it("weigert tekst, kommagetallen en negatieve getallen", () => {
    for (const odds of ["abc", "2.5", "-3", "1e3"]) {
      expect(parseSettingsForm(form({ odds })).ok).toBe(false);
    }
  });
});

describe("ODDS_LEVELS", () => {
  it("loopt van makkelijk naar moeilijk binnen de grenzen", () => {
    const odds = ODDS_LEVELS.map((level) => level.odds);
    expect(odds).toEqual([...odds].sort((a, b) => a - b));
    expect(odds.every((n) => n >= 1 && n <= MAX_ODDS)).toBe(true);
  });
});

describe("betaalmethode (taak 13b)", () => {
  const form = (fields: Record<string, string>) => new Map(Object.entries(fields));

  it("standaard Mollie; GAME_PAYMENT_PROVIDER kan PayPal kiezen", () => {
    expect(readDefaultPaymentProvider({})).toBe("mollie");
    expect(readDefaultPaymentProvider({ GAME_PAYMENT_PROVIDER: " PayPal " })).toBe("paypal");
    expect(readDefaultPaymentProvider({ GAME_PAYMENT_PROVIDER: "mollie" })).toBe("mollie");
    expect(readDefaultPaymentProvider({ GAME_PAYMENT_PROVIDER: "contant" })).toBe("mollie");
  });

  it("leest de keuze uit het formulier: mollie, paypal of leeg (standaard)", () => {
    expect(parseSettingsForm(form({ paymentProvider: "paypal" }))).toMatchObject({ ok: true, values: { paymentProvider: "paypal" } });
    expect(parseSettingsForm(form({ paymentProvider: "mollie" }))).toMatchObject({ ok: true, values: { paymentProvider: "mollie" } });
    expect(parseSettingsForm(form({ paymentProvider: "" }))).toMatchObject({ ok: true, values: { paymentProvider: null } });
  });

  it("zonder het veld blijft de opgeslagen keuze staan", () => {
    const result = parseSettingsForm(form({ odds: "30" }));
    expect(result.ok && "paymentProvider" in result.values).toBe(false);
  });

  it("weigert een onbekende methode", () => {
    expect(parseSettingsForm(form({ paymentProvider: "contant" }))).toEqual({
      ok: false,
      errors: { paymentProvider: "Kies Mollie, PayPal of de standaard." },
    });
  });
});

describe("design (versie 3, taak 1)", () => {
  const form = (fields: Record<string, string>) => new Map(Object.entries(fields));

  it("standaard jungle; GAME_DESIGN kan het originele design kiezen", () => {
    expect(readDefaultDesign({})).toBe("jungle");
    expect(readDefaultDesign({ GAME_DESIGN: " Origineel " })).toBe("origineel");
    expect(readDefaultDesign({ GAME_DESIGN: "jungle" })).toBe("jungle");
    expect(readDefaultDesign({ GAME_DESIGN: "neon" })).toBe("jungle");
    expect(readSettings({ GAME_DESIGN: "origineel" }).design).toBe("origineel");
  });

  it("leest de keuze uit het formulier: jungle, origineel of leeg (standaard)", () => {
    expect(parseSettingsForm(form({ design: "origineel" }))).toMatchObject({ ok: true, values: { design: "origineel" } });
    expect(parseSettingsForm(form({ design: "jungle" }))).toMatchObject({ ok: true, values: { design: "jungle" } });
    expect(parseSettingsForm(form({ design: "" }))).toMatchObject({ ok: true, values: { design: null } });
  });

  it("zonder het veld blijft het opgeslagen design staan", () => {
    const result = parseSettingsForm(form({ odds: "30" }));
    expect(result.ok && "design" in result.values).toBe(false);
  });

  it("weigert een onbekend design", () => {
    expect(parseSettingsForm(form({ design: "neon" }))).toEqual({
      ok: false,
      errors: { design: "Kies Jungle, Origineel of de standaard." },
    });
  });
});
