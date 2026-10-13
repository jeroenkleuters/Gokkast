import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  MAX_ODDS,
  MAX_ROUNDS_PER_PAYMENT,
  MAX_TRIES_LIMIT,
  mergeSettings,
  oddsFromUrlAllowed,
  parseFlag,
  parsePositiveInt,
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
    expect(DEFAULT_SETTINGS).toEqual({ odds: 30, maxTries: 3, roundsPerPayment: 1 });
  });

  it("leest geldige waarden uit .env", () => {
    expect(readSettings({ GAME_ODDS: "50", GAME_MAX_TRIES: "5", GAME_ROUNDS_PER_PAYMENT: "10" })).toEqual({
      odds: 50,
      maxTries: 5,
      roundsPerPayment: 10,
    });
  });

  it("valt per instelling terug op de standaard bij een ongeldige waarde", () => {
    expect(readSettings({ GAME_ODDS: "abc", GAME_MAX_TRIES: "4", GAME_ROUNDS_PER_PAYMENT: "0" })).toEqual({
      odds: DEFAULT_SETTINGS.odds,
      maxTries: 4,
      roundsPerPayment: DEFAULT_SETTINGS.roundsPerPayment,
    });
  });

  it("houdt zich aan de bovengrenzen", () => {
    const atMax = readSettings({
      GAME_ODDS: String(MAX_ODDS),
      GAME_MAX_TRIES: String(MAX_TRIES_LIMIT),
      GAME_ROUNDS_PER_PAYMENT: String(MAX_ROUNDS_PER_PAYMENT),
    });
    expect(atMax).toEqual({ odds: MAX_ODDS, maxTries: MAX_TRIES_LIMIT, roundsPerPayment: MAX_ROUNDS_PER_PAYMENT });

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
  const defaults = { odds: 30, maxTries: 3, roundsPerPayment: 1 };

  it("neemt de waarden uit de databaserij", () => {
    expect(mergeSettings({ odds: 7, maxTries: 5, roundsPerPayment: 10 }, defaults)).toEqual({
      odds: 7,
      maxTries: 5,
      roundsPerPayment: 10,
      source: "database",
    });
  });

  it("gebruikt de standaard zonder rij", () => {
    expect(mergeSettings(null, defaults)).toEqual({ ...defaults, source: "env" });
  });

  it("negeert ongeldige databasewaarden per veld, met dezelfde grenzen als .env", () => {
    expect(mergeSettings({ odds: 0, maxTries: MAX_TRIES_LIMIT + 1, roundsPerPayment: 2.5 }, defaults)).toEqual({
      ...defaults,
      source: "database",
    });
    expect(mergeSettings({ odds: MAX_ODDS + 1, maxTries: 2, roundsPerPayment: MAX_ROUNDS_PER_PAYMENT + 1 }, defaults)).toEqual({
      odds: 30,
      maxTries: 2,
      roundsPerPayment: 1,
      source: "database",
    });
  });
});
