// Gespeelde rondes opslaan in de tabel games (alleen op de server, via src/app/actions.ts).
// De invoer komt uit de browser en is dus niet te vertrouwen: alles wordt hier gecontroleerd.
import type { GameOutcome as DbGameOutcome } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import type { SymbolName } from "@/lib/game";
import { memoryStoreAllowed } from "@/lib/payments";
import { prizeSummary, type PrizeSummary } from "@/lib/prizes";
import { loadSettings } from "@/lib/settingsStore";

// Bij winst met het gewonnen plaatje, bijv. "WON shot"
export type GameOutcome = `WON ${SymbolName}` | "LOST";

// Uitkomst → waarde van de Prisma-enum (in de database staat de uitkomst zelf, zie schema.prisma)
const DB_OUTCOMES: Record<GameOutcome, DbGameOutcome> = {
  "WON shot": "WON_SHOT",
  "WON kakkerlak": "WON_KAKKERLAK",
  "WON vraagteken": "WON_VRAAGTEKEN",
  LOST: "LOST",
};

const FROM_DB = Object.fromEntries(Object.entries(DB_OUTCOMES).map(([outcome, db]) => [db, outcome])) as Record<
  DbGameOutcome,
  GameOutcome
>;

const isGameOutcome = (value: unknown): value is GameOutcome => typeof value === "string" && Object.hasOwn(DB_OUTCOMES, value);

export interface GameResult {
  outcome: GameOutcome;
  tries: number; // gebruikte pogingen
}

// { outcome, tries } van de browser → GameResult, of null als het niet klopt.
// Verloren kan alleen na alle pogingen; gewonnen (met plaatje) na 1 t/m maxTries pogingen.
export function parseGameResult(input: unknown, maxTries: number): GameResult | null {
  if (typeof input !== "object" || input === null) return null;
  const { outcome, tries } = input as Record<string, unknown>;
  if (!isGameOutcome(outcome)) return null;
  if (!Number.isInteger(tries) || (tries as number) < 1 || (tries as number) > maxTries) return null;
  if (outcome === "LOST" && tries !== maxTries) return null;
  return { outcome, tries: tries as number };
}

// De betaling waarmee de ronde gespeeld is: de naam van de rekeninghouder komt bij de ronde
export interface GamePayment {
  id: number;
  name: string | null;
}

// Eén gespeelde ronde voor het overzicht in de game-manager (taak 13)
export interface PlayedRound extends GameResult {
  id: number;
  name: string | null; // null: gratis gespeeld of naam onbekend
  playedAt: Date;
}

// Aantal rondes met deze naam en uitkomst
export interface OutcomeCount {
  name: string | null;
  outcome: GameOutcome;
  count: number;
}

export interface GameStore {
  create(result: GameResult, payment: GamePayment | null): Promise<unknown>;
  // Uitkomsten van de rondes die met een betaling gespeeld zijn
  outcomes(paymentId: number): Promise<GameOutcome[]>;
  // Voor de game-manager: rondes gespeeld vanaf `since` (null: alle)
  countRounds(since: Date | null): Promise<number>;
  listRounds(since: Date | null, skip: number, take: number): Promise<PlayedRound[]>; // nieuwste eerst
  countByName(since: Date | null): Promise<OutcomeCount[]>;
}

const sinceWhere = (since: Date | null) => (since ? { playedAt: { gte: since } } : {});

export function prismaGameStore(db: PrismaClient): GameStore {
  return {
    create: (result, payment) =>
      db.game.create({
        data: {
          ...result,
          outcome: DB_OUTCOMES[result.outcome],
          ...(payment && { paymentId: payment.id, name: payment.name }),
        },
      }),
    async outcomes(paymentId) {
      const rows = await db.game.findMany({ where: { paymentId }, select: { outcome: true } });
      return rows.map((row) => FROM_DB[row.outcome]);
    },
    countRounds: (since) => db.game.count({ where: sinceWhere(since) }),
    async listRounds(since, skip, take) {
      const rows = await db.game.findMany({
        where: sinceWhere(since),
        orderBy: [{ playedAt: "desc" }, { id: "desc" }],
        skip,
        take,
        select: { id: true, name: true, outcome: true, tries: true, playedAt: true },
      });
      return rows.map((row) => ({ ...row, outcome: FROM_DB[row.outcome] }));
    },
    async countByName(since) {
      const groups = await db.game.groupBy({ by: ["name", "outcome"], where: sinceWhere(since), _count: { _all: true } });
      return groups.map((g) => ({ name: g.name, outcome: FROM_DB[g.outcome], count: g._count._all }));
    },
  };
}

