import { describe, expect, it } from "vitest";
import {
  firstDir,
  managerHref,
  managerParams,
  parseManagerQuery,
  withNames,
  withPayments,
  withRounds,
  withStats,
} from "@/lib/managerQuery";

const DEFAULT = parseManagerQuery({});

const parseHref = (href: string) => parseManagerQuery(Object.fromEntries(new URL(href, "http://localhost").searchParams));

describe("parseManagerQuery", () => {
  it("geeft standaard alles, pagina 1, rondes en betalingen nieuwste eerst, namen A-Z", () => {
    expect(DEFAULT).toEqual({
      stats: {
        period: "alles",
        name: "",
        names: { page: 1, sort: { column: "naam", dir: "asc" } },
        rounds: { page: 1, sort: { column: "datum", dir: "desc" } },
      },
      payments: { name: "", page: 1, sort: { column: "datum", dir: "desc" } },
    });
  });

  it("leest elke tabel uit zijn eigen parameters", () => {
    const query = parseManagerQuery({
      periode: "vandaag",
      naam: " jan ",
      namen_pagina: "2",
      namen_sorteer: "-gewonnen",
      rondes_pagina: "3",
      rondes_sorteer: "uitkomst",
      betalingen_naam: "Piet",
      betalingen_pagina: "4",
      betalingen_sorteer: "-rekeningnummer",
    });
    expect(query).toEqual({
      stats: {
        period: "vandaag",
        name: "jan",
        names: { page: 2, sort: { column: "gewonnen", dir: "desc" } },
        rounds: { page: 3, sort: { column: "uitkomst", dir: "asc" } },
      },
      payments: { name: "Piet", page: 4, sort: { column: "rekeningnummer", dir: "desc" } },
    });
  });

  it("negeert ongeldige waarden en kolommen van een andere tabel", () => {
    const query = parseManagerQuery({
      periode: "Vandaag",
      rondes_pagina: "abc",
      rondes_sorteer: "bedrag", // kolom van de betalingen
      namen_sorteer: "-datum", // kolom van de rondes
      betalingen_sorteer: "uitkomst",
    });
    expect(query).toEqual(DEFAULT);
  });
});

describe("managerHref", () => {
  it("laat standaardwaarden weg", () => {
    expect(managerHref(DEFAULT)).toBe("/game-manager");
    expect(managerParams(DEFAULT)).toEqual([]);
  });

  it("zet alleen wat afwijkt in de URL", () => {
    expect(managerHref(withStats(DEFAULT, { period: "vandaag" }))).toBe("/game-manager?periode=vandaag");
    expect(managerHref(withRounds(DEFAULT, { page: 2 }))).toBe("/game-manager?rondes_pagina=2");
    expect(managerHref(withPayments(DEFAULT, { sort: { column: "bedrag", dir: "asc" } }))).toBe(
      "/game-manager?betalingen_sorteer=bedrag",
    );
    expect(managerHref(withNames(DEFAULT, { sort: { column: "naam", dir: "desc" } }))).toBe("/game-manager?namen_sorteer=-naam");
    expect(managerHref(withPayments(DEFAULT, { name: "A & B" }))).toBe("/game-manager?betalingen_naam=A+%26+B");
  });

  it("geeft terug wat parseManagerQuery leest", () => {
    const query = parseManagerQuery({
      periode: "vandaag",
      naam: "jan",
      namen_pagina: "2",
      namen_sorteer: "shot",
      rondes_pagina: "3",
      rondes_sorteer: "-pogingen",
      betalingen_naam: "Piet & Co",
      betalingen_pagina: "4",
      betalingen_sorteer: "status",
    });
    expect(parseHref(managerHref(query))).toEqual(query);
  });
});

describe("with...", () => {
  const busy = parseManagerQuery({ namen_pagina: "2", rondes_pagina: "3", betalingen_pagina: "4", betalingen_naam: "x" });

  it("een andere periode of naam zet beide tabellen van de speelrondes terug op pagina 1, de betalingen niet", () => {
    for (const changed of [withStats(busy, { period: "vandaag" }), withStats(busy, { name: "jan" })]) {
      expect(changed.stats.names.page).toBe(1);
      expect(changed.stats.rounds.page).toBe(1);
      expect(changed.payments).toEqual(busy.payments);
    }
  });

  it("bladeren in de ene tabel laat de andere staan", () => {
    const rounds = withRounds(busy, { page: 5 });
    expect(rounds.stats.names.page).toBe(2);
    expect(rounds.payments.page).toBe(4);
    const payments = withPayments(busy, { page: 1 });
    expect(payments.stats).toEqual(busy.stats);
  });
});

describe("firstDir", () => {
  it("tekst A-Z, getallen en datums het grootst of nieuwst bovenaan", () => {
    expect(["naam", "uitkomst", "rekeningnummer", "status"].map(firstDir)).toEqual(["asc", "asc", "asc", "asc"]);
    expect(["datum", "gespeeld", "gewonnen", "bedrag", "pogingen"].map(firstDir)).toEqual(["desc", "desc", "desc", "desc", "desc"]);
  });
});
