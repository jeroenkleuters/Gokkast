// Betalingen in de game-manager (taak 14). Het rekeningnummer wordt hier op de server ontsleuteld,
// alleen voor de beheerder (page.tsx doet checkAdmin).
import { managerHref, managerParams, withPayments, type ManagerQuery, type PaymentColumn } from "@/lib/managerQuery";
import { formatIban, readPaymentOverview, STATUS_LABELS, type Account } from "@/lib/paymentOverview";
import { formatEuro } from "@/lib/payments";
import { PAYMENT_PROVIDER_LABELS } from "@/lib/settings";
import { formatDateTime, NameFilter, NO_NAME, Pagination, SortHeader } from "./TableParts";
import styles from "./game-manager.module.css";

const HEADERS: { column: PaymentColumn; label: string }[] = [
  { column: "datum", label: "Datum" },
  { column: "naam", label: "Naam" },
  { column: "methode", label: "Methode" },
  { column: "rekeningnummer", label: "Rekeningnummer" },
  { column: "bedrag", label: "Bedrag" },
  { column: "status", label: "Status" },
  { column: "spelletjes", label: "Gespeeld" },
];

function AccountCell({ account }: { account: Account }) {
  if (account.kind === "ok") return <td className={styles.mono}>{formatIban(account.iban)}</td>;
  const text = account.kind === "none" ? "—" : account.kind === "no-key" ? "Geen sleutel" : "Niet te ontsleutelen";
  return (
    <td>
      <span className={styles.muted}>{text}</span>
    </td>
  );
}

export default async function PaymentsSection({ query }: { query: ManagerQuery }) {
  const overview = await readPaymentOverview(query.payments);

  if (overview.status !== "ok") {
    return (
      <section className={styles.card} aria-labelledby="betalingen-titel">
        <h2 id="betalingen-titel">Betalingen</h2>
        <p className={styles.error} role="alert">
          {overview.status === "no-database"
            ? "Er is geen database ingesteld (DATABASE_URL): er zijn geen betalingen om te tonen."
            : "De database is nu niet bereikbaar: de betalingen kunnen niet getoond worden. Probeer het later opnieuw."}
        </p>
      </section>
    );
  }

  const shown = withPayments(query, overview.query);
  const { name, sort, page } = overview.query;
  const cleared = withPayments(shown, { name: "", page: 1 });

  return (
    <section className={styles.card} aria-labelledby="betalingen-titel">
      <h2 id="betalingen-titel">Betalingen</h2>
      <div className={styles.stats}>
        <NameFilter
          id="betalingen-naam"
          param="betalingen_naam"
          value={name}
          keep={managerParams(cleared)}
          clearHref={managerHref(cleared)}
        />
        {overview.keyMissing && (
          <p className={styles.error} role="alert">
            Er is geen geldige sleutel ingesteld (PAYMENT_ENCRYPTION_KEY): de rekeningnummers kunnen niet getoond
            worden.
          </p>
        )}
        {overview.total === 0 ? (
          <p className={styles.muted}>
            {name ? `Geen betalingen met een naam die "${name}" bevat.` : "Er is nog niet betaald."}
          </p>
        ) : (
          <>
            <p className={styles.muted}>{overview.total === 1 ? "1 betaling" : `${overview.total} betalingen`}</p>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-label="Betalingen">
                <thead>
                  <tr>
                    {HEADERS.map(({ column, label }) => (
                      <SortHeader
                        key={column}
                        column={column}
                        label={label}
                        sort={sort}
                        href={(next) => managerHref(withPayments(shown, { sort: next, page: 1 }))}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.name ?? <span className={styles.muted}>{NO_NAME}</span>}</td>
                      <td>{PAYMENT_PROVIDER_LABELS[row.provider]}</td>
                      <AccountCell account={row.account} />
                      <td>{formatEuro(row.amountCents)}</td>
                      <td>{STATUS_LABELS[row.status]}</td>
                      <td>
                        {row.played} van {row.credits}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              label="Pagina's betalingen"
              page={page}
              pageCount={overview.pageCount}
              href={(p) => managerHref(withPayments(shown, { page: p }))}
            />
          </>
        )}
      </div>
    </section>
  );
}
