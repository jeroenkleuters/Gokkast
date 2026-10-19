"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { SYMBOL_NAMES } from "@/lib/game";
import { prizeLabel, totalPrizes, type PrizeSummary } from "@/lib/prizes";

interface PrizeDialogProps {
  summary: PrizeSummary;
  symbols: readonly string[]; // plaatjes per design (designs.ts)
  onClose(): void;
}

// Score-popup na het laatste spelletje van een betaling met minstens één winst.
// Sluit alleen met de knop (niet met Escape of ernaast klikken): eerst de prijzen uitdelen.
export default function PrizeDialog({ summary, symbols, onClose }: PrizeDialogProps) {
  const { name, games, prizes } = summary;
  const won = totalPrizes(prizes);
  const boxRef = useRef<HTMLDivElement>(null);

  // Focus op de popup zelf, niet op de knop: wie met spatie of Enter speelt, sluit hem anders per ongeluk
  useEffect(() => boxRef.current?.focus(), []);

  return (
    <div id="prizes" role="dialog" aria-modal="true" aria-labelledby="prizes-title">
      <div className="box" ref={boxRef} tabIndex={-1}>
        <h3 id="prizes-title">Gewonnen!</h3>
        <p className="who">
          {name && (
            <>
              <b>{name}</b>
              <br />
            </>
          )}
          {won} van de {games} {games === 1 ? "spel" : "spelletjes"} gewonnen
        </p>
        <ul>
          {SYMBOL_NAMES.map((symbol, i) =>
            prizes[symbol] > 0 ? (
              <li key={symbol} data-prize={symbol}>
                <Image src={symbols[i]} alt="" width={48} height={48} />
                {prizeLabel(symbol, prizes[symbol])}
              </li>
            ) : null,
          )}
        </ul>
        <button className="ok" onClick={onClose}>
          Prijzen uitgedeeld
        </button>
      </div>
    </div>
  );
}
