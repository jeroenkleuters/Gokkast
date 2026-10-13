import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSettings } from "@/lib/settingsStore";

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
