"use client";

import Image from "next/image";
import type { Design } from "@/lib/settings";

interface LeverProps {
  design: Design;
  pulled: boolean;
  disabled: boolean;
  onPull(): void;
}

export default function Lever({ design, pulled, disabled, onPull }: LeverProps) {
  return (
    <div
      id="lever"
      className={`${pulled ? "pulled" : ""}${disabled ? " disabled" : ""}`}
      onClick={onPull}
      role="button"
      aria-label="Trek aan de hendel"
      aria-disabled={disabled}
    >
      {design === "jungle" ? (
        // Stang en bal komen uit de schildering; de voet staat in de achtergrond
        <>
          <Image className="rod" src="/images/jungle/hendel-stang.png" alt="" width={42} height={166} draggable={false} />
          <Image className="ball" src="/images/jungle/hendel-bal.png" alt="" width={64} height={64} draggable={false} />
        </>
      ) : (
        <>
          <div className="base" />
          <div className="arm">
            <div className="rod" />
            <div className="ball" />
          </div>
        </>
      )}
    </div>
  );
}
