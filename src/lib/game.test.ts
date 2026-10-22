import { describe, expect, it } from "vitest";
import {
  canToggleHold,
  decideOutcome,
  gameReducer,
  initialState,
  isWin,
  MAX_HELD,
  restCells,
  winChance,
  type GameState,
  type RandomFn,
} from "@/lib/game";

const ODDS = 30;

// Geeft de getallen één voor één terug, zodat een uitkomst vastligt
function sequence(...values: number[]): RandomFn {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("sequence: geen getallen meer");
    return values[i++];
  };
}

// Voorspelbare pseudo-willekeur (LCG) voor tests over veel draaien
function seeded(seed: number): RandomFn {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Nieuw spel met de plaatjes 0, 1, 2 op de winlijn (constante random laat de volgorde staan)
const fresh = (maxTries = 3) => initialState(maxTries, () => 0.5);

const spin = (state: GameState, result: number[]) =>
  gameReducer(gameReducer(state, { type: "spinStart" }), { type: "spinEnd", result });

const hold = (state: GameState, reel: number) => gameReducer(state, { type: "toggleHold", reel });

describe("isWin en restCells", () => {
  it("herkent drie gelijke plaatjes", () => {
    expect(isWin([1, 1, 1])).toBe(true);
    expect(isWin([1, 1, 2])).toBe(false);
  });

  it("geeft de plaatjes boven, op en onder de winlijn", () => {
    expect(restCells(0)).toEqual([2, 0, 1]);
    expect(restCells(2)).toEqual([1, 2, 0]);
  });
});

describe("winChance", () => {
  const current = [0, 1, 2];

  it("is 1 op odds zonder vastgezette rollen", () => {
    expect(winChance(current, [false, false, false], ODDS)).toBeCloseTo(1 / ODDS, 12);
  });

  it("is (1/odds)^(2/3) met één vastgezette rol", () => {
    expect(winChance(current, [true, false, false], ODDS)).toBeCloseTo(Math.pow(1 / ODDS, 2 / 3), 12);
  });

  it("is (1/odds)^(1/3) met twee gelijke vastgezette rollen", () => {
    expect(winChance([1, 1, 2], [true, true, false], ODDS)).toBeCloseTo(Math.pow(1 / ODDS, 1 / 3), 12);
  });

  it("is 0 met twee verschillende vastgezette rollen", () => {
    expect(winChance(current, [true, true, false], ODDS)).toBe(0);
  });

  it("stijgt naarmate er meer rollen vast staan", () => {
    const none = winChance([1, 1, 2], [false, false, false], ODDS);
    const one = winChance([1, 1, 2], [true, false, false], ODDS);
    const two = winChance([1, 1, 2], [true, true, false], ODDS);
    expect(none).toBeLessThan(one);
    expect(one).toBeLessThan(two);
  });

  it("is altijd winst bij odds 1", () => {
    expect(winChance(current, [false, false, false], 1)).toBe(1);
  });
});

describe("decideOutcome", () => {
  it("geeft bij winst drie gelijke plaatjes", () => {
    // 0 < kans → winst; 0,5 → plaatje 1
    expect(decideOutcome([0, 1, 2], [false, false, false], ODDS, sequence(0, 0.5))).toEqual([1, 1, 1]);
  });

  it("gebruikt bij winst het vastgezette plaatje", () => {
    expect(decideOutcome([2, 0, 1], [true, false, false], ODDS, sequence(0))).toEqual([2, 2, 2]);
  });

  it("draait bij verlies opnieuw als er toevallig drie gelijke vallen", () => {
    // 0,99 → verlies; eerst 0,0,0 (drie gelijke, opnieuw), dan 0,1,2
    const result = decideOutcome([0, 1, 2], [false, false, false], ODDS, sequence(0.99, 0, 0, 0, 0, 0.5, 0.9));
    expect(result).toEqual([0, 1, 2]);
  });

  it("laat vastgezette rollen staan bij verlies", () => {
    // 0,99 → verlies; rol 3 eerst plaatje 1 (drie gelijke, opnieuw), dan plaatje 0
    const result = decideOutcome([1, 1, 0], [true, true, false], ODDS, sequence(0.99, 0.5, 0));
    expect(result).toEqual([1, 1, 0]);
  });

  it("geeft bij verlies nooit drie gelijke en houdt vastgezette rollen vast", () => {
    const helds = [
      [false, false, false],
      [true, false, false],
      [false, true, true],
    ];
    for (let seed = 1; seed <= 300; seed++) {
      const rnd = seeded(seed);
      let first = true;
      const alwaysLose: RandomFn = () => (first ? ((first = false), 0.999999) : rnd());
      const held = helds[seed % helds.length];
      const current = [seed % 3, seed % 3, (seed + 1) % 3];
      const result = decideOutcome(current, held, ODDS, alwaysLose);
      expect(isWin(result)).toBe(false);
      held.forEach((h, i) => h && expect(result[i]).toBe(current[i]));
    }
  });

  it("wint in de praktijk ongeveer 1 op odds", () => {
    const rnd = seeded(42);
    const runs = 30000;
    let wins = 0;
    for (let i = 0; i < runs; i++) {
      if (isWin(decideOutcome([0, 1, 2], [false, false, false], ODDS, rnd))) wins++;
    }
    // verwacht 1000; ruime marge zodat de test niet afhangt van toeval
    expect(wins).toBeGreaterThan(850);
    expect(wins).toBeLessThan(1150);
  });
});

describe("initialState", () => {
  it("begint met drie verschillende plaatjes en alle pogingen", () => {
    const state = initialState(3, seeded(7));
    expect(new Set(state.current).size).toBe(3);
    expect(state.triesLeft).toBe(3);
    expect(state.held).toEqual([false, false, false]);
    expect(state.gameOver).toBe(false);
  });

  it("gebruikt het aantal pogingen uit de instellingen", () => {
    const state = fresh(5);
    expect(state.maxTries).toBe(5);
    expect(state.triesLeft).toBe(5);
  });
});

describe("pogingen", () => {
  it("een draai kost een poging", () => {
    const state = gameReducer(fresh(), { type: "spinStart" });
    expect(state.spinning).toBe(true);
    expect(state.triesLeft).toBe(2);
    expect(state.spinsThisGame).toBe(1);
  });

  it("draait niet terwijl de rollen al draaien", () => {
    const spinning = gameReducer(fresh(), { type: "spinStart" });
    expect(gameReducer(spinning, { type: "spinStart" })).toBe(spinning);
  });

  it("draait niet zonder pogingen of na afloop", () => {
    const noTries = { ...fresh(), triesLeft: 0 };
    expect(gameReducer(noTries, { type: "spinStart" })).toBe(noTries);
    const over = { ...fresh(), gameOver: true };
    expect(gameReducer(over, { type: "spinStart" })).toBe(over);
  });

  it("meldt hoeveel pogingen er nog zijn na een verloren draai", () => {
    const after1 = spin(fresh(), [0, 1, 2]);
    expect(after1.gameOver).toBe(false);
    expect(after1.messageKind).toBe("info");
    expect(after1.message).toContain("NOG 2 POGINGEN");
    expect(spin(after1, [0, 1, 2]).message).toContain("NOG 1 POGING");
  });

  it("verliest na de laatste poging", () => {
    let state = fresh();
    for (let i = 0; i < 3; i++) state = spin(state, [0, 1, 2]);
    expect(state.gameOver).toBe(true);
    expect(state.messageKind).toBe("lose");
    expect(state.played).toBe(1);
    expect(state.won).toBe(0);
    expect(gameReducer(state, { type: "spinStart" })).toBe(state);
  });

  it("winst eindigt het spel meteen", () => {
    const state = spin(fresh(), [2, 2, 2]);
    expect(state.gameOver).toBe(true);
    expect(state.messageKind).toBe("win");
    expect(state.played).toBe(1);
    expect(state.won).toBe(1);
    expect(state.triesLeft).toBe(2);
    expect(state.current).toEqual([2, 2, 2]);
  });

  it("nieuw spel zet pogingen en vastzetten terug, maar houdt de score", () => {
    let state = spin(fresh(), [1, 1, 2]);
    state = hold(state, 0);
    state = spin(state, [1, 1, 1]);
    const next = gameReducer(state, { type: "newGame" });
    expect(next.triesLeft).toBe(3);
    expect(next.spinsThisGame).toBe(0);
    expect(next.held).toEqual([false, false, false]);
    expect(next.gameOver).toBe(false);
    expect(next.messageKind).toBe("");
    expect(next.played).toBe(1);
    expect(next.won).toBe(1);
  });
});

describe("vastzetten", () => {
  it("kan niet vóór de eerste draai", () => {
    const state = fresh();
    expect(canToggleHold(state, 0)).toBe(false);
    expect(hold(state, 0)).toBe(state);
  });

  it("kan na een draai, maximaal twee rollen", () => {
    let state = spin(fresh(), [1, 1, 2]);
    state = hold(hold(state, 0), 1);
    expect(state.held).toEqual([true, true, false]);
    expect(MAX_HELD).toBe(2);
    expect(canToggleHold(state, 2)).toBe(false);
    expect(hold(state, 2).held).toEqual([true, true, false]);
  });

  it("losmaken kan ook als er al twee vast staan", () => {
    let state = spin(fresh(), [1, 1, 2]);
    state = hold(hold(state, 0), 1);
    state = hold(state, 0);
    expect(state.held).toEqual([false, true, false]);
    expect(hold(state, 2).held).toEqual([false, true, true]);
  });

  it("kan niet terwijl de rollen draaien", () => {
    const state = gameReducer(spin(fresh(), [1, 1, 2]), { type: "spinStart" });
    expect(canToggleHold(state, 0)).toBe(false);
  });

  it("kan niet na afloop, en vastgezette rollen gaan los", () => {
    let state = spin(fresh(), [1, 1, 2]);
    state = hold(state, 0);
    state = spin(state, [1, 1, 1]);
    expect(state.held).toEqual([false, false, false]);
    expect(canToggleHold(state, 0)).toBe(false);
  });

  it("vastgezette rollen blijven vast tussen draaien", () => {
    let state = spin(fresh(), [1, 1, 2]);
    state = hold(state, 0);
    state = spin(state, [1, 0, 2]);
    expect(state.held).toEqual([true, false, false]);
  });
});
