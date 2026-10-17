"use server";

// Server actions: de browser roept ze aan, maar ze draaien alleen op de server.
// Ze zijn een openbaar endpoint, dus alle invoer wordt gecontroleerd (gameStore.ts, paymentService.ts).
import { cookies, headers } from "next/headers";
import { finishGame, type FinishedGame, type GameOutcome, type PaidGame } from "@/lib/gameStore";
import { isPaymentToken, PAYMENT_COOKIE, PAYMENT_COOKIE_MAX_AGE } from "@/lib/payments";
import {
  defaultPaymentDeps,
  getPlayerPayment,
  NO_PAYMENT,
  PAYMENT_ERROR,
  paymentQr,
  spendCredit,
  startPayment as startPlayerPayment,
  type CreditResult,
  type PaymentView,
} from "@/lib/paymentService";
import type { PaymentProvider } from "@/lib/settings";

// Token van de betaling van deze browser (httpOnly-cookie), alleen als het er geldig uitziet
async function paymentToken(): Promise<string | undefined> {
  const token = (await cookies()).get(PAYMENT_COOKIE)?.value;
  return isPaymentToken(token) ? token : undefined;
}

// Adres van de site voor de terugkeer na betalen en de webhook (achter Vercel via x-forwarded-*)
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("geen host in het verzoek");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

// De betaalde betaling van deze browser, om de ronde aan te koppelen
async function currentGamePayment(): Promise<PaidGame | null> {
  const deps = defaultPaymentDeps();
  const token = await paymentToken();
  if (!deps?.store || !token) return null;
  try {
    const payment = await deps.store.findByToken(token);
    if (payment?.status !== "paid") return null;
    return { id: payment.id, name: payment.name, credits: payment.credits, creditsLeft: payment.creditsLeft };
  } catch (error) {
    console.warn("Betaling voor de ronde niet gelezen:", error);
    return null;
  }
}

// Aan het eind van elk spel: of het gelukt is, en na het laatste spelletje van een betaling
// met minstens één winst het prijzenoverzicht voor de score-popup
export async function saveGame(input: { outcome: GameOutcome; tries: number }): Promise<FinishedGame> {
  return finishGame(input, await currentGamePayment());
}

// Begin van een nieuw spel: één credit gebruiken. Staat betalen uit, dan is het spel gratis.
export async function spendGameCredit(): Promise<CreditResult> {
  const deps = defaultPaymentDeps();
  if (!deps) return { ok: true, payment: NO_PAYMENT };
  return spendCredit(await paymentToken(), deps);
}

export type StartPaymentResponse =
  | { ok: true; payment: PaymentView; qr: string | null; provider: PaymentProvider }
  | { ok: false; error: string };

// Popup: betaling van deze speler starten (of de lopende tonen) met een QR-code: bij Mollie van de
// betaallink, bij PayPal de QR-code die PayPal zelf maakt (taak 13b)
export async function startPayment(): Promise<StartPaymentResponse> {
  const deps = defaultPaymentDeps();
  if (!deps) return { ok: false, error: PAYMENT_ERROR };
  const origin = await requestOrigin();
  const result = await startPlayerPayment(await paymentToken(), origin, deps);
  if (!result.ok) return result;

  (await cookies()).set(PAYMENT_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax", // mee bij de terugkeer van Mollie naar /betaald
    secure: origin.startsWith("https:"),
    maxAge: PAYMENT_COOKIE_MAX_AGE,
    path: "/",
  });
  const qr = await paymentQr(result.provider, result.providerId, result.payment.checkoutUrl, deps);
  return { ok: true, payment: result.payment, qr, provider: result.provider };
}

// Popup vraagt regelmatig of er al betaald is (bijv. met een telefoon via de QR-code)
export async function checkPayment(): Promise<PaymentView> {
  const deps = defaultPaymentDeps();
  if (!deps) return NO_PAYMENT;
  return getPlayerPayment(await paymentToken(), deps);
}
