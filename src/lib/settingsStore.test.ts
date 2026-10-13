import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSettings, readStoredSettings, saveStoredSettings } from "@/lib/settingsStore";

const env = { GAME_ODDS: "40", GAME_MAX_TRIES: "4", GAME_ROUNDS_PER_PAYMENT: "2" };
const envSettings = { odds: 40, maxTries: 4, roundsPerPayment: 2, source: "env" };

describe("loadSettings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("leest de instellingen uit de database", async () => {
    const fetchRow = async () => ({ odds: 7, maxTries: 5, roundsPerPayment: 10 });
    expect(await loadSettings(fetchRow, env)).toEqual({ odds: 7, maxTries: 5, roundsPerPayment: 10, source: "database" });
  });

  it("valt terug op .env zonder database", async () => {
    expect(await loadSettings(null, env)).toEqual(envSettings);
  });

  it("gebruikt .env voor velden die in de database leeg zijn (terug naar standaard)", async () => {
    const fetchRow = async () => ({ odds: 100, maxTries: null, roundsPerPayment: null });
    expect(await loadSettings(fetchRow, env)).toEqual({ odds: 100, maxTries: 4, roundsPerPayment: 2, source: "database" });
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
    expect(await loadSettings(null, {})).toEqual({ odds: 30, maxTries: 3, roundsPerPayment: 1, source: "env" });
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
