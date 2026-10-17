// Betalen met Mollie (taak 10) of PayPal (taak 13b): instellingen en kleine hulpfuncties, zonder
// database of netwerk. Alleen op de server: API-keys en secrets mogen nooit naar de browser.
import { randomBytes } from "node:crypto";
import { parseFlag, parsePositiveInt } from "@/lib/settings";

// Statussen van een betaling, in de taal van Mollie (https://docs.mollie.com/docs/status-change).
// PayPal-statussen worden hierop afgebeeld (src/lib/paypal.ts).
export const PAYMENT_STATUSES = ["open", "pending", "authorized", "paid", "canceled", "expired", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const isPaymentStatus = (value: unknown): value is PaymentStatus =>
  typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);

// Hierna verandert de status niet meer (betaald, of mislukt: dan maakt de speler een nieuwe betaling)
export const isFinalStatus = (status: PaymentStatus) => ["paid", "canceled", "expired", "failed"].includes(status);

export const DEFAULT_PRICE_CENTS = 100; // 4 spelletjes voor € 1,00
export const MAX_PRICE_CENTS = 10000;
export const MOLLIE_API_URL = "https://api.mollie.com/v2";
// PayPal: de sandbox overal, live alleen in productie met PAYPAL_ENV=live (taak 12b)
export const PAYPAL_SANDBOX_API_URL = "https://api-m.sandbox.paypal.com";
export const PAYPAL_LIVE_API_URL = "https://api-m.paypal.com";
const PAYPAL_LIVE_HOST = new URL(PAYPAL_LIVE_API_URL).hostname;

// httpOnly-cookie met de sleutel (token) van de betaling van deze browser
export const PAYMENT_COOKIE = "gokkast-betaling";
export const PAYMENT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dagen

export interface MollieConfig {
  apiKey: string;
  apiUrl: string; // anders dan Mollie alleen voor tests (nep-Mollie van Playwright), nooit in productie
  priceCents: number;
  live: boolean; // echte betalingen (live-key, alleen in productie)
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  apiUrl: string; // sandbox of live; anders alleen voor tests (nep-PayPal van Playwright)
  webhookId: string | null; // PAYPAL_WEBHOOK_ID: zonder ID worden webhooks geweigerd (polling werkt wel)
  live: boolean; // echte betalingen (alleen in productie met PAYPAL_ENV=live)
}

type Env = Record<string, string | undefined>;

const trimUrl = (value: string | undefined) => (value ?? "").trim().replace(/\/+$/, "");

// Prijs van één betaling (4 spelletjes voor € 1,00), voor Mollie en PayPal gelijk
export function readPriceCents(env: Env = process.env): number {
  return parsePositiveInt(env.GAME_PRICE_CENTS, MAX_PRICE_CENTS) ?? DEFAULT_PRICE_CENTS;
}

// null = Mollie staat uit: geen MOLLIE_API_KEY, of een key die in deze omgeving niet mag (taak 12a).
// Bij Mollie bepaalt de key de modus: live_... is echt geld, test_... de testmodus.
// - Productie (VERCEL_ENV=production): alleen een live-key, altijd met de echte Mollie-API. Een
//   test-key zet Mollie uit, zodat er nooit "betaald" kan worden zonder echt geld.
// - Elders (preview, lokaal, tests): alleen een test-key; een live-key wordt geweigerd, zodat er
//   buiten productie nooit echt geld wordt geïnd.
export function readMollieConfig(env: Env = process.env): MollieConfig | null {
  const apiKey = (env.MOLLIE_API_KEY ?? "").trim();
  if (!apiKey) return null;
  const priceCents = readPriceCents(env);
  if (env.VERCEL_ENV === "production") {
    if (!apiKey.startsWith("live_")) {
      console.error("Mollie staat uit in productie: MOLLIE_API_KEY moet een live-key (live_...) zijn.");
      return null;
    }
    return { apiKey, apiUrl: MOLLIE_API_URL, priceCents, live: true };
  }
  if (!apiKey.startsWith("test_")) {
    console.error("MOLLIE_API_KEY is geen test-key (test_...); buiten productie mag alleen de testmodus. Mollie staat uit.");
    return null;
  }
  return { apiKey, apiUrl: trimUrl(env.MOLLIE_API_URL) || MOLLIE_API_URL, priceCents, live: false };
}

