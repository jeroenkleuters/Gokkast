// Spellogica van de eenarmige bandiet. Puur TypeScript, geen React of DOM,
// zodat het los te testen is.

// Naam per symbool; ook de naam in de uitkomst ("WON shot") en van het plaatje
export const SYMBOL_NAMES = ["shot", "kakkerlak", "vraagteken"] as const;
export type SymbolName = (typeof SYMBOL_NAMES)[number];
export const SYMBOLS = SYMBOL_NAMES.map((name) => `/images/${name}.png`);
export const SYMBOL_COUNT = SYMBOLS.length;
export const REEL_COUNT = 3;
export const MAX_HELD = 2; // anders draait er niets meer

export type RandomFn = () => number;

// Berichtenbord bij het begin van een spel (het jungle-design toont een eigen tekst, zie designs.ts)
export const READY_MESSAGE = "DRUK OP SPEEL!";

export interface GameState {
  current: number[]; // symbool op de winlijn per rol
  held: boolean[];
  maxTries: number; // pogingen per spel, uit de instellingen
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

export function initialState(maxTries: number, random: RandomFn = Math.random): GameState {
  // Begin met drie verschillende plaatjes
  const current = [0, 1, 2]
    .map((s) => ({ s, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map(({ s }) => s);
  return {
    current,
    held: [false, false, false],
    maxTries,
    triesLeft: maxTries,
    spinsThisGame: 0,
    spinning: false,
    gameOver: false,
    played: 0,
    won: 0,
    message: READY_MESSAGE,
    messageKind: "",
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "newGame":
      return {
        ...state,
        held: [false, false, false],
        triesLeft: state.maxTries,
        spinsThisGame: 0,
        gameOver: false,
        message: READY_MESSAGE,
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

export function formatChance(chance: number): string {
  if (chance === 0) return "geen";
  return "1 op " + (1 / chance).toFixed(1).replace(/\.0$/, "").replace(".", ",");
}
