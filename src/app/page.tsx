import { cookies } from "next/headers";
import { connection } from "next/server";
import GameClient from "@/components/GameClient";
import { PAYMENT_COOKIE } from "@/lib/payments";
import { defaultPaymentDeps, loadPaymentInfo } from "@/lib/paymentService";
import { isDesign, MAX_ODDS, oddsFromUrlAllowed, parsePositiveInt } from "@/lib/settings";
import { loadSettings } from "@/lib/settingsStore";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Instellingen per verzoek lezen, niet bij de build vastzetten
  await connection();
  const settings = await loadSettings();

  if (oddsFromUrlAllowed()) {
    const { kans, design } = await searchParams;
    settings.odds = parsePositiveInt(Array.isArray(kans) ? kans[0] : kans, MAX_ODDS) ?? settings.odds;
    if (isDesign(design)) settings.design = design;
  }

  // Betalen (taak 10): alleen met Mollie- of PayPal-sleutels; anders is het spel gratis
  const deps = defaultPaymentDeps();
  const offer = { priceCents: settings.priceCents, credits: settings.roundsPerPayment };
  const payment = deps && (await loadPaymentInfo((await cookies()).get(PAYMENT_COOKIE)?.value, offer, deps));

  return <GameClient settings={settings} payment={payment} />;
}
