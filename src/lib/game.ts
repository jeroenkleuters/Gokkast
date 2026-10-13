// Spellogica van de eenarmige bandiet. Puur TypeScript, geen React of DOM,
// zodat het los te testen is.

export const SYMBOLS = [
  "/images/beker.png",
  "/images/kakkerlak.png",
  "/images/vraagteken.png",
] as const;
export const SYMBOL_COUNT = SYMBOLS.length;
export const REEL_COUNT = 3;
export const MAX_TRIES = 3;
export const MAX_HELD = 2; // anders draait er niets meer
export const DEFAULT_ODDS = 30; // winkans 1 op 30

export type RandomFn = () => number;

export interface GameState {
  current: number[]; // symbool op de winlijn per rol
  held: boolean[];
  triesLeft: number;
  spinsThisGame: number;
  spinning: boolean;
  gameOver: boolean;
  played: number;
  won: number;
  message: string;
  messageKind: "" | "info" | "win" | "lose";
}

export type GameAction =
  | { type: "newGame" }
  | { type: "toggleHold"; reel: number }
  | { type: "spinStart" }
  | { type: "spinEnd"; result: number[] };

const randomSymbol = (random: RandomFn) => Math.floor(random() * SYMBOL_COUNT);

export const restCells = (s: number) => [(s + 2) % SYMBOL_COUNT, s, (s + 1) % SYMBOL_COUNT];

export function isWin(reels: readonly number[]): boolean {
  return reels.every((s) => s === reels[0]);
}

// Winkans voor de volgende draai. Elke draaiende rol valt met kans
// (1/odds)^(1/3) goed, dus 3 vrije rollen = 1 op odds. Wie rollen met
// hetzelfde plaatje vastzet, hoeft er minder goed te laten vallen.
export function winChance(current: readonly number[], held: readonly boolean[], odds: number): number {
  const heldSyms = new Set(current.filter((_, i) => held[i]));
  if (heldSyms.size > 1) return 0; // vastgezette rollen moeten gelijk zijn
  const free = held.filter((h) => !h).length;
  return Math.pow(1 / odds, free / REEL_COUNT);
}

export function decideOutcome(
  current: readonly number[],
  held: readonly boolean[],
  odds: number,
  random: RandomFn = Math.random,
): number[] {
  if (random() < winChance(current, held, odds)) {
    const heldSym = current.find((_, i) => held[i]);
    const target = heldSym ?? randomSymbol(random);
    return current.map(() => target);
  }
  // Verlies: willekeurige plaatjes, maar nooit drie dezelfde
  let res: number[];
  do {
    res = current.map((s, i) => (held[i] ? s : randomSymbol(random)));
  } while (isWin(res));
  return res;
}

export function canToggleHold(state: GameState, reel: number): boolean {
  if (state.spinning || state.gameOver || state.spinsThisGame === 0) return false;
  if (state.held[reel]) return true;
  return state.held.filter(Boolean).length < MAX_HELD;
}

export function initialState(random: RandomFn = Math.random): GameState {
  // Begin met drie verschillende plaatjes
  const current = [0, 1, 2]
    .map((s) => ({ s, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map(({ s }) => s);
  return {
    current,
    held: [false, false, false],
    triesLeft: MAX_TRIES,
    spinsThisGame: 0,
    spinning: false,
    gameOver: false,
    played: 0,
    won: 0,
    message: "DRUK OP SPEEL!",
    messageKind: "",
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "newGame":
      return {
        ...state,
        held: [false, false, false],
        triesLeft: MAX_TRIES,
        spinsThisGame: 0,
        gameOver: false,
        message: "DRUK OP SPEEL!",
        messageKind: "",
      };

    case "toggleHold": {
      if (!canToggleHold(state, action.reel)) return state;
      const held = state.held.map((h, i) => (i === action.reel ? !h : h));
      return { ...state, held };
    }

    case "spinStart":
      if (state.spinning || state.gameOver || state.triesLeft === 0) return state;
      return {
        ...state,
        spinning: true,
        triesLeft: state.triesLeft - 1,
        spinsThisGame: state.spinsThisGame + 1,
        message: "ROLLEN DRAAIEN...",
        messageKind: "",
      };

    case "spinEnd": {
      const base = { ...state, current: action.result, spinning: false };
      if (isWin(action.result)) {
        return {
          ...base,
          gameOver: true,
          played: state.played + 1,
          won: state.won + 1,
          held: [false, false, false],
          message: "★ JACKPOT! JE HEBT GEWONNEN! ★",
          messageKind: "win",
        };
      }
      if (state.triesLeft === 0) {
        return {
          ...base,
          gameOver: true,
          played: state.played + 1,
          held: [false, false, false],
          message: "HELAAS... PROBEER HET NOG EENS",
          messageKind: "lose",
        };
      }
      return {
        ...base,
        message:
          state.triesLeft === 1
            ? "NOG 1 POGING — ZET ROLLEN VAST!"
            : `NOG ${state.triesLeft} POGINGEN — ZET ROLLEN VAST!`,
        messageKind: "info",
      };
    }
  }
}

// "?kans=10", opgeslagen waarde, ... → geheel getal >= 1, anders null
export function parseOdds(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function formatChance(chance: number): string {
  if (chance === 0) return "geen";
  return "1 op " + (1 / chance).toFixed(1).replace(/\.0$/, "").replace(".", ",");
}
