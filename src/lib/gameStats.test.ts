import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNameStats,
  pageCount,
  parseStatsQuery,
  readGameStats,
  ROUNDS_PER_PAGE,
  startOfDay,
  statsHref,
  totalStats,
} from "@/lib/gameStats";
import { memoryGameStore, type GameOutcome, type GameStore, type OutcomeCount } from "@/lib/gameStore";

describe("parseStatsQuery", () => {
  it("geeft standaard alles, pagina 1", () => {
    expect(parseStatsQuery({})).toEqual({ period: "alles", page: 1 });
  });

  it("leest periode en pagina uit de URL", () => {
    expect(parseStatsQuery({ periode: "vandaag", pagina: "3" })).toEqual({ period: "vandaag", page: 3 });
    expect(parseStatsQuery({ periode: ["vandaag", "alles"], pagina: ["2"] })).toEqual({ period: "vandaag", page: 2 });
  });

  it("negeert ongeldige waarden", () => {
    for (const pagina of ["0", "-1", "1.5", "abc", "", "1e400", "99999999999999999999"])
      expect(parseStatsQuery({ pagina }).page, pagina).toBe(1);
    expect(parseStatsQuery({ periode: "gisteren" }).period).toBe("alles");
    expect(parseStatsQuery({ periode: "Vandaag" }).period).toBe("alles");
  });
});

describe("statsHref", () => {
  it("laat standaardwaarden weg en springt naar de sectie", () => {
    expect(statsHref({ period: "alles", page: 1 })).toBe("/game-manager#speelrondes");
    expect(statsHref({ period: "vandaag", page: 1 })).toBe("/game-manager?periode=vandaag#speelrondes");
    expect(statsHref({ period: "vandaag", page: 2 })).toBe("/game-manager?periode=vandaag&pagina=2#speelrondes");
    expect(statsHref({ period: "alles", page: 4 })).toBe("/game-manager?pagina=4#speelrondes");
  });

  it("geeft terug wat parseStatsQuery leest", () => {
    const query = { period: "vandaag", page: 7 } as const;
    const url = new URL(statsHref(query), "http://localhost");
    expect(parseStatsQuery(Object.fromEntries(url.searchParams))).toEqual(query);
  });
});

