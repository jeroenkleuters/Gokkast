import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNameStats, readGameStats, sortNameStats, startOfDay, totalStats } from "@/lib/gameStats";
import { memoryGameStore, type GameOutcome, type GameStore, type OutcomeCount } from "@/lib/gameStore";
import { parseManagerQuery, type NameColumn, type RoundColumn, type StatsQuery } from "@/lib/managerQuery";
import { ROWS_PER_PAGE, type SortDir } from "@/lib/tables";

// Standaard-query (alles, geen naam, pagina 1, standaardsortering) met aanpassingen
function statsQuery(
  change: Partial<Pick<StatsQuery, "period" | "name">> & { namePage?: number; roundPage?: number } = {},
): StatsQuery {
  const query = parseManagerQuery({}).stats;
  return {
    ...query,
    ...(change.period && { period: change.period }),
    ...(change.name && { name: change.name }),
    names: { ...query.names, page: change.namePage ?? 1 },
    rounds: { ...query.rounds, page: change.roundPage ?? 1 },
  };
}

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

describe("sortNameStats", () => {
  const stats = buildNameStats([
    { name: "Bob", outcome: "WON shot", count: 3 },
    { name: "anna", outcome: "LOST", count: 5 },
    { name: "Cees", outcome: "WON shot", count: 1 },
    { name: "Cees", outcome: "LOST", count: 4 },
    { name: null, outcome: "WON shot", count: 9 },
  ]);
  const names = (column: NameColumn, dir: SortDir) => sortNameStats(stats, { column, dir }).map((s) => s.name);

  it("sorteert op naam in beide richtingen, zonder naam altijd onderaan", () => {
    expect(names("naam", "asc")).toEqual(["anna", "Bob", "Cees", null]);
    expect(names("naam", "desc")).toEqual(["Cees", "Bob", "anna", null]);
  });

  it("sorteert op getallen; bij gelijke waarden op naam", () => {
    expect(names("gespeeld", "desc")).toEqual([null, "anna", "Cees", "Bob"]);
    expect(names("shot", "desc")).toEqual([null, "Bob", "Cees", "anna"]);
    expect(names("verloren", "asc")).toEqual(["Bob", null, "Cees", "anna"]);
    expect(names("gewonnen", "asc")).toEqual(["anna", "Cees", "Bob", null]);
    // kakkerlak is overal 0: dan alleen op naam
    expect(names("kakkerlak", "desc")).toEqual(["anna", "Bob", "Cees", null]);
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

  async function read(query: StatsQuery, store: GameStore) {
    const stats = await readGameStats(query, store, NOW);
    if (stats.status !== "ok") throw new Error(stats.status);
    return stats;
  }

  it("zonder database: no-database", async () => {
    expect(await readGameStats(statsQuery(), null, NOW)).toEqual({ status: "no-database" });
  });

  it("geeft de rondes nieuwste eerst, met de statistieken per naam", async () => {
    const store = await storeWith([
      { at: "2026-10-13T19:00:00Z", outcome: "LOST", name: "Bob" },
      { at: "2026-10-14T19:00:00Z", outcome: "WON shot", name: "Anna" },
      { at: "2026-10-14T18:00:00Z", outcome: "LOST" },
    ]);
    const stats = await read(statsQuery(), store);
    expect(stats.total).toBe(3);
    expect(stats.roundPages).toBe(1);
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
    expect(stats.totals).toMatchObject({ played: 3, wonTotal: 1, lost: 2 });
  });

  it("vandaag: alleen rondes vanaf 00:00 Nederlandse tijd, ook in de statistieken", async () => {
    const store = await storeWith([
      { at: "2026-10-13T21:59:59Z", outcome: "WON shot", name: "Anna" }, // 23:59:59 gisteren
      { at: "2026-10-13T22:00:00Z", outcome: "LOST", name: "Anna" }, // 00:00 vandaag
      { at: "2026-10-14T19:00:00Z", outcome: "WON kakkerlak", name: "Bob" },
    ]);
    const stats = await read(statsQuery({ period: "vandaag" }), store);
    expect(stats.total).toBe(2);
    expect(stats.rounds.map((r) => r.outcome)).toEqual(["WON kakkerlak", "LOST"]);
    expect(stats.names.find((s) => s.name === "Anna")).toMatchObject({ played: 1, wonTotal: 0, lost: 1 });
  });

  it("filtert op een deel van de naam, zonder op hoofdletters te letten", async () => {
    const store = await storeWith([
      { at: "2026-10-14T10:00:00Z", outcome: "LOST", name: "A. Jansen" },
      { at: "2026-10-14T11:00:00Z", outcome: "WON shot", name: "P. JANSSEN" },
      { at: "2026-10-14T12:00:00Z", outcome: "LOST", name: "Bob" },
      { at: "2026-10-14T13:00:00Z", outcome: "LOST" },
    ]);
    const stats = await read(statsQuery({ name: "jans" }), store);
    expect(stats.total).toBe(2);
    expect(stats.rounds.map((r) => r.name)).toEqual(["P. JANSSEN", "A. Jansen"]);
    expect(stats.names.map((s) => s.name)).toEqual(["A. Jansen", "P. JANSSEN"]);
    expect(stats.totals.played).toBe(2);

    expect((await read(statsQuery({ name: "xyz" }), store)).total).toBe(0);
  });

  it("sorteert de speelrondes op elke kolom", async () => {
    const store = await storeWith([
      { at: "2026-10-14T10:00:00Z", outcome: "LOST", name: "Cees" },
      { at: "2026-10-14T11:00:00Z", outcome: "WON vraagteken", name: "anna" },
      { at: "2026-10-14T12:00:00Z", outcome: "WON shot" },
      { at: "2026-10-14T13:00:00Z", outcome: "WON kakkerlak", name: "Bob" },
    ]);
    const sorted = async (column: RoundColumn, dir: SortDir) => {
      const query = statsQuery();
      const stats = await read({ ...query, rounds: { page: 1, sort: { column, dir } } }, store);
      return stats.rounds.map((r) => r.name);
    };
    expect(await sorted("datum", "asc")).toEqual(["Cees", "anna", null, "Bob"]);
    expect(await sorted("naam", "asc")).toEqual(["anna", "Bob", "Cees", null]);
    expect(await sorted("naam", "desc")).toEqual(["Cees", "Bob", "anna", null]);
    // uitkomst in de volgorde van de enum: shot, kakkerlak, vraagteken, verloren
    expect(await sorted("uitkomst", "asc")).toEqual([null, "Bob", "anna", "Cees"]);
    // gewonnen met 1 poging, verloren met 3; bij gelijke waarden de nieuwste eerst
    expect(await sorted("pogingen", "desc")).toEqual(["Cees", "Bob", null, "anna"]);
  });

  it("verdeelt rondes en namen over pagina's van 15; een pagina voorbij het einde wordt de laatste", async () => {
    const rounds = Array.from({ length: ROWS_PER_PAGE + 3 }, (_, i) => ({
      at: new Date(Date.UTC(2026, 9, 14, 10, i)).toISOString(),
      outcome: "LOST" as const,
      name: `Speler ${String(i).padStart(2, "0")}`,
    }));
    const store = await storeWith(rounds);

    const page1 = await read(statsQuery(), store);
    expect(page1.roundPages).toBe(2);
    expect(page1.rounds).toHaveLength(ROWS_PER_PAGE);
    expect(page1.rounds[0].name).toBe("Speler 17");
    expect(page1.nameCount).toBe(ROWS_PER_PAGE + 3);
    expect(page1.namePages).toBe(2);
    expect(page1.names).toHaveLength(ROWS_PER_PAGE);
    // Totaal telt alle namen, niet alleen die op de pagina
    expect(page1.totals.played).toBe(ROWS_PER_PAGE + 3);

    const page2 = await read(statsQuery({ roundPage: 2, namePage: 2 }), store);
    expect(page2.rounds.map((r) => r.name)).toEqual(["Speler 02", "Speler 01", "Speler 00"]);
    expect(page2.names.map((s) => s.name)).toEqual(["Speler 15", "Speler 16", "Speler 17"]);

    const tooFar = await read(statsQuery({ roundPage: 9, namePage: 9 }), store);
    expect(tooFar.query.rounds.page).toBe(2);
    expect(tooFar.query.names.page).toBe(2);
    expect(tooFar.rounds).toEqual(page2.rounds);
  });

  it("zonder rondes: ok met één lege pagina", async () => {
    const stats = await read(statsQuery({ period: "vandaag", roundPage: 3 }), memoryGameStore());
    expect(stats).toMatchObject({ total: 0, roundPages: 1, rounds: [], nameCount: 0, namePages: 1, names: [] });
    expect(stats.query.rounds.page).toBe(1);
  });

  it("geeft periode, naam en sortering door aan de opslag", async () => {
    const store = memoryGameStore();
    const countRounds = vi.spyOn(store, "countRounds");
    const listRounds = vi.spyOn(store, "listRounds");
    await readGameStats(statsQuery({ period: "vandaag", name: "jan" }), store, NOW);
    const filter = { since: new Date("2026-10-13T22:00:00Z"), name: "jan" };
    expect(countRounds).toHaveBeenCalledWith(filter);
    expect(listRounds).toHaveBeenCalledWith(filter, { column: "datum", dir: "desc" }, 0, ROWS_PER_PAGE);

    await readGameStats(statsQuery(), store, NOW);
    expect(countRounds).toHaveBeenLastCalledWith({ since: null, name: "" });
  });

  it("een databasefout of time-out geeft error (met een waarschuwing)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing: GameStore = { ...memoryGameStore(), countRounds: () => Promise.reject(new Error("kapot")) };
    expect(await readGameStats(statsQuery(), failing, NOW)).toEqual({ status: "error" });

    const slow: GameStore = { ...memoryGameStore(), countByName: () => new Promise(() => {}) };
    expect(await readGameStats(statsQuery(), slow, NOW, 10)).toEqual({ status: "error" });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
