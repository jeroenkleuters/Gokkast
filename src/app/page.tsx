import { connection } from "next/server";
import GameClient from "@/components/GameClient";
import { MAX_ODDS, oddsFromUrlAllowed, parsePositiveInt, readSettings } from "@/lib/settings";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Instellingen per verzoek lezen, niet bij de build vastzetten
  await connection();
  const settings = readSettings();

  if (oddsFromUrlAllowed()) {
    const kans = (await searchParams).kans;
    settings.odds = parsePositiveInt(Array.isArray(kans) ? kans[0] : kans, MAX_ODDS) ?? settings.odds;
  }

  return <GameClient settings={settings} />;
}
