import Link from "next/link";
import { SYMBOL_NAMES } from "@/lib/game";
import type { GameOutcome } from "@/lib/gameStore";
import { readGameStats, type NameStats } from "@/lib/gameStats";
import {
  managerHref,
  managerParams,
  withNames,
  withRounds,
  withStats,
  type ManagerQuery,
  type NameColumn,
  type Period,
  type RoundColumn,
} from "@/lib/managerQuery";
import { formatDateTime, NameFilter, NO_NAME, Pagination, SortHeader } from "./TableParts";
import styles from "./game-manager.module.css";

const outcomeLabel = (outcome: GameOutcome) => (outcome === "LOST" ? "Verloren" : `Gewonnen: ${outcome.slice("WON ".length)}`);

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);

const PERIODS: { period: Period; label: string }[] = [
  { period: "vandaag", label: "Vandaag" },
  { period: "alles", label: "Alles" },
];

const NAME_HEADERS: { column: NameColumn; label: string }[] = [
  { column: "naam", label: "Naam" },
  { column: "gespeeld", label: "Gespeeld" },
  ...SYMBOL_NAMES.map((symbol) => ({ column: symbol, label: capitalize(symbol) })),
  { column: "gewonnen", label: "Gewonnen" },
  { column: "verloren", label: "Verloren" },
];

const ROUND_HEADERS: { column: RoundColumn; label: string }[] = [
  { column: "datum", label: "Datum" },
  { column: "naam", label: "Naam" },
  { column: "uitkomst", label: "Uitkomst" },
  { column: "pogingen", label: "Pogingen" },
];

function PeriodLinks({ query }: { query: ManagerQuery }) {
  return (
    <nav className={styles.levels} aria-label="Periode">
      {PERIODS.map(({ period, label }) => (
        <Link
          key={period}
          href={managerHref(withStats(query, { period }))}
          scroll={false}
          className={`${styles.button} ${styles.secondary}`}
          aria-current={period === query.stats.period ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function StatsRow({ stats }: { stats: NameStats }) {
  return (
    <tr>
      <th scope="row">{stats.name ?? <span className={styles.muted}>{NO_NAME}</span>}</th>
      <td>{stats.played}</td>
      {SYMBOL_NAMES.map((symbol) => (
        <td key={symbol}>{stats.won[symbol]}</td>
      ))}
      <td>{stats.wonTotal}</td>
      <td>{stats.lost}</td>
    </tr>
  );
}

export default async function StatsSection({ query }: { query: ManagerQuery }) {
  const stats = await readGameStats(query.stats);

  if (stats.status !== "ok") {
    return (
      <section className={styles.card} aria-labelledby="speelrondes-titel">
        <h2 id="speelrondes-titel">Speelrondes en statistieken</h2>
        <p className={styles.error} role="alert">
          {stats.status === "no-database"
            ? "Er is geen database ingesteld (DATABASE_URL): er zijn geen speelrondes om te tonen."
            : "De database is nu niet bereikbaar: de speelrondes kunnen niet getoond worden. Probeer het later opnieuw."}
        </p>
      </section>
    );
  }

  // Met de pagina's die echt getoond worden (een pagina voorbij het einde wordt de laatste)
  const shown: ManagerQuery = { ...query, stats: stats.query };
  const { name, period } = stats.query;

  return (
    <section className={styles.card} aria-labelledby="speelrondes-titel">
      <h2 id="speelrondes-titel">Speelrondes en statistieken</h2>
      <div className={styles.stats}>
        <div className={styles.toolbar}>
          <PeriodLinks query={shown} />
          <NameFilter
            id="speelrondes-naam"
            param="naam"
            value={name}
            keep={managerParams(withStats(shown, { name: "" }))}
            clearHref={managerHref(withStats(shown, { name: "" }))}
          />
        </div>
        {stats.total === 0 ? (
          <p className={styles.muted}>
            {name
              ? `Geen speelrondes met een naam die "${name}" bevat${period === "vandaag" ? " (vandaag)" : ""}.`
              : period === "vandaag"
                ? "Vandaag is er nog niet gespeeld."
                : "Er is nog niet gespeeld."}
          </p>
        ) : (
          <>
            <h3 id="per-naam">
              Per naam <span className={styles.muted}>({stats.nameCount})</span>
            </h3>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-labelledby="per-naam">
                <thead>
                  <tr>
                    {NAME_HEADERS.map(({ column, label }) => (
                      <SortHeader
                        key={column}
                        column={column}
                        label={label}
                        sort={stats.query.names.sort}
                        href={(sort) => managerHref(withNames(shown, { sort, page: 1 }))}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.names.map((s) => (
                    <StatsRow key={s.name ?? ""} stats={s} />
                  ))}
                </tbody>
                {stats.nameCount > 1 && (
                  <tfoot>
                    <StatsRow stats={stats.totals} />
                  </tfoot>
                )}
              </table>
            </div>
            <Pagination
              label="Pagina's per naam"
              page={stats.query.names.page}
              pageCount={stats.namePages}
              href={(page) => managerHref(withNames(shown, { page }))}
            />

            <h3 id="rondes">
              Speelrondes <span className={styles.muted}>({stats.total})</span>
            </h3>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-labelledby="rondes">
                <thead>
                  <tr>
                    {ROUND_HEADERS.map(({ column, label }) => (
                      <SortHeader
                        key={column}
                        column={column}
                        label={label}
                        sort={stats.query.rounds.sort}
                        href={(sort) => managerHref(withRounds(shown, { sort, page: 1 }))}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.rounds.map((round) => (
                    <tr key={round.id}>
                      <td>{formatDateTime(round.playedAt)}</td>
                      <td>{round.name ?? <span className={styles.muted}>{NO_NAME}</span>}</td>
                      <td>{outcomeLabel(round.outcome)}</td>
                      <td>{round.tries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              label="Pagina's speelrondes"
              page={stats.query.rounds.page}
              pageCount={stats.roundPages}
              href={(page) => managerHref(withRounds(shown, { page }))}
            />
          </>
        )}
      </div>
    </section>
  );
}
