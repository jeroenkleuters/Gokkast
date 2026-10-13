"use client";

import Image from "next/image";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import { restCells, SYMBOLS, SYMBOL_COUNT } from "@/lib/game";

const CELL = 104; // hoogte van een plaatje op de rol (incl. rand)
const REEL_H = 296; // binnenhoogte van een rol
const CENTER_OFFSET = (REEL_H - CELL) / 2;
const REST_Y = CENTER_OFFSET - CELL;

export interface ReelHandle {
  spin(target: number, duration: number): Promise<void>;
}

interface ReelProps {
  ref: Ref<ReelHandle>;
  index: number;
  initialSymbol: number;
  held: boolean;
  win: boolean;
  onTick(): void;
  onStop(): void;
}

const easeOutBack = (t: number) => {
  const c1 = 0.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export default function Reel({ ref, index, initialSymbol, held, win, onTick, onStop }: ReelProps) {
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
        const endY = CENTER_OFFSET - (list.length - 2) * CELL;

        flushSync(() => {
          setCells(list);
          setBlur(true);
        });
        strip.style.transform = `translateY(${REST_Y}px)`;

        const t0 = performance.now();
        let lastCell = 0;
        const frame = (now: number) => {
          const t = Math.min(1, (now - t0) / duration);
          const y = REST_Y + (endY - REST_Y) * easeOutBack(t);
          strip.style.transform = `translateY(${y}px)`;
          const cellIdx = Math.floor((REST_Y - y) / CELL);
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
          strip.style.transform = `translateY(${REST_Y}px)`;
          onStop();
          resolve();
        };
        requestAnimationFrame(frame);
      });
    },
  }));

  return (
    <div className={`reel${held ? " held" : ""}${win ? " win" : ""}`}>
      <div
        ref={stripRef}
        className={`strip${blur ? " blur" : ""}`}
        style={{ transform: `translateY(${REST_Y}px)` }}
      >
        {cells.map((s, k) => (
          <div className="cell" key={k}>
            <Image src={SYMBOLS[s]} alt="" width={96} height={96} draggable={false} loading="eager" />
          </div>
        ))}
      </div>
    </div>
  );
}
