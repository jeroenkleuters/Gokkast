import { describe, expect, it } from "vitest";
import { countPrizes, prizeLabel, prizeName, prizeSummary, totalPrizes } from "@/lib/prizes";

describe("countPrizes", () => {
  it("telt de winsten per plaatje en slaat verlies over", () => {
    expect(countPrizes(["WON shot", "LOST", "WON shot", "WON vraagteken"])).toEqual({ shot: 2, kakkerlak: 0, vraagteken: 1 });
  });

  it("geeft nul per plaatje zonder rondes of alleen verlies", () => {
    expect(countPrizes([])).toEqual({ shot: 0, kakkerlak: 0, vraagteken: 0 });
    expect(totalPrizes(countPrizes(["LOST", "LOST"]))).toBe(0);
  });

  it("telt alle prijzen bij elkaar op", () => {
    expect(totalPrizes({ shot: 1, kakkerlak: 2, vraagteken: 1 })).toBe(4);
  });
});

describe("prizeSummary", () => {
  const payment = { name: "T. TEST", credits: 4 };

  it("geeft naam, aantal spelletjes en prijzen bij minstens één winst", () => {
    expect(prizeSummary(payment, ["LOST", "WON kakkerlak", "LOST", "LOST"])).toEqual({
      name: "T. TEST",
      games: 4,
      prizes: { shot: 0, kakkerlak: 1, vraagteken: 0 },
    });
  });

  it("geeft null als er niets gewonnen is (geen popup)", () => {
    expect(prizeSummary(payment, ["LOST", "LOST", "LOST", "LOST"])).toBeNull();
    expect(prizeSummary(payment, [])).toBeNull();
  });

  it("werkt ook zonder naam van de rekeninghouder", () => {
    expect(prizeSummary({ name: null, credits: 4 }, ["WON shot"])).toMatchObject({ name: null });
  });
});

describe("prizeLabel", () => {
  it("noemt de prijs per plaatje, enkelvoud en meervoud", () => {
    expect(prizeLabel("shot", 1)).toBe("1 gratis shotje");
    expect(prizeLabel("shot", 3)).toBe("3 gratis shotjes");
    expect(prizeLabel("kakkerlak", 1)).toBe("1 kakkerlak om te blingen");
    expect(prizeLabel("kakkerlak", 2)).toBe("2 kakkerlakken om te blingen");
    expect(prizeLabel("vraagteken", 1)).toBe("1 vrije keuze");
    expect(prizeLabel("vraagteken", 4)).toBe("4 vrije keuzes");
  });
});

describe("prizeName", () => {
  it("noemt de prijs zonder aantal (spelregels in het havendesign)", () => {
    expect(prizeName("shot")).toBe("gratis shotje");
    expect(prizeName("kakkerlak")).toBe("kakkerlak om te blingen");
    expect(prizeName("vraagteken")).toBe("vrije keuze");
  });
});
