// Speelrondes en statistieken per naam voor de game-manager (taak 13, sorteren/filteren taak 14).
// Alleen op de server, en alleen na checkAdmin (src/app/game-manager/page.tsx).
import { DB_TIMEOUT_MS, withTimeout } from "@/lib/db";
import { SYMBOL_NAMES, type SymbolName } from "@/lib/game";
import { getGameStore, type GameStore, type OutcomeCount, type PlayedRound } from "@/lib/gameStore";
import type { NameColumn, Period, StatsQuery } from "@/lib/managerQuery";
import { clampPage, compareValues, pageCount, pageSlice, ROWS_PER_PAGE, sortRows, type Sort, type SortValue } from "@/lib/tables";

export const TIME_ZONE = "Europe/Amsterdam";

// Verschil tussen de kloktijd in `timeZone` en UTC op dat moment, in ms
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

// 00:00 vandaag in Nederland (ook op de dagen dat de zomertijd begint of eindigt)
export function startOfDay(now: Date, timeZone = TIME_ZONE): Date {
  const local = new Date(now.getTime() + offsetMs(now, timeZone));
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  // Eerst met de offset van nu, daarna met die van middernacht zelf
  const guess = midnight - offsetMs(now, timeZone);
  return new Date(midnight - offsetMs(new Date(guess), timeZone));
}

export const sinceFor = (period: Period, now: Date): Date | null => (period === "vandaag" ? startOfDay(now) : null);

// Wins en verlies van één naam (name null: gratis gespeeld of naam onbekend)
export interface NameStats {
  name: string | null;
  played: number;
  won: Record<SymbolName, number>;
  wonTotal: number;
  lost: number;
}

const emptyStats = (name: string | null): NameStats => ({
  name,
  played: 0,
  won: Object.fromEntries(SYMBOL_NAMES.map((symbol) => [symbol, 0])) as Record<SymbolName, number>,
  wonTotal: 0,
  lost: 0,
});

// Tellingen per naam en uitkomst → één regel per naam, op naam (A-Z); zonder naam onderaan
export function buildNameStats(counts: OutcomeCount[]): NameStats[] {
  const stats = new Map<string | null, NameStats>();
  for (const { name, outcome, count } of counts) {
    const entry = stats.get(name) ?? emptyStats(name);
    entry.played += count;
    if (outcome === "LOST") entry.lost += count;
    else {
      entry.won[outcome.slice("WON ".length) as SymbolName] += count;
      entry.wonTotal += count;
    }
    stats.set(name, entry);
  }
  return sortNameStats([...stats.values()], { column: "naam", dir: "asc" });
}

// Alle namen samen, voor de regel Totaal
export function totalStats(stats: NameStats[]): NameStats {
  const total = emptyStats("Totaal");
  for (const s of stats) {
    total.played += s.played;
    total.wonTotal += s.wonTotal;
    total.lost += s.lost;
    for (const symbol of SYMBOL_NAMES) total.won[symbol] += s.won[symbol];
  }
  return total;
}

// Waarde van een kolom in de tabel Per naam
function nameValue(stats: NameStats, column: NameColumn): SortValue {
  if (column === "naam") return stats.name;
  if (column === "gespeeld") return stats.played;
  if (column === "gewonnen") return stats.wonTotal;
  if (column === "verloren") return stats.lost;
  return stats.won[column];
}

// Gesorteerd op de kolom; bij gelijke waarden op naam (A-Z, zonder naam onderaan)
export function sortNameStats(stats: NameStats[], sort: Sort<NameColumn>): NameStats[] {
  return sortRows(stats, sort, nameValue, (a, b) => compareValues(a.name, b.name, "asc"));
}

export type GameStats =
  | {
      status: "ok";
      query: StatsQuery; // met de pagina's die echt getoond worden
      total: number; // aantal rondes in de periode (met de naam)
      roundPages: number;
      rounds: PlayedRound[]; // deze pagina
      nameCount: number; // aantal namen (regels in Per naam)
      namePages: number;
      names: NameStats[]; // deze pagina
      totals: NameStats; // alle namen samen, niet alleen deze pagina
    }
  | { status: "no-database" }
  | { status: "error" };

// Overzicht voor de game-manager. Een pagina voorbij het einde toont de laatste pagina.
export async function readGameStats(
  query: StatsQuery,
  store: GameStore | null = getGameStore(),
  now: Date = new Date(),
  timeoutMs = DB_TIMEOUT_MS,
): Promise<GameStats> {
  if (!store) return { status: "no-database" };
  const filter = { since: sinceFor(query.period, now), name: query.name };
  try {
    const [total, counts] = await withTimeout(Promise.all([store.countRounds(filter), store.countByName(filter)]), timeoutMs);
    const roundPage = clampPage(query.rounds.page, total);
    const rounds = await withTimeout(
      store.listRounds(filter, query.rounds.sort, (roundPage - 1) * ROWS_PER_PAGE, ROWS_PER_PAGE),
      timeoutMs,
    );
    const names = buildNameStats(counts);
    const namePage = clampPage(query.names.page, names.length);
    return {
      status: "ok",
      query: { ...query, names: { ...query.names, page: namePage }, rounds: { ...query.rounds, page: roundPage } },
      total,
      roundPages: pageCount(total),
      rounds,
      nameCount: names.length,
      namePages: pageCount(names.length),
      names: pageSlice(sortNameStats(names, query.names.sort), namePage),
      totals: totalStats(names),
    };
  } catch (error) {
    console.warn("Speelrondes niet uit de database gelezen:", error);
    return { status: "error" };
  }
}
