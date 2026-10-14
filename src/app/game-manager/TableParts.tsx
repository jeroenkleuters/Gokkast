// Onderdelen van de tabellen in de game-manager (taak 14): sorteerbare kolomkoppen, bladeren en
// het filter op naam. Alles via links en een GET-formulier: de server sorteert en filtert, de
// URL onthoudt het. scroll={false}: de pagina blijft staan waar hij was.
import Form from "next/form";
import Link from "next/link";
import { TIME_ZONE } from "@/lib/gameStats";
import { firstDir, MANAGER_PATH } from "@/lib/managerQuery";
import { MAX_FILTER_LENGTH, nextSort, type Sort } from "@/lib/tables";
import styles from "./game-manager.module.css";

const dateTime = new Intl.DateTimeFormat("nl-NL", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
export const formatDateTime = (date: Date) => dateTime.format(date);

export const NO_NAME = "Zonder naam";

// Kolomkop met een link die op deze kolom sorteert (nog een keer klikken: andere volgorde).
// Het pijltje komt uit de CSS (aria-sort), zodat de tekst van de kop gewoon de naam blijft.
export function SortHeader<C extends string>({
  column,
  label,
  sort,
  href,
}: {
  column: C;
  label: string;
  sort: Sort<C>;
  href: (sort: Sort<C>) => string;
}) {
  const active = sort.column === column;
  const next = nextSort(sort, column, firstDir(column));
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={href(next)}
        scroll={false}
        className={styles.sortLink}
        title={`Sorteer op ${label.toLowerCase()} (${next.dir === "asc" ? "oplopend" : "aflopend"})`}
      >
        {label}
      </Link>
    </th>
  );
}

export function Pagination({
  label,
  page,
  pageCount,
  href,
}: {
  label: string;
  page: number;
  pageCount: number;
  href: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className={styles.pagination} aria-label={label}>
      {page > 1 ? (
        <Link href={href(page - 1)} scroll={false} className={`${styles.button} ${styles.secondary}`}>
          Vorige
        </Link>
      ) : (
        <span />
      )}
      <span className={styles.muted}>
        Pagina {page} van {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} scroll={false} className={`${styles.button} ${styles.secondary}`}>
          Volgende
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

// Zoeken op (een deel van) de naam. De andere parameters gaan als verborgen velden mee,
// zodat de andere tabellen hun pagina en sortering houden.
export function NameFilter({
  id,
  param,
  value,
  keep,
  clearHref,
}: {
  id: string;
  param: string;
  value: string;
  keep: [string, string][]; // zonder `param`
  clearHref: string;
}) {
  return (
    <Form action={MANAGER_PATH} scroll={false} className={styles.filter} role="search" aria-label="Filter op naam">
      {keep.map(([name, v]) => (
        <input key={name} type="hidden" name={name} value={v} />
      ))}
      <label htmlFor={id}>Naam bevat</label>
      {/* key: na "Wissen" of een andere zoektekst het veld opnieuw vullen */}
      <input key={value} id={id} name={param} type="search" defaultValue={value} className={styles.input} maxLength={MAX_FILTER_LENGTH} />
      <button type="submit" className={`${styles.button} ${styles.secondary}`}>
        Filteren
      </button>
      {value && (
        <Link href={clearHref} scroll={false} className={styles.link}>
          Wissen
        </Link>
      )}
    </Form>
  );
}
