"use client";

import dynamic from "next/dynamic";

// Alleen in de browser renderen: de begin-rollen zijn willekeurig en de
// instellingen komen uit localStorage en de adresbalk.
const SlotMachine = dynamic(() => import("./SlotMachine"), { ssr: false });

export default function GameClient() {
  return <SlotMachine />;
}
