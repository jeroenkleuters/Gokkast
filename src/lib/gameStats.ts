// Speelrondes en statistieken per naam voor de game-manager (taak 13). Alleen op de server,
// en alleen na checkAdmin (src/app/game-manager/page.tsx).
import { DB_TIMEOUT_MS, withTimeout } from "@/lib/db";
import { SYMBOL_NAMES, type SymbolName } from "@/lib/game";
import { getGameStore, type GameStore, type OutcomeCount, type PlayedRound } from "@/lib/gameStore";

export const ROUNDS_PER_PAGE = 25;
export const TIME_ZONE = "Europe/Amsterdam";

export type Period = "vandaag" | "alles";

// Uit de URL van de game-manager: ?periode=vandaag&pagina=2
export interface StatsQuery {
  period: Period;
  page: number; // vanaf 1
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Onbekende of ongeldige waarden → alles, pagina 1
export function parseStatsQuery(params: SearchParams): StatsQuery {
  const period = first(params.periode) === "vandaag" ? "vandaag" : "alles";
  const page = Number(first(params.pagina));
  return { period, page: Number.isSafeInteger(page) && page >= 1 ? page : 1 };
}

// Link naar een andere periode of pagina; standaardwaarden blijven uit de URL
export function statsHref({ period, page }: StatsQuery): string {
  const params = new URLSearchParams();
  if (period !== "alles") params.set("periode", period);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return `/game-manager${query ? `?${query}` : ""}#speelrondes`;
}

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

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / ROUNDS_PER_PAGE));

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

const byName = new Intl.Collator("nl", { sensitivity: "base", numeric: true });

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
  return [...stats.values()].sort((a, b) => {
    if (a.name === null || b.name === null) return a.name === null ? (b.name === null ? 0 : 1) : -1;
    return byName.compare(a.name, b.name) || a.name.localeCompare(b.name);
  });
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

export type GameStats =
  | {
      status: "ok";
      query: StatsQuery; // met de pagina die echt getoond wordt
      total: number; // aantal rondes in de periode
      pageCount: number;
      rounds: PlayedRound[];
      names: NameStats[];
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
  const since = sinceFor(query.period, now);
  try {
    const [total, counts] = await withTimeout(Promise.all([store.countRounds(since), store.countByName(since)]), timeoutMs);
    const pages = pageCount(total);
    const page = Math.min(query.page, pages);
    const rounds = await withTimeout(store.listRounds(since, (page - 1) * ROUNDS_PER_PAGE, ROUNDS_PER_PAGE), timeoutMs);
    return { status: "ok", query: { ...query, page }, total, pageCount: pages, rounds, names: buildNameStats(counts) };
  } catch (error) {
    console.warn("Speelrondes niet uit de database gelezen:", error);
    return { status: "error" };
  }
}
