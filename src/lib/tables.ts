// Tabellen in de game-manager (taak 14): pagina's van 15 rijen, sorteren op elke kolom en
// filteren op naam. Zonder database of netwerk, dus ook in de browser te gebruiken.

export const ROWS_PER_PAGE = 15;
export const MAX_FILTER_LENGTH = 100;

export type SortDir = "asc" | "desc";

export interface Sort<C extends string> {
  column: C;
  dir: SortDir;
}

export interface TableQuery<C extends string> {
  page: number; // vanaf 1
  sort: Sort<C>;
}

type Param = string | string[] | undefined;

export const firstParam = (value: Param) => (Array.isArray(value) ? value[0] : value);

// "3" → 3; ongeldig of kleiner dan 1 → 1
export function parsePage(value: Param): number {
  const page = Number(firstParam(value));
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

// "naam" → oplopend, "-naam" → aflopend; een onbekende kolom → `fallback`
export function parseSort<C extends string>(value: Param, columns: readonly C[], fallback: Sort<C>): Sort<C> {
  const text = firstParam(value) ?? "";
  const dir = text.startsWith("-") ? "desc" : "asc";
  const column = text.replace(/^-/, "") as C;
  return columns.includes(column) ? { column, dir } : fallback;
}

export const formatSort = <C extends string>({ column, dir }: Sort<C>) => (dir === "desc" ? `-${column}` : column);

export const sameSort = <C extends string>(a: Sort<C>, b: Sort<C>) => a.column === b.column && a.dir === b.dir;

// Klik op een kolomkop: dezelfde kolom draait de volgorde om, een andere kolom begint met `firstDir`
export function nextSort<C extends string>(current: Sort<C>, column: C, firstDir: SortDir): Sort<C> {
  if (current.column !== column) return { column, dir: firstDir };
  return { column, dir: current.dir === "asc" ? "desc" : "asc" };
}

// Zoektekst voor de naam: spaties eromheen weg en niet eindeloos lang
export const parseNameFilter = (value: Param) => (firstParam(value) ?? "").trim().slice(0, MAX_FILTER_LENGTH);

// Bevat de naam de zoektekst, zonder op hoofdletters te letten? Een lege zoektekst past bij alles.
export function matchesName(name: string | null, filter: string): boolean {
  if (!filter) return true;
  return name !== null && name.toLocaleLowerCase("nl").includes(filter.toLocaleLowerCase("nl"));
}

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

// Een pagina voorbij het einde wordt de laatste
export const clampPage = (page: number, total: number) => Math.min(Math.max(1, page), pageCount(total));

export const pageSlice = <T>(rows: T[], page: number) => rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

export type SortValue = string | number | Date | null;

const collator = new Intl.Collator("nl", { sensitivity: "base", numeric: true });

// Oplopend; tekst op alfabet (hoofdletters en accenten tellen niet). Lege waarden (null)
// horen niet bij de volgorde en komen dus altijd onderaan, ook bij aflopend sorteren.
function compareAsc(a: Exclude<SortValue, null>, b: Exclude<SortValue, null>): number {
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
  const x = a instanceof Date ? a.getTime() : (a as number);
  const y = b instanceof Date ? b.getTime() : (b as number);
  return x - y;
}

export function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  if (a === null || b === null) return a === null ? (b === null ? 0 : 1) : -1;
  const order = compareAsc(a, b);
  return dir === "asc" ? order : -order;
}

// Kopie van `rows`, gesorteerd op de kolom; bij gelijke waarden beslist `tieBreak`
export function sortRows<T, C extends string>(
  rows: readonly T[],
  sort: Sort<C>,
  value: (row: T, column: C) => SortValue,
  tieBreak: (a: T, b: T) => number = () => 0,
): T[] {
  return rows.toSorted((a, b) => compareValues(value(a, sort.column), value(b, sort.column), sort.dir) || tieBreak(a, b));
}
