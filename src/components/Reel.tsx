"use client";

import Image from "next/image";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import { restCells, SYMBOL_COUNT } from "@/lib/game";

export interface ReelHandle {
  spin(target: number, duration: number): Promise<void>;
}

interface ReelProps {
  ref: Ref<ReelHandle>;
  index: number;
  initialSymbol: number;
  held: boolean;
  win: boolean;
  cell: number; // hoogte van een plaatje op de rol (incl. rand), per design (designs.ts)
  height: number; // binnenhoogte van de rol
  symbols: readonly string[]; // plaatjes per design (designs.ts)
  onTick(): void;
  onStop(): void;
}

const easeOutBack = (t: number) => {
  const c1 = 0.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export default function Reel({ ref, index, initialSymbol, held, win, cell, height, symbols, onTick, onStop }: ReelProps) {
  const centerOffset = (height - cell) / 2;
  const restY = centerOffset - cell;
  const [cells, setCells] = useState(() => restCells(initialSymbol));
  const [blur, setBlur] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(initialSymbol);

  useImperativeHandle(ref, () => ({
    spin(target, duration) {
      return new Promise((resolve) => {
        const strip = stripRef.current!;
        // Strook: [boven, huidig, ...willekeurig..., doel, onder]
        const loops = Math.round(duration / 55);
        const list = restCells(shownRef.current).slice(0, 2);
        for (let k = 0; k < loops; k++) list.push(Math.floor(Math.random() * SYMBOL_COUNT));
        list.push(target, (target + 1) % SYMBOL_COUNT);
        const endY = centerOffset - (list.length - 2) * cell;

        flushSync(() => {
          setCells(list);
          setBlur(true);
        });
        strip.style.transform = `translateY(${restY}px)`;

        const t0 = performance.now();
        let lastCell = 0;
        const frame = (now: number) => {
          const t = Math.min(1, (now - t0) / duration);
          const y = restY + (endY - restY) * easeOutBack(t);
          strip.style.transform = `translateY(${y}px)`;
          const cellIdx = Math.floor((restY - y) / cell);
          if (cellIdx !== lastCell) {
            lastCell = cellIdx;
            if (index === 0 || t > 0.6) onTick();
          }
          if (t > 0.85) setBlur(false);
          if (t < 1) {
            requestAnimationFrame(frame);
            return;
          }
          shownRef.current = target;
          flushSync(() => setCells(restCells(target)));
          strip.style.transform = `translateY(${restY}px)`;
          onStop();
          resolve();
        };
        requestAnimationFrame(frame);
      });
    },
  }));

  return (
    <div className={`reel${held ? " held" : ""}${win ? " win" : ""}`} data-reel={index}>
      <div
        ref={stripRef}
        className={`strip${blur ? " blur" : ""}`}
        style={{ transform: `translateY(${restY}px)` }}
      >
        {cells.map((s, k) => (
          <div className="cell" key={k}>
            <Image src={symbols[s]} alt="" width={96} height={96} draggable={false} loading="eager" />
          </div>
        ))}
      </div>
    </div>
  );
}
