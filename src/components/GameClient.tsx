"use client";

import dynamic from "next/dynamic";
import type { GameSettings } from "@/lib/settings";

// Alleen in de browser renderen: de begin-rollen zijn willekeurig.
const SlotMachine = dynamic(() => import("./SlotMachine"), { ssr: false });

export default function GameClient({ settings }: { settings: GameSettings }) {
  return <SlotMachine settings={settings} />;
}
