"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState } from "react";
import { saveGame, spendGameCredit } from "@/app/actions";
import {
  canToggleHold,
  decideOutcome,
  formatChance,
  gameReducer,
  initialState,
  isWin,
  SYMBOL_NAMES,
  winChance,
} from "@/lib/game";
import { coinShower } from "@/lib/coinShower";
import { sfx } from "@/lib/sound";
import type { GameOutcome } from "@/lib/gameStore";
import type { PaymentInfo, PaymentView } from "@/lib/paymentService";
import type { PrizeSummary } from "@/lib/prizes";
import type { GameSettings } from "@/lib/settings";
import { KEYS, readStorage, writeStorage } from "@/lib/storage";
import InfoPanel from "./InfoPanel";
import Lever from "./Lever";
import PaymentDialog from "./PaymentDialog";
import PrizeDialog from "./PrizeDialog";
import Reel, { type ReelHandle } from "./Reel";
import SettingsDialog from "./SettingsDialog";
import Stats from "./Stats";

const GAME_W = 1024;
const GAME_H = 768;
const PRIZES_DELAY_MS = 1500; // eerst de winst zien (munten), dan de score-popup

interface SlotMachineProps {
  settings: GameSettings;
  payment: PaymentInfo | null; // null: betalen staat uit, het spel is gratis
}

