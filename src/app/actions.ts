"use server";

// Server actions: de browser roept ze aan, maar ze draaien alleen op de server.
// Ze zijn een openbaar endpoint, dus alle invoer wordt in gameStore.ts gecontroleerd.
import { saveGameResult } from "@/lib/gameStore";

// Aan het eind van elk spel; geeft alleen terug of het gelukt is
export async function saveGame(input: { outcome: "WON" | "LOST"; tries: number }): Promise<{ saved: boolean }> {
  return { saved: await saveGameResult(input) };
}
