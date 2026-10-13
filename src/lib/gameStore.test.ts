import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGameResult, saveGameResult, type GameResult } from "@/lib/gameStore";

describe("parseGameResult", () => {
  it("accepteert winst na 1 t/m maxTries pogingen", () => {
    for (const tries of [1, 2, 3]) expect(parseGameResult({ outcome: "WON shot", tries }, 3)).toEqual({ outcome: "WON shot", tries });
  });

  it("accepteert winst met elk plaatje", () => {
    for (const outcome of ["WON shot", "WON kakkerlak", "WON vraagteken"])
      expect(parseGameResult({ outcome, tries: 1 }, 3)).toEqual({ outcome, tries: 1 });
  });

  it("accepteert verlies alleen na alle pogingen", () => {
    expect(parseGameResult({ outcome: "LOST", tries: 3 }, 3)).toEqual({ outcome: "LOST", tries: 3 });
    expect(parseGameResult({ outcome: "LOST", tries: 2 }, 3)).toBeNull();
    expect(parseGameResult({ outcome: "LOST", tries: 5 }, 5)).toEqual({ outcome: "LOST", tries: 5 });
  });

  it("weigert ongeldige invoer", () => {
    const invalid: unknown[] = [
      null,
      undefined,
      "WON shot",
      42,
      {},
      { outcome: "won", tries: 1 },
      { outcome: "DRAW", tries: 1 },
      { outcome: "WON", tries: 1 },
      { outcome: "WON beker", tries: 1 },
      { outcome: "WON Shot", tries: 1 },
      { outcome: "WON_SHOT", tries: 1 },
      { outcome: "toString", tries: 1 },
      { outcome: "WON shot" },
      { outcome: "WON shot", tries: 0 },
      { outcome: "WON shot", tries: 4 },
      { outcome: "WON shot", tries: 1.5 },
      { outcome: "WON shot", tries: "1" },
    ];
    for (const input of invalid) expect(parseGameResult(input, 3), JSON.stringify(input)).toBeNull();
  });

  it("neemt alleen uitkomst en pogingen over, geen andere velden", () => {
    expect(parseGameResult({ outcome: "WON vraagteken", tries: 1, name: "Hacker", id: 7 }, 3)).toEqual({ outcome: "WON vraagteken", tries: 1 });
  });
});

describe("saveGameResult", () => {
  afterEach(() => vi.restoreAllMocks());

  const deps = (create: ((r: GameResult) => Promise<unknown>) | null) => ({ maxTries: async () => 3, create });

  it("slaat een geldige ronde op", async () => {
    const create = vi.fn(async () => ({}));
    expect(await saveGameResult({ outcome: "WON kakkerlak", tries: 2 }, deps(create))).toBe(true);
    expect(create).toHaveBeenCalledExactlyOnceWith({ outcome: "WON kakkerlak", tries: 2 });
  });

  it("slaat niets op zonder database", async () => {
    expect(await saveGameResult({ outcome: "WON shot", tries: 2 }, deps(null))).toBe(false);
  });

  it("slaat ongeldige invoer niet op", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn(async () => ({}));
    expect(await saveGameResult({ outcome: "LOST", tries: 1 }, deps(create))).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("gebruikt het maximum uit de instellingen", async () => {
    const create = vi.fn(async () => ({}));
    const fiveTries = { maxTries: async () => 5, create };
    expect(await saveGameResult({ outcome: "LOST", tries: 5 }, fiveTries)).toBe(true);
    expect(await saveGameResult({ outcome: "LOST", tries: 3 }, fiveTries)).toBe(false);
  });

  it("geeft false en een waarschuwing bij een databasefout", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn(() => Promise.reject(new Error("verbinding geweigerd")));
    expect(await saveGameResult({ outcome: "WON shot", tries: 1 }, deps(create))).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });
});
