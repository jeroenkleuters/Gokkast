// Wat de game-manager toont, uit de URL (taak 13 en 14). Elke tabel heeft eigen parameters,
// zodat bladeren of sorteren in de ene tabel de andere niet verandert:
//   speelrondes: ?periode=vandaag&naam=jan&namen_pagina=2&namen_sorteer=-gewonnen&rondes_pagina=3&rondes_sorteer=naam
//   betalingen:  ?betalingen_naam=jan&betalingen_pagina=2&betalingen_sorteer=-bedrag
// De gekozen tab staat niet in de URL (keuze gebruiker), zie ManagerTabs.tsx.
import {
  firstParam,
  formatSort,
  parseNameFilter,
  parsePage,
  parseSort,
  sameSort,
  type Sort,
  type SortDir,
  type TableQuery,
} from "@/lib/tables";

export type Period = "vandaag" | "alles";

export const NAME_COLUMNS = ["naam", "gespeeld", "shot", "kakkerlak", "vraagteken", "gewonnen", "verloren"] as const;
export const ROUND_COLUMNS = ["datum", "naam", "uitkomst", "pogingen"] as const;
export const PAYMENT_COLUMNS = ["datum", "naam", "methode", "rekeningnummer", "bedrag", "status", "spelletjes"] as const;

export type NameColumn = (typeof NAME_COLUMNS)[number];
export type RoundColumn = (typeof ROUND_COLUMNS)[number];
export type PaymentColumn = (typeof PAYMENT_COLUMNS)[number];

export const DEFAULT_NAME_SORT: Sort<NameColumn> = { column: "naam", dir: "asc" };
export const DEFAULT_ROUND_SORT: Sort<RoundColumn> = { column: "datum", dir: "desc" };
export const DEFAULT_PAYMENT_SORT: Sort<PaymentColumn> = { column: "datum", dir: "desc" };

// Eerste klik op een kolom: tekst A-Z, getallen en datums het grootst of nieuwst bovenaan
const TEXT_COLUMNS = new Set<string>(["naam", "methode", "uitkomst", "rekeningnummer", "status"]);
export const firstDir = (column: string): SortDir => (TEXT_COLUMNS.has(column) ? "asc" : "desc");

export interface StatsQuery {
  period: Period;
  name: string; // zoektekst voor de naam, "" = alle namen
  names: TableQuery<NameColumn>; // tabel Per naam
  rounds: TableQuery<RoundColumn>; // tabel Speelrondes
}

export interface PaymentsQuery extends TableQuery<PaymentColumn> {
  name: string;
}

export interface ManagerQuery {
  stats: StatsQuery;
  payments: PaymentsQuery;
}

type SearchParams = Record<string, string | string[] | undefined>;

// Onbekende of ongeldige waarden → de standaardwaarde
export function parseManagerQuery(params: SearchParams): ManagerQuery {
  return {
    stats: {
      period: firstParam(params.periode) === "vandaag" ? "vandaag" : "alles",
      name: parseNameFilter(params.naam),
      names: {
        page: parsePage(params.namen_pagina),
        sort: parseSort(params.namen_sorteer, NAME_COLUMNS, DEFAULT_NAME_SORT),
      },
      rounds: {
        page: parsePage(params.rondes_pagina),
        sort: parseSort(params.rondes_sorteer, ROUND_COLUMNS, DEFAULT_ROUND_SORT),
      },
    },
    payments: {
      name: parseNameFilter(params.betalingen_naam),
      page: parsePage(params.betalingen_pagina),
      sort: parseSort(params.betalingen_sorteer, PAYMENT_COLUMNS, DEFAULT_PAYMENT_SORT),
    },
  };
}

// Parameters voor de URL; standaardwaarden blijven weg
export function managerParams({ stats, payments }: ManagerQuery): [string, string][] {
  const params: [string, string][] = [];
  const add = (key: string, value: string, skip: boolean) => {
    if (!skip) params.push([key, value]);
  };
  add("periode", stats.period, stats.period === "alles");
  add("naam", stats.name, !stats.name);
  add("namen_pagina", String(stats.names.page), stats.names.page === 1);
  add("namen_sorteer", formatSort(stats.names.sort), sameSort(stats.names.sort, DEFAULT_NAME_SORT));
  add("rondes_pagina", String(stats.rounds.page), stats.rounds.page === 1);
  add("rondes_sorteer", formatSort(stats.rounds.sort), sameSort(stats.rounds.sort, DEFAULT_ROUND_SORT));
  add("betalingen_naam", payments.name, !payments.name);
  add("betalingen_pagina", String(payments.page), payments.page === 1);
  add("betalingen_sorteer", formatSort(payments.sort), sameSort(payments.sort, DEFAULT_PAYMENT_SORT));
  return params;
}

export const MANAGER_PATH = "/game-manager";

export function managerHref(query: ManagerQuery): string {
  const search = new URLSearchParams(managerParams(query)).toString();
  return search ? `${MANAGER_PATH}?${search}` : MANAGER_PATH;
}

// Andere periode of naam: de tabellen van de speelrondes beginnen weer op pagina 1
export function withStats(query: ManagerQuery, change: Partial<Pick<StatsQuery, "period" | "name">>): ManagerQuery {
  const stats = query.stats;
  return {
    ...query,
    stats: { ...stats, ...change, names: { ...stats.names, page: 1 }, rounds: { ...stats.rounds, page: 1 } },
  };
}

export function withNames(query: ManagerQuery, names: Partial<TableQuery<NameColumn>>): ManagerQuery {
  return { ...query, stats: { ...query.stats, names: { ...query.stats.names, ...names } } };
}

export function withRounds(query: ManagerQuery, rounds: Partial<TableQuery<RoundColumn>>): ManagerQuery {
  return { ...query, stats: { ...query.stats, rounds: { ...query.stats.rounds, ...rounds } } };
}

export function withPayments(query: ManagerQuery, payments: Partial<PaymentsQuery>): ManagerQuery {
  return { ...query, payments: { ...query.payments, ...payments } };
}