export default function SlotMachine({ settings, payment }: SlotMachineProps) {
  const { odds } = settings;
  const [state, dispatch] = useReducer(gameReducer, settings.maxTries, initialState);
  const [soundOn, setSoundOn] = useState(() => readStorage(KEYS.sound) !== "uit");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [prizes, setPrizes] = useState<PrizeSummary | null>(null);
  const [credits, setCredits] = useState(payment?.payment.creditsLeft ?? 0);
  const [leverPulled, setLeverPulled] = useState(false);
  const [initialSymbols] = useState(() => state.current);

  const gameRef = useRef<HTMLDivElement>(null);
  const reelRefs = useRef<(ReelHandle | null)[]>([]);
  const busyRef = useRef(false); // voorkomt dubbel starten voor de volgende render

  // Vast 1024x768 speelveld, geschaald naar het venster
  useLayoutEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
      gameRef.current!.style.transform = `translate(-50%, -50%) scale(${s})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => sfx.setEnabled(soundOn), [soundOn]);

  async function play() {
    if (busyRef.current || state.spinning) return;
    sfx.resume();
    sfx.click();
    if (state.gameOver) {
      dispatch({ type: "newGame" });
      return;
    }

    busyRef.current = true;

    // Betalen staat aan: het begin van elk spel kost één credit (afgeboekt op de server)
    if (payment && state.spinsThisGame === 0) {
      const credit = await spendGameCredit().catch(() => null);
      if (!credit?.ok) {
        busyRef.current = false;
        setCredits(credit?.payment.creditsLeft ?? 0);
        setPaymentOpen(true);
        return;
      }
      setCredits(credit.payment.creditsLeft);
    }

    setLeverPulled(true);
    setTimeout(() => setLeverPulled(false), 260);

    const result = decideOutcome(state.current, state.held, odds);
    dispatch({ type: "spinStart" });

    const jobs: Promise<void>[] = [];
    let order = 0;
    state.held.forEach((h, i) => {
      if (h) return;
      jobs.push(reelRefs.current[i]!.spin(result[i], 1100 + order * 450));
      order++;
    });
    await Promise.all(jobs);

    dispatch({ type: "spinEnd", result });
    busyRef.current = false;

    // state is hier nog van voor de draai: triesLeft telt de huidige draai nog mee
    const tries = state.spinsThisGame + 1;
    if (isWin(result)) {
      sfx.win();
      coinShower(gameRef.current!);
      finish(`WON ${SYMBOL_NAMES[result[0]]}`, tries);
    } else if (state.triesLeft === 1) {
      sfx.lose();
      finish("LOST", tries);
    }
  }

  // Ronde opslaan; na het laatste spelletje van een betaling met winst komt de score-popup
  // (de betaalpopup gaat dan dicht: eerst de prijzen uitdelen)
  function finish(outcome: GameOutcome, tries: number) {
    saveGame({ outcome, tries })
      .then((finished) => {
        const summary = finished.prizes;
        if (!summary) return;
        setTimeout(() => {
          setPaymentOpen(false);
          setPrizes(summary);
        }, PRIZES_DELAY_MS);
      })
      .catch(() => {});
  }

  function toggleHold(reel: number) {
    if (!canToggleHold(state, reel)) return;
    sfx.click();
    dispatch({ type: "toggleHold", reel });
  }

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (prizes) return; // de score-popup sluit alleen met de knop
    if (settingsOpen || paymentOpen) {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setPaymentOpen(false);
      }
      return;
    }
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      void play();
    }
    if (["1", "2", "3"].includes(e.key)) toggleHold(Number(e.key) - 1);
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleSound() {
    const on = !soundOn;
    setSoundOn(on);
    writeStorage(KEYS.sound, on ? "aan" : "uit");
  }

  const won = state.gameOver && isWin(state.current);
  const chanceNow = state.gameOver ? "–" : formatChance(winChance(state.current, state.held, odds));

  return (
    <div id="game" ref={gameRef}>
      <button id="sound" title="Geluid aan/uit" onClick={toggleSound}>
        {soundOn ? "🔊" : "🔇"}
      </button>
      <button id="gear" title="Instellingen" onClick={() => setSettingsOpen(true)}>
        ⚙
      </button>

      <InfoPanel maxTries={state.maxTries} />
      <Stats
        played={state.played}
        won={state.won}
        odds={odds}
        chanceNow={chanceNow}
        credits={payment ? credits : null}
      />

      <div id="cabinet">
        <div id="topper">
          <div className="knob" />
          <div id="title">
            {"JACKPOT".split("").map((ch, k) => (
              <span key={k}>{ch}</span>
            ))}
          </div>
        </div>
        <div id="body">
          <div className="side left">
            <div className="neon-red">★ ★ ★</div>
            <div className="neon-blue">POGING</div>
            <div id="tries-lamps">
              {Array.from({ length: state.maxTries }, (_, k) => (
                <div key={k} className={`lamp${k < state.triesLeft ? " on" : ""}`} />
              ))}
            </div>
            <div className="neon-red arrow">➜</div>
          </div>

          <div id="reels">
            <div className="payarrow l" />
            <div className="payarrow r" />
            <div id="payline" />
            {initialSymbols.map((s, i) => (
              <Reel
                key={i}
                ref={(h) => {
                  reelRefs.current[i] = h;
                }}
                index={i}
                initialSymbol={s}
                held={state.held[i]}
                win={won}
                onTick={sfx.tick}
                onStop={sfx.stop}
              />
            ))}
          </div>

          <div className="side right">
            <div className="neon-gold">
              BIG
              <br />
              WIN
            </div>
            <div className="neon-red arrow">⬅</div>
            <div className="neon-blue">
              WIN
              <br />
              SLOTS
            </div>
            <div className="neon-green">€€€</div>
          </div>

          <div id="panel">
            {state.held.map((h, i) => (
              <button
                key={i}
                className={`holdbtn${h ? " on" : ""}`}
                data-reel={i}
                disabled={!canToggleHold(state, i)}
                onClick={() => toggleHold(i)}
              >
                VAST
              </button>
            ))}
            <button
              id="playbtn"
              className={state.gameOver ? "new" : ""}
              disabled={state.spinning}
              onClick={() => void play()}
            >
              {state.gameOver ? "NIEUW SPEL" : "SPEEL"}
            </button>
          </div>

          <div id="grille" />
          <div id="display" className={state.messageKind}>
            {state.message}
          </div>
        </div>
      </div>

      <Lever pulled={leverPulled} disabled={state.spinning} onPull={() => void play()} />

      {paymentOpen && payment && (
        <PaymentDialog
          price={payment.price}
          credits={payment.credits}
          onPaid={(paid: PaymentView) => {
            setCredits(paid.creditsLeft);
            setPaymentOpen(false);
          }}
          onClose={() => setPaymentOpen(false)}
        />
      )}

      {prizes && <PrizeDialog summary={prizes} onClose={() => setPrizes(null)} />}

      {settingsOpen && (
        <SettingsDialog settings={settings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
