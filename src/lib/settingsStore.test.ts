import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPaymentProvider, loadSettings, readStoredSettings, saveStoredSettings, settingsData } from "@/lib/settingsStore";

const env = { GAME_ODDS: "40", GAME_MAX_TRIES: "4", GAME_ROUNDS_PER_PAYMENT: "2" };
const envSettings = { odds: 40, maxTries: 4, roundsPerPayment: 2, design: "jungle", source: "env" };

describe("loadSettings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("leest de instellingen uit de database", async () => {
    const fetchRow = async () => ({ odds: 7, maxTries: 5, roundsPerPayment: 10 });
    expect(await loadSettings(fetchRow, env)).toEqual({ odds: 7, maxTries: 5, roundsPerPayment: 10, design: "jungle", source: "database" });
  });

  it("valt terug op .env zonder database", async () => {
    expect(await loadSettings(null, env)).toEqual(envSettings);
  });

  it("gebruikt .env voor velden die in de database leeg zijn (terug naar standaard)", async () => {
    const fetchRow = async () => ({ odds: 100, maxTries: null, roundsPerPayment: null });
    expect(await loadSettings(fetchRow, env)).toEqual({ odds: 100, maxTries: 4, roundsPerPayment: 2, design: "jungle", source: "database" });
  });

  it("valt terug op .env als de tabel nog leeg is", async () => {
    expect(await loadSettings(async () => null, env)).toEqual(envSettings);
  });

  it("valt terug op .env bij een databasefout", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchRow = () => Promise.reject(new Error("verbinding geweigerd"));
    expect(await loadSettings(fetchRow, env)).toEqual(envSettings);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("valt terug op .env als de database te lang nodig heeft", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchRow = () => new Promise<never>(() => {});
    expect(await loadSettings(fetchRow, env, 20)).toEqual(envSettings);
  });

  it("gebruikt zonder database en .env de vaste standaard", async () => {
    expect(await loadSettings(null, {})).toEqual({ odds: 30, maxTries: 3, roundsPerPayment: 4, design: "jungle", source: "env" });
  });

  it("leest het design uit de database, anders GAME_DESIGN (versie 3, taak 1)", async () => {
    const numbers = { odds: null, maxTries: null, roundsPerPayment: null };
    expect((await loadSettings(async () => ({ ...numbers, design: "origineel" as const }), {})).design).toBe("origineel");
    expect((await loadSettings(async () => ({ ...numbers, design: null }), { GAME_DESIGN: "origineel" })).design).toBe("origineel");
    expect((await loadSettings(null, { GAME_DESIGN: "origineel" })).design).toBe("origineel");
    expect((await loadSettings(null, {})).design).toBe("jungle");
  });
});

describe("readStoredSettings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("geeft de ruwe rij, ook met lege velden", async () => {
    const row = { odds: null, maxTries: 4, roundsPerPayment: null };
    expect(await readStoredSettings(async () => row)).toEqual({ status: "ok", row });
  });

  it("geeft null als er nog geen rij is", async () => {
    expect(await readStoredSettings(async () => null)).toEqual({ status: "ok", row: null });
  });

  it("meldt dat er geen database is", async () => {
    expect(await readStoredSettings(null)).toEqual({ status: "no-database" });
  });

  it("meldt een databasefout of time-out", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readStoredSettings(() => Promise.reject(new Error("weg")))).toEqual({ status: "error" });
    expect(await readStoredSettings(() => new Promise<never>(() => {}), 20)).toEqual({ status: "error" });
  });
});

describe("saveStoredSettings", () => {
  afterEach(() => vi.restoreAllMocks());
  const values = { odds: 100, maxTries: null, roundsPerPayment: 2 };

  it("slaat de waarden op, null = standaard", async () => {
    const saveRow = vi.fn(async () => {});
    expect(await saveStoredSettings(values, saveRow)).toBe("saved");
    expect(saveRow).toHaveBeenCalledWith(values);
  });

  it("meldt dat er geen database is", async () => {
    expect(await saveStoredSettings(values, null)).toBe("no-database");
  });

  it("meldt een databasefout of time-out zonder te crashen", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveStoredSettings(values, () => Promise.reject(new Error("weg")))).toBe("error");
    expect(await saveStoredSettings(values, () => new Promise<never>(() => {}), 20)).toBe("error");
    expect(error).toHaveBeenCalledTimes(2);
  });
});

describe("betaalmethode (taak 13b)", () => {
  afterEach(() => vi.restoreAllMocks());
  const row = (paymentProvider: "mollie" | "paypal" | null) => async () => ({ odds: null, maxTries: null, roundsPerPayment: null, paymentProvider });

  it("de keuze in de game-manager gaat voor; leeg of zonder database de standaard", async () => {
    expect(await loadPaymentProvider(row("paypal"), {})).toBe("paypal");
    expect(await loadPaymentProvider(row(null), {})).toBe("mollie");
    expect(await loadPaymentProvider(row(null), { GAME_PAYMENT_PROVIDER: "paypal" })).toBe("paypal");
    expect(await loadPaymentProvider(async () => null, {})).toBe("mollie");
    expect(await loadPaymentProvider(null, { GAME_PAYMENT_PROVIDER: "paypal" })).toBe("paypal");
  });

  it("een databasefout of time-out geeft de standaard", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadPaymentProvider(() => Promise.reject(new Error("weg")), {})).toBe("mollie");
    expect(await loadPaymentProvider(() => new Promise(() => {}), {}, 20)).toBe("mollie");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("slaat de keuze op als databasewaarde; niet meegestuurd = kolom niet aanraken", () => {
    const numbers = { odds: 30, maxTries: null, roundsPerPayment: 4 };
    expect(settingsData({ ...numbers, paymentProvider: "paypal" })).toEqual({ ...numbers, paymentProvider: "PAYPAL" });
    expect(settingsData({ ...numbers, paymentProvider: null })).toEqual({ ...numbers, paymentProvider: null });
    expect(settingsData(numbers)).toEqual(numbers);
  });
});

describe("design opslaan (versie 3, taak 1)", () => {
  it("slaat het design op als databasewaarde; niet meegestuurd = kolom niet aanraken", () => {
    const numbers = { odds: 30, maxTries: null, roundsPerPayment: 4 };
    expect(settingsData({ ...numbers, design: "origineel" })).toEqual({ ...numbers, design: "ORIGINEEL" });
    expect(settingsData({ ...numbers, design: "jungle" })).toEqual({ ...numbers, design: "JUNGLE" });
    expect(settingsData({ ...numbers, design: null })).toEqual({ ...numbers, design: null });
    expect(settingsData({ ...numbers, paymentProvider: "paypal", design: "origineel" })).toEqual({
      ...numbers,
      paymentProvider: "PAYPAL",
      design: "ORIGINEEL",
    });
  });
});
