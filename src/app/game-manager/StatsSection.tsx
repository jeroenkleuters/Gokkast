import Link from "next/link";
import { SYMBOL_NAMES } from "@/lib/game";
import type { GameOutcome } from "@/lib/gameStore";
import { readGameStats, statsHref, totalStats, TIME_ZONE, type NameStats, type Period, type StatsQuery } from "@/lib/gameStats";
import styles from "./game-manager.module.css";

const NO_NAME = "Zonder naam";

const dateTime = new Intl.DateTimeFormat("nl-NL", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });

const outcomeLabel = (outcome: GameOutcome) => (outcome === "LOST" ? "Verloren" : `Gewonnen: ${outcome.slice("WON ".length)}`);

const PERIODS: { period: Period; label: string }[] = [
  { period: "vandaag", label: "Vandaag" },
  { period: "alles", label: "Alles" },
];

function PeriodLinks({ current }: { current: Period }) {
  return (
    <nav className={styles.levels} aria-label="Periode">
      {PERIODS.map(({ period, label }) => (
        <Link
          key={period}
          href={statsHref({ period, page: 1 })}
          className={`${styles.button} ${styles.secondary}`}
          aria-current={period === current ? "page" : undefined}
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

function NameStatsTable({ names }: { names: NameStats[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-labelledby="per-naam">
        <thead>
          <tr>
            <th scope="col">Naam</th>
            <th scope="col">Gespeeld</th>
            {SYMBOL_NAMES.map((symbol) => (
              <th scope="col" key={symbol}>
                {symbol[0].toUpperCase() + symbol.slice(1)}
              </th>
            ))}
            <th scope="col">Gewonnen</th>
            <th scope="col">Verloren</th>
          </tr>
        </thead>
        <tbody>
          {names.map((stats) => (
            <StatsRow key={stats.name ?? ""} stats={stats} />
          ))}
        </tbody>
        {names.length > 1 && (
          <tfoot>
            <StatsRow stats={totalStats(names)} />
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Pagination({ query, pageCount }: { query: StatsQuery; pageCount: number }) {
  if (pageCount <= 1) return null;
  const { page } = query;
  return (
    <nav className={styles.pagination} aria-label="Pagina's speelrondes">
      {page > 1 ? (
        <Link href={statsHref({ ...query, page: page - 1 })} className={`${styles.button} ${styles.secondary}`}>
          Vorige
        </Link>
      ) : (
        <span />
      )}
      <span className={styles.muted}>
        Pagina {page} van {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={statsHref({ ...query, page: page + 1 })} className={`${styles.button} ${styles.secondary}`}>
          Volgende
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export default async function StatsSection({ query }: { query: StatsQuery }) {
  const stats = await readGameStats(query);

  return (
    <section className={styles.card} id="speelrondes" aria-labelledby="speelrondes-titel">
      <h2 id="speelrondes-titel">Speelrondes en statistieken</h2>
      {stats.status === "no-database" ? (
        <p className={styles.error} role="alert">
          Er is geen database ingesteld (DATABASE_URL): er zijn geen speelrondes om te tonen.
        </p>
      ) : stats.status === "error" ? (
        <p className={styles.error} role="alert">
          De database is nu niet bereikbaar: de speelrondes kunnen niet getoond worden. Probeer het later opnieuw.
        </p>
      ) : (
        <div className={styles.stats}>
          <PeriodLinks current={stats.query.period} />
          {stats.total === 0 ? (
            <p className={styles.muted}>
              {stats.query.period === "vandaag" ? "Vandaag is er nog niet gespeeld." : "Er is nog niet gespeeld."}
            </p>
          ) : (
            <>
              <h3 id="per-naam">Per naam</h3>
              <NameStatsTable names={stats.names} />

              <h3 id="rondes">
                Speelrondes <span className={styles.muted}>({stats.total})</span>
              </h3>
              <div className={styles.tableWrap}>
                <table className={styles.table} aria-labelledby="rondes">
                  <thead>
                    <tr>
                      <th scope="col">Datum</th>
                      <th scope="col">Naam</th>
                      <th scope="col">Uitkomst</th>
                      <th scope="col">Pogingen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rounds.map((round) => (
                      <tr key={round.id}>
                        <td>{dateTime.format(round.playedAt)}</td>
                        <td>{round.name ?? <span className={styles.muted}>{NO_NAME}</span>}</td>
                        <td>{outcomeLabel(round.outcome)}</td>
                        <td>{round.tries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination query={stats.query} pageCount={stats.pageCount} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
