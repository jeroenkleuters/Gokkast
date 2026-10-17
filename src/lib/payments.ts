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
// Alleen de sandbox van PayPal; live betalen volgt in taak 12b
export const PAYPAL_SANDBOX_API_URL = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_HOST = "api-m.paypal.com";

// httpOnly-cookie met de sleutel (token) van de betaling van deze browser
export const PAYMENT_COOKIE = "gokkast-betaling";
export const PAYMENT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dagen

export interface MollieConfig {
  apiKey: string;
  apiUrl: string; // anders dan Mollie alleen voor tests (nep-Mollie van Playwright)
  priceCents: number;
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  apiUrl: string; // de sandbox; anders alleen voor tests (nep-PayPal van Playwright)
  webhookId: string | null; // PAYPAL_WEBHOOK_ID: zonder ID worden webhooks geweigerd (polling werkt wel)
}

type Env = Record<string, string | undefined>;

const trimUrl = (value: string | undefined) => (value ?? "").trim().replace(/\/+$/, "");

// Prijs van één betaling (4 spelletjes voor € 1,00), voor Mollie en PayPal gelijk
export function readPriceCents(env: Env = process.env): number {
  return parsePositiveInt(env.GAME_PRICE_CENTS, MAX_PRICE_CENTS) ?? DEFAULT_PRICE_CENTS;
}

// null = Mollie staat uit (geen MOLLIE_API_KEY, bijv. productie tot taak 12a).
// Alleen een test-key (test_...) wordt gebruikt: in deze versie zijn echte betalingen niet mogelijk.
export function readMollieConfig(env: Env = process.env): MollieConfig | null {
  const apiKey = (env.MOLLIE_API_KEY ?? "").trim();
  if (!apiKey) return null;
  if (!apiKey.startsWith("test_")) {
    console.error("MOLLIE_API_KEY is geen test-key (test_...); Mollie staat uit. Echte betalingen volgen in taak 12a.");
    return null;
  }
  return { apiKey, apiUrl: trimUrl(env.MOLLIE_API_URL) || MOLLIE_API_URL, priceCents: readPriceCents(env) };
}

// null = PayPal staat uit: geen PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET, of in productie (live volgt in
// taak 12b). Alleen de sandbox: een live-URL wordt geweigerd, ook buiten productie.
export function readPayPalConfig(env: Env = process.env): PayPalConfig | null {
  const clientId = (env.PAYPAL_CLIENT_ID ?? "").trim();
  const clientSecret = (env.PAYPAL_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  if (env.VERCEL_ENV === "production") {
    console.error("PayPal staat uit in productie: live betalen met PayPal volgt in taak 12b.");
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
    console.error("PAYPAL_API_URL wijst naar live PayPal; PayPal staat uit. Live betalen volgt in taak 12b.");
    return null;
  }
  return { clientId, clientSecret, apiUrl, webhookId: (env.PAYPAL_WEBHOOK_ID ?? "").trim() || null };
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