describe("startOfDay", () => {
  it("geeft 00:00 Nederlandse tijd in de wintertijd (UTC+1)", () => {
    expect(startOfDay(new Date("2026-12-01T15:30:00Z")).toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });

  it("geeft 00:00 Nederlandse tijd in de zomertijd (UTC+2)", () => {
    expect(startOfDay(new Date("2026-07-01T15:30:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("telt na middernacht Nederlandse tijd al als de nieuwe dag, ook als het in UTC nog gisteren is", () => {
    // 14 oktober 00:30 in Nederland = 13 oktober 22:30 UTC
    expect(startOfDay(new Date("2026-10-13T22:30:00Z")).toISOString()).toBe("2026-10-13T22:00:00.000Z");
    // 23:59 in Nederland hoort nog bij dezelfde dag
    expect(startOfDay(new Date("2026-10-14T21:59:00Z")).toISOString()).toBe("2026-10-13T22:00:00.000Z");
  });

  it("klopt op de dagen dat de zomertijd begint en eindigt", () => {
    // 29 maart 2026: om 02:00 gaat de klok naar 03:00; middernacht was nog wintertijd
    expect(startOfDay(new Date("2026-03-29T12:00:00Z")).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // 25 oktober 2026: om 03:00 gaat de klok terug naar 02:00; middernacht was nog zomertijd
    expect(startOfDay(new Date("2026-10-25T12:00:00Z")).toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});

describe("pageCount", () => {
  it("heeft altijd minstens één pagina", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(ROUNDS_PER_PAGE)).toBe(1);
    expect(pageCount(ROUNDS_PER_PAGE + 1)).toBe(2);
  });
});

describe("buildNameStats", () => {
  const counts: OutcomeCount[] = [
    { name: "piet", outcome: "LOST", count: 2 },
    { name: null, outcome: "WON shot", count: 1 },
    { name: "Anna", outcome: "WON kakkerlak", count: 2 },
    { name: "Anna", outcome: "LOST", count: 3 },
    { name: "Émile", outcome: "WON vraagteken", count: 1 },
    { name: "Anna", outcome: "WON shot", count: 1 },
    { name: null, outcome: "LOST", count: 4 },
  ];

  it("telt per naam gespeeld, gewonnen per plaatje en verloren", () => {
    const anna = buildNameStats(counts).find((s) => s.name === "Anna");
    expect(anna).toEqual({
      name: "Anna",
      played: 6,
      won: { shot: 1, kakkerlak: 2, vraagteken: 0 },
      wonTotal: 3,
      lost: 3,
    });
  });

  it("sorteert op naam (A-Z, hoofdletters en accenten tellen niet) met zonder naam onderaan", () => {
    expect(buildNameStats(counts).map((s) => s.name)).toEqual(["Anna", "Émile", "piet", null]);
  });

  it("houdt verschillende schrijfwijzen apart", () => {
    const stats = buildNameStats([
      { name: "A. Jansen", outcome: "LOST", count: 1 },
      { name: "A. JANSEN", outcome: "LOST", count: 1 },
    ]);
    expect(stats).toHaveLength(2);
  });

  it("geeft een lege lijst zonder rondes", () => {
    expect(buildNameStats([])).toEqual([]);
  });

  it("totalStats telt alle namen op", () => {
    expect(totalStats(buildNameStats(counts))).toEqual({
      name: "Totaal",
      played: 14,
      won: { shot: 2, kakkerlak: 2, vraagteken: 1 },
      wonTotal: 5,
      lost: 9,
    });
  });
});

describe("readGameStats", () => {
  afterEach(() => vi.restoreAllMocks());

  const NOW = new Date("2026-10-14T20:00:00Z"); // 22:00 in Nederland

  // Rondes in de geheugenopslag, elk op een eigen tijdstip
  async function storeWith(rounds: { at: string; outcome: GameOutcome; name?: string }[]) {
    let at = new Date();
    const store = memoryGameStore(() => at);
    for (const round of rounds) {
      at = new Date(round.at);
      const tries = round.outcome === "LOST" ? 3 : 1;
      await store.create({ outcome: round.outcome, tries }, round.name ? { id: 1, name: round.name } : null);
    }
    return store;
  }

  it("zonder database: no-database", async () => {
    expect(await readGameStats({ period: "alles", page: 1 }, null, NOW)).toEqual({ status: "no-database" });
  });

  it("geeft de rondes nieuwste eerst, met de statistieken per naam", async () => {
    const store = await storeWith([
      { at: "2026-10-13T19:00:00Z", outcome: "LOST", name: "Bob" },
      { at: "2026-10-14T19:00:00Z", outcome: "WON shot", name: "Anna" },
      { at: "2026-10-14T18:00:00Z", outcome: "LOST" },
    ]);
    const stats = await readGameStats({ period: "alles", page: 1 }, store, NOW);
    expect(stats.status).toBe("ok");
    if (stats.status !== "ok") return;
    expect(stats.total).toBe(3);
    expect(stats.pageCount).toBe(1);
    expect(stats.rounds.map((r) => [r.name, r.outcome, r.tries])).toEqual([
      ["Anna", "WON shot", 1],
      [null, "LOST", 3],
      ["Bob", "LOST", 3],
    ]);
    expect(stats.names.map((s) => [s.name, s.played, s.wonTotal, s.lost])).toEqual([
      ["Anna", 1, 1, 0],
      ["Bob", 1, 0, 1],
      [null, 1, 0, 1],
    ]);
  });

  it("vandaag: alleen rondes vanaf 00:00 Nederlandse tijd, ook in de statistieken", async () => {
    const store = await storeWith([
      { at: "2026-10-13T21:59:59Z", outcome: "WON shot", name: "Anna" }, // 23:59:59 gisteren
      { at: "2026-10-13T22:00:00Z", outcome: "LOST", name: "Anna" }, // 00:00 vandaag
      { at: "2026-10-14T19:00:00Z", outcome: "WON kakkerlak", name: "Bob" },
    ]);
    const stats = await readGameStats({ period: "vandaag", page: 1 }, store, NOW);
    if (stats.status !== "ok") throw new Error(stats.status);
    expect(stats.total).toBe(2);
    expect(stats.rounds.map((r) => r.outcome)).toEqual(["WON kakkerlak", "LOST"]);
    expect(stats.names.find((s) => s.name === "Anna")).toMatchObject({ played: 1, wonTotal: 0, lost: 1 });
  });

  it("verdeelt de rondes over pagina's; een pagina voorbij het einde wordt de laatste", async () => {
    const rounds = Array.from({ length: ROUNDS_PER_PAGE + 3 }, (_, i) => ({
      at: new Date(Date.UTC(2026, 9, 14, 10, i)).toISOString(),
      outcome: "LOST" as const,
      name: `Speler ${i}`,
    }));
    const store = await storeWith(rounds);

    const page1 = await readGameStats({ period: "alles", page: 1 }, store, NOW);
    if (page1.status !== "ok") throw new Error(page1.status);
    expect(page1.pageCount).toBe(2);
    expect(page1.rounds).toHaveLength(ROUNDS_PER_PAGE);
    expect(page1.rounds[0].name).toBe(`Speler ${ROUNDS_PER_PAGE + 2}`);
    // Statistieken tellen alle rondes, niet alleen die op de pagina
    expect(page1.names).toHaveLength(ROUNDS_PER_PAGE + 3);

    const page2 = await readGameStats({ period: "alles", page: 2 }, store, NOW);
    if (page2.status !== "ok") throw new Error(page2.status);
    expect(page2.rounds.map((r) => r.name)).toEqual(["Speler 2", "Speler 1", "Speler 0"]);

    const tooFar = await readGameStats({ period: "alles", page: 9 }, store, NOW);
    if (tooFar.status !== "ok") throw new Error(tooFar.status);
    expect(tooFar.query.page).toBe(2);
    expect(tooFar.rounds).toEqual(page2.rounds);
  });

  it("zonder rondes: ok met één lege pagina", async () => {
    const stats = await readGameStats({ period: "vandaag", page: 3 }, memoryGameStore(), NOW);
    expect(stats).toEqual({
      status: "ok",
      query: { period: "vandaag", page: 1 },
      total: 0,
      pageCount: 1,
      rounds: [],
      names: [],
    });
  });

  it("geeft vandaag de juiste begintijd door aan de opslag", async () => {
    const store = memoryGameStore();
    const countRounds = vi.spyOn(store, "countRounds");
    const listRounds = vi.spyOn(store, "listRounds");
    await readGameStats({ period: "vandaag", page: 1 }, store, NOW);
    expect(countRounds).toHaveBeenCalledWith(new Date("2026-10-13T22:00:00Z"));
    expect(listRounds).toHaveBeenCalledWith(new Date("2026-10-13T22:00:00Z"), 0, ROUNDS_PER_PAGE);

    await readGameStats({ period: "alles", page: 1 }, store, NOW);
    expect(countRounds).toHaveBeenLastCalledWith(null);
  });

  it("een databasefout of time-out geeft error (met een waarschuwing)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing: GameStore = { ...memoryGameStore(), countRounds: () => Promise.reject(new Error("kapot")) };
    expect(await readGameStats({ period: "alles", page: 1 }, failing, NOW)).toEqual({ status: "error" });

    const slow: GameStore = { ...memoryGameStore(), countByName: () => new Promise(() => {}) };
    expect(await readGameStats({ period: "alles", page: 1 }, slow, NOW, 10)).toEqual({ status: "error" });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