// Voor de Playwright-tests zonder database (zelfde voorwaarde als de geheugenopslag van betalingen)
export function memoryGameStore(now: () => Date = () => new Date()): GameStore {
  const games: (PlayedRound & { paymentId: number | null })[] = [];
  const since = (from: Date | null) => games.filter((g) => !from || g.playedAt >= from);
  return {
    async create(result, payment) {
      games.push({ ...result, id: games.length + 1, name: payment?.name ?? null, playedAt: now(), paymentId: payment?.id ?? null });
    },
    outcomes: async (paymentId) => games.filter((g) => g.paymentId === paymentId).map((g) => g.outcome),
    countRounds: async (from) => since(from).length,
    listRounds: async (from, skip, take) =>
      since(from)
        .toSorted((a, b) => b.playedAt.getTime() - a.playedAt.getTime() || b.id - a.id)
        .slice(skip, skip + take)
        .map(({ id, name, outcome, tries, playedAt }) => ({ id, name, outcome, tries, playedAt })),
    async countByName(from) {
      const counts = new Map<string, OutcomeCount>();
      for (const g of since(from)) {
        const key = JSON.stringify([g.name, g.outcome]);
        const entry = counts.get(key) ?? { name: g.name, outcome: g.outcome, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
      return [...counts.values()];
    },
  };
}

const globalForStore = globalThis as unknown as { memoryGameStore?: GameStore };

// De database; zonder database alleen de geheugenopslag als die mag (tests); anders null
export function getGameStore(): GameStore | null {
  const db = getDb();
  if (db) return prismaGameStore(db);
  if (!memoryStoreAllowed()) return null;
  globalForStore.memoryGameStore ??= memoryGameStore();
  return globalForStore.memoryGameStore;
}

export interface SaveGameDeps {
  maxTries(): Promise<number>;
  create: GameStore["create"] | null; // null: geen database
  outcomes?: GameStore["outcomes"];
}

function defaultDeps(): SaveGameDeps {
  const store = getGameStore();
  return {
    maxTries: async () => (await loadSettings()).maxTries,
    create: store && store.create,
    outcomes: store?.outcomes,
  };
}

// true als de ronde is opgeslagen. Ongeldige invoer, geen database of een databasefout
// geeft false (met een waarschuwing in de serverlog); het spel gaat gewoon door.
export async function saveGameResult(
  input: unknown,
  payment: GamePayment | null = null,
  deps: SaveGameDeps = defaultDeps(),
): Promise<boolean> {
  if (!deps.create) return false;
  try {
    const result = parseGameResult(input, await deps.maxTries());
    if (!result) {
      console.warn("Ronde niet opgeslagen, ongeldige invoer:", input);
      return false;
    }
    await deps.create(result, payment);
    return true;
  } catch (error) {
    console.warn("Ronde niet opgeslagen:", error);
    return false;
  }
}

// De betaalde betaling van de speler op het moment dat een ronde klaar is
export interface PaidGame extends GamePayment {
  credits: number; // spelletjes voor de betaling
  creditsLeft: number; // 0: dit was het laatste spelletje
}

export interface FinishedGame {
  saved: boolean;
  prizes: PrizeSummary | null; // alleen na het laatste spelletje, en alleen als er gewonnen is
}

// Ronde opslaan aan het eind van een spel. Met een betaling: nooit meer rondes dan er spelletjes
// betaald zijn (de uitkomst komt uit de browser), en na het laatste spelletje het prijzenoverzicht.
export async function finishGame(
  input: unknown,
  payment: PaidGame | null,
  deps: SaveGameDeps = defaultDeps(),
): Promise<FinishedGame> {
  if (!payment || !deps.outcomes) return { saved: await saveGameResult(input, payment, deps), prizes: null };
  try {
    const earlier = await deps.outcomes(payment.id);
    if (earlier.length >= payment.credits) {
      console.warn(`Ronde niet opgeslagen: betaling ${payment.id} heeft al ${earlier.length} rondes.`);
      return { saved: false, prizes: null };
    }
    const saved = await saveGameResult(input, payment, deps);
    if (!saved || payment.creditsLeft > 0) return { saved, prizes: null };
    // saveGameResult heeft de invoer gecontroleerd
    return { saved, prizes: prizeSummary(payment, [...earlier, (input as GameResult).outcome]) };
  } catch (error) {
    console.warn("Rondes van de betaling niet gelezen:", error);
    return { saved: false, prizes: null };
  }
}
