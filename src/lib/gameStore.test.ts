import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  finishGame,
  memoryGameStore,
  parseGameResult,
  prismaGameStore,
  saveGameResult,
  type GamePayment,
  type GameResult,
  type GameStore,
  type PaidGame,
} from "@/lib/gameStore";

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

  const deps = (create: ((r: GameResult, p: GamePayment | null) => Promise<unknown>) | null) => ({ maxTries: async () => 3, create });

  it("slaat een geldige ronde op", async () => {
    const create = vi.fn(async () => ({}));
    expect(await saveGameResult({ outcome: "WON kakkerlak", tries: 2 }, null, deps(create))).toBe(true);
    expect(create).toHaveBeenCalledExactlyOnceWith({ outcome: "WON kakkerlak", tries: 2 }, null);
  });

  it("koppelt de ronde aan de betaling waarmee gespeeld is", async () => {
    const create = vi.fn(async () => ({}));
    const payment = { id: 12, name: "A. de Vries" };
    expect(await saveGameResult({ outcome: "LOST", tries: 3 }, payment, deps(create))).toBe(true);
    expect(create).toHaveBeenCalledExactlyOnceWith({ outcome: "LOST", tries: 3 }, payment);
  });

  it("slaat niets op zonder database", async () => {
    expect(await saveGameResult({ outcome: "WON shot", tries: 2 }, null, deps(null))).toBe(false);
  });

  it("slaat ongeldige invoer niet op", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn(async () => ({}));
    expect(await saveGameResult({ outcome: "LOST", tries: 1 }, null, deps(create))).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("gebruikt het maximum uit de instellingen", async () => {
    const create = vi.fn(async () => ({}));
    const fiveTries = { maxTries: async () => 5, create };
    expect(await saveGameResult({ outcome: "LOST", tries: 5 }, null, fiveTries)).toBe(true);
    expect(await saveGameResult({ outcome: "LOST", tries: 3 }, null, fiveTries)).toBe(false);
  });

  it("geeft false en een waarschuwing bij een databasefout", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn(() => Promise.reject(new Error("verbinding geweigerd")));
    expect(await saveGameResult({ outcome: "WON shot", tries: 1 }, null, deps(create))).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("finishGame", () => {
  afterEach(() => vi.restoreAllMocks());

  let store: GameStore;
  const deps = () => ({ maxTries: async () => 3, create: store.create, outcomes: store.outcomes });
  const paid = (creditsLeft: number): PaidGame => ({ id: 1, name: "T. TEST", credits: 4, creditsLeft });
  const won = { outcome: "WON shot", tries: 1 } as const;
  const lost = { outcome: "LOST", tries: 3 } as const;

  // De vier spelletjes van een betaling: credits gaan aan het begin van elk spel af
  async function playAll(results: { outcome: GameResult["outcome"]; tries: number }[]) {
    const finished = [];
    for (const [i, result] of results.entries()) finished.push(await finishGame(result, paid(3 - i), deps()));
    return finished;
  }

  beforeEach(() => {
    store = memoryGameStore();
  });

  it("geeft na het laatste spelletje de prijzen van de betaling", async () => {
    const finished = await playAll([won, lost, { outcome: "WON vraagteken", tries: 2 }, won]);
    expect(finished.map((f) => f.saved)).toEqual([true, true, true, true]);
    expect(finished.slice(0, 3).map((f) => f.prizes)).toEqual([null, null, null]);
    expect(finished[3].prizes).toEqual({ name: "T. TEST", games: 4, prizes: { shot: 2, kakkerlak: 0, vraagteken: 1 } });
  });

  it("geeft geen prijzen als er niets gewonnen is", async () => {
    const finished = await playAll([lost, lost, lost, lost]);
    expect(finished.at(-1)).toEqual({ saved: true, prizes: null });
  });

  it("telt alleen de rondes van deze betaling", async () => {
    await finishGame(won, { ...paid(3), id: 2 }, deps());
    await finishGame(won, null, deps());
    const finished = await playAll([lost, lost, lost, { outcome: "WON kakkerlak", tries: 1 }]);
    expect(finished.at(-1)!.prizes!.prizes).toEqual({ shot: 0, kakkerlak: 1, vraagteken: 0 });
  });

  it("slaat nooit meer rondes op dan er spelletjes betaald zijn", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await playAll([won, won, won, won]);
    expect(await finishGame(won, paid(0), deps())).toEqual({ saved: false, prizes: null });
    expect(await store.outcomes(1)).toHaveLength(4);
  });

  it("geeft geen prijzen bij ongeldige invoer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await finishGame({ outcome: "WON jackpot", tries: 1 }, paid(0), deps())).toEqual({ saved: false, prizes: null });
  });

  it("zonder betaling alleen opslaan, zonder prijzen", async () => {
    expect(await finishGame(won, null, deps())).toEqual({ saved: true, prizes: null });
  });

  it("gaat door zonder prijzen als de rondes niet te lezen zijn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = { ...deps(), outcomes: async () => Promise.reject(new Error("db weg")) };
    expect(await finishGame(won, paid(0), failing)).toEqual({ saved: false, prizes: null });
    expect(warn).toHaveBeenCalled();
  });
});

describe("prismaGameStore voor de game-manager", () => {
  function fakeDb() {
    const game = { findMany: vi.fn(async () => []), count: vi.fn(async () => 0), groupBy: vi.fn(async () => []) };
    return { store: prismaGameStore({ game } as unknown as PrismaClient), game };
  }
  const since = new Date("2026-10-13T22:00:00Z");

  it("filtert op periode en een deel van de naam (hoofdletterongevoelig)", async () => {
    const { store, game } = fakeDb();
    await store.countRounds({ since, name: "jan" });
    expect(game.count).toHaveBeenCalledWith({
      where: { playedAt: { gte: since }, name: { contains: "jan", mode: "insensitive" } },
    });
    await store.countByName({ since: null, name: "" });
    expect(game.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("sorteert op de kolom, zonder naam onderaan, en daarna nieuwste eerst", async () => {
    const { store, game } = fakeDb();
    const filter = { since: null, name: "" };
    const orderBy = async (column: "datum" | "naam" | "uitkomst" | "pogingen", dir: "asc" | "desc") => {
      await store.listRounds(filter, { column, dir }, 15, 15);
      return (game.findMany.mock.lastCall as unknown as [{ orderBy: unknown[]; skip: number; take: number }])[0];
    };
    const tail = [{ playedAt: "desc" }, { id: "desc" }];
    expect((await orderBy("naam", "desc")).orderBy).toEqual([{ name: { sort: "desc", nulls: "last" } }, ...tail]);
    expect((await orderBy("datum", "asc")).orderBy).toEqual([{ playedAt: "asc" }, ...tail]);
    expect((await orderBy("uitkomst", "asc")).orderBy).toEqual([{ outcome: "asc" }, ...tail]);
    const last = await orderBy("pogingen", "desc");
    expect(last.orderBy).toEqual([{ tries: "desc" }, ...tail]);
    expect(last).toMatchObject({ skip: 15, take: 15 });
  });
});
