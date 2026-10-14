import { describe, expect, it } from "vitest";
import {
  clampPage,
  compareValues,
  formatSort,
  matchesName,
  MAX_FILTER_LENGTH,
  nextSort,
  pageCount,
  pageSlice,
  parseNameFilter,
  parsePage,
  parseSort,
  ROWS_PER_PAGE,
  sortRows,
} from "@/lib/tables";

const COLUMNS = ["datum", "naam", "bedrag"] as const;
const FALLBACK = { column: "datum", dir: "desc" } as const;

describe("parsePage", () => {
  it("leest een paginanummer vanaf 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "5"])).toBe(2);
  });

  it("geeft 1 bij een ongeldige waarde", () => {
    for (const value of [undefined, "", "0", "-1", "1.5", "abc", "1e400", "99999999999999999999"])
      expect(parsePage(value), String(value)).toBe(1);
  });
});

describe("parseSort en formatSort", () => {
  it("naam is oplopend, -naam aflopend", () => {
    expect(parseSort("naam", COLUMNS, FALLBACK)).toEqual({ column: "naam", dir: "asc" });
    expect(parseSort("-bedrag", COLUMNS, FALLBACK)).toEqual({ column: "bedrag", dir: "desc" });
  });

  it("een onbekende kolom geeft de standaard", () => {
    for (const value of [undefined, "", "-", "kleur", "--naam", "Naam"]) expect(parseSort(value, COLUMNS, FALLBACK)).toBe(FALLBACK);
  });

  it("formatSort is het omgekeerde van parseSort", () => {
    for (const sort of [{ column: "naam", dir: "asc" }, { column: "bedrag", dir: "desc" }] as const)
      expect(parseSort(formatSort(sort), COLUMNS, FALLBACK)).toEqual(sort);
  });
});

describe("nextSort", () => {
  it("dezelfde kolom draait de volgorde om", () => {
    expect(nextSort({ column: "naam", dir: "asc" }, "naam", "asc")).toEqual({ column: "naam", dir: "desc" });
    expect(nextSort({ column: "naam", dir: "desc" }, "naam", "asc")).toEqual({ column: "naam", dir: "asc" });
  });

  it("een andere kolom begint met de eerste richting van die kolom", () => {
    expect(nextSort({ column: "naam", dir: "desc" }, "bedrag", "desc")).toEqual({ column: "bedrag", dir: "desc" });
    expect(nextSort({ column: "datum", dir: "desc" }, "naam", "asc")).toEqual({ column: "naam", dir: "asc" });
  });
});

describe("parseNameFilter en matchesName", () => {
  it("haalt spaties weg en kort lange tekst in", () => {
    expect(parseNameFilter("  jan  ")).toBe("jan");
    expect(parseNameFilter(undefined)).toBe("");
    expect(parseNameFilter(["piet", "jan"])).toBe("piet");
    expect(parseNameFilter("x".repeat(500))).toHaveLength(MAX_FILTER_LENGTH);
  });

  it("zoekt op een deel van de naam, zonder op hoofdletters te letten", () => {
    expect(matchesName("A. Jansen", "jans")).toBe(true);
    expect(matchesName("P. JANSSEN", "Janssen")).toBe(true);
    expect(matchesName("Émile", "ÉMI")).toBe(true);
    expect(matchesName("Bob", "jan")).toBe(false);
  });

  it("zonder zoektekst past alles, ook zonder naam; met zoektekst nooit zonder naam", () => {
    expect(matchesName(null, "")).toBe(true);
    expect(matchesName("Bob", "")).toBe(true);
    expect(matchesName(null, "jan")).toBe(false);
  });
});

describe("pagina's", () => {
  it("heeft 15 rijen per pagina en altijd minstens één pagina", () => {
    expect(ROWS_PER_PAGE).toBe(15);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(15)).toBe(1);
    expect(pageCount(16)).toBe(2);
  });

  it("een pagina voorbij het einde wordt de laatste", () => {
    expect(clampPage(9, 31)).toBe(3);
    expect(clampPage(2, 0)).toBe(1);
    expect(clampPage(2, 31)).toBe(2);
  });

  it("pageSlice geeft de rijen van een pagina", () => {
    const rows = Array.from({ length: 32 }, (_, i) => i);
    expect(pageSlice(rows, 1)).toEqual(rows.slice(0, 15));
    expect(pageSlice(rows, 3)).toEqual([30, 31]);
  });
});

describe("compareValues en sortRows", () => {
  it("vergelijkt tekst op alfabet zonder op hoofdletters en accenten te letten, met getallen op waarde", () => {
    const names = ["piet", "Émile", "anna", "Speler 10", "Speler 9"];
    expect(names.toSorted((a, b) => compareValues(a, b, "asc"))).toEqual(["anna", "Émile", "piet", "Speler 9", "Speler 10"]);
  });

  it("vergelijkt getallen en datums in beide richtingen", () => {
    expect([3, 1, 2].toSorted((a, b) => compareValues(a, b, "desc"))).toEqual([3, 2, 1]);
    const [early, late] = [new Date("2026-10-13"), new Date("2026-10-14")];
    expect([early, late].toSorted((a, b) => compareValues(a, b, "desc"))).toEqual([late, early]);
  });

  it("lege waarden staan altijd onderaan", () => {
    const values = ["b", null, "a"];
    expect(values.toSorted((a, b) => compareValues(a, b, "asc"))).toEqual(["a", "b", null]);
    expect(values.toSorted((a, b) => compareValues(a, b, "desc"))).toEqual(["b", "a", null]);
  });

  it("sortRows laat de invoer staan en gebruikt tieBreak bij gelijke waarden", () => {
    const rows = [
      { id: 1, amount: 100 },
      { id: 2, amount: 200 },
      { id: 3, amount: 100 },
    ];
    const sorted = sortRows(rows, { column: "bedrag", dir: "asc" }, (row) => row.amount, (a, b) => b.id - a.id);
    expect(sorted.map((r) => r.id)).toEqual([3, 1, 2]);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