// null = PayPal staat uit: geen PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET, of een omgeving die niet mag.
// - Productie (VERCEL_ENV=production): alleen live, en alleen met PAYPAL_ENV=live. Zonder die vlag
//   staat PayPal uit, zodat er nooit met sandbox-accounts "betaald" kan worden.
// - Elders (preview, lokaal, tests): altijd de sandbox; PAYPAL_ENV=live of een live-URL wordt
//   geweigerd, zodat er buiten productie nooit echt geld wordt geïnd.
export function readPayPalConfig(env: Env = process.env): PayPalConfig | null {
  const clientId = (env.PAYPAL_CLIENT_ID ?? "").trim();
  const clientSecret = (env.PAYPAL_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  const mode = (env.PAYPAL_ENV ?? "").trim().toLowerCase() || "sandbox";
  if (mode !== "sandbox" && mode !== "live") {
    console.error("PAYPAL_ENV moet sandbox of live zijn; PayPal staat uit.");
    return null;
  }
  const webhookId = (env.PAYPAL_WEBHOOK_ID ?? "").trim() || null;
  if (env.VERCEL_ENV === "production") {
    if (mode !== "live") {
      console.error("PayPal staat uit in productie: zet PAYPAL_ENV=live met de sleutels van de live-app.");
      return null;
    }
    return { clientId, clientSecret, apiUrl: PAYPAL_LIVE_API_URL, webhookId, live: true };
  }
  if (mode === "live") {
    console.error("PAYPAL_ENV=live mag alleen in productie; PayPal staat uit.");
    return null;
  }
  const apiUrl = trimUrl(env.PAYPAL_API_URL) || PAYPAL_SANDBOX_API_URL;
  let host = "";
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    console.error("PAYPAL_API_URL is geen geldige URL; PayPal staat uit.");
    return null;
  }
  if (host === PAYPAL_LIVE_HOST) {
    console.error("PAYPAL_API_URL wijst naar live PayPal; dat mag alleen in productie. PayPal staat uit.");
    return null;
  }
  return { clientId, clientSecret, apiUrl, webhookId, live: false };
}

// Wat Mollie en PayPal na het aanmaken of ophalen van een betaling teruggeven
export interface ProviderPayment {
  id: string; // Mollie: tr_..., PayPal: het factuur-ID INV2-...
  status: PaymentStatus;
  checkoutUrl: string | null; // betaalpagina; er niet meer na betalen of verlopen
  consumerName: string | null; // naam van de rekeninghouder of de PayPal-betaler, pas na betalen
  consumerAccount: string | null; // rekeningnummer (IBAN, alleen Mollie); alleen versleuteld opslaan (taak 11), nooit loggen
  paidAt: string | null;
}

export interface CreatePaymentInput {
  amountCents: number;
  description: string;
  reference: string; // eigen referentie, ook in /betaald?ref=
  redirectUrl: string; // alleen Mollie: een PayPal-factuur stuurt de betaler niet terug
  webhookUrl?: string; // alleen Mollie: de webhook van PayPal staat in de app op developer.paypal.com
}

// Wat het spel van een betaalmethode nodig heeft
export interface PaymentClient {
  createPayment(input: CreatePaymentInput): Promise<ProviderPayment>;
  getPayment(id: string): Promise<ProviderPayment>;
}

// Betalingen in het geheugen in plaats van de database: alleen voor de Playwright-tests
// (die draaien zonder database). Nooit in productie, en alleen als er geen database is.
export function memoryStoreAllowed(env: Env = process.env): boolean {
  return parseFlag(env.PAYMENTS_TEST_STORE) && env.VERCEL_ENV !== "production" && !env.DATABASE_URL;
}

// 100 → "1.00" (Mollie en PayPal willen het bedrag als tekst met precies twee decimalen)
export function mollieAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

// 100 → "€ 1,00"
export function formatEuro(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// Willekeurige, niet te raden sleutel voor de cookie
export function newPaymentToken(): string {
  return randomBytes(24).toString("base64url");
}

export const isPaymentToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);

// Referentie in de terugkeer-URL (/betaald?ref=...): niet te raden, maar geen sleutel voor credits.
// Korter dan het token, zodat de twee nooit door elkaar kunnen lopen.
export function newPaymentReference(): string {
  return randomBytes(12).toString("base64url");
}

export const isPaymentReference = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{16}$/.test(value);

// Mollie kan localhost niet bereiken en weigert dan de hele betaling; lokaal geen webhook
// (het spel vraagt de status dan zelf op). In previews houdt Vercel Deployment Protection de webhook
// tegen; met het bypass-geheim van Vercel (Protection Bypass for Automation, dat Vercel zelf als
// VERCEL_AUTOMATION_BYPASS_SECRET meegeeft) komt hij er wel door. Nooit in productie.
export function webhookUrl(origin: string, env: Env = process.env): string | undefined {
  const { hostname } = new URL(origin);
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return undefined;
  const url = `${origin}/api/mollie/webhook`;
  const bypass = (env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
  if (env.VERCEL_ENV !== "preview" || !bypass) return url;
  return `${url}?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
}
