// Betalen met Mollie (taak 10): instellingen en kleine hulpfuncties, zonder database of netwerk.
// Alleen op de server: de API-key mag nooit naar de browser.
import { randomBytes } from "node:crypto";
import { parseFlag, parsePositiveInt } from "@/lib/settings";

// Statussen van een Mollie-betaling (https://docs.mollie.com/docs/status-change)
export const PAYMENT_STATUSES = ["open", "pending", "authorized", "paid", "canceled", "expired", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const isPaymentStatus = (value: unknown): value is PaymentStatus =>
  typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);

// Hierna verandert de status niet meer (betaald, of mislukt: dan maakt de speler een nieuwe betaling)
export const isFinalStatus = (status: PaymentStatus) => ["paid", "canceled", "expired", "failed"].includes(status);

export const DEFAULT_PRICE_CENTS = 100; // 4 spelletjes voor € 1,00
export const MAX_PRICE_CENTS = 10000;
export const MOLLIE_API_URL = "https://api.mollie.com/v2";

// httpOnly-cookie met de sleutel (token) van de betaling van deze browser
export const PAYMENT_COOKIE = "gokkast-betaling";
export const PAYMENT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dagen

export interface PaymentConfig {
  apiKey: string;
  apiUrl: string; // anders dan Mollie alleen voor tests (nep-Mollie van Playwright)
  priceCents: number;
}

type Env = Record<string, string | undefined>;

// null = betalen staat uit en het spel is gratis (geen MOLLIE_API_KEY, bijv. productie tot taak 12).
// Alleen een test-key (test_...) wordt gebruikt: in deze versie zijn echte betalingen niet mogelijk.
export function readPaymentConfig(env: Env = process.env): PaymentConfig | null {
  const apiKey = (env.MOLLIE_API_KEY ?? "").trim();
  if (!apiKey) return null;
  if (!apiKey.startsWith("test_")) {
    console.error("MOLLIE_API_KEY is geen test-key (test_...); betalen staat uit. Echte betalingen volgen in taak 12.");
    return null;
  }
  return {
    apiKey,
    apiUrl: (env.MOLLIE_API_URL ?? "").trim().replace(/\/+$/, "") || MOLLIE_API_URL,
    priceCents: parsePositiveInt(env.GAME_PRICE_CENTS, MAX_PRICE_CENTS) ?? DEFAULT_PRICE_CENTS,
  };
}

// Betalingen in het geheugen in plaats van de database: alleen voor de Playwright-tests
// (die draaien zonder database). Nooit in productie, en alleen als er geen database is.
export function memoryStoreAllowed(env: Env = process.env): boolean {
  return parseFlag(env.PAYMENTS_TEST_STORE) && env.VERCEL_ENV !== "production" && !env.DATABASE_URL;
}

// 100 → "1.00" (Mollie wil het bedrag als tekst met precies twee decimalen)
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

// Mollie kan localhost niet bereiken en weigert dan de hele betaling; lokaal geen webhook
// (het spel vraagt de status dan zelf op).
export function webhookUrl(origin: string): string | undefined {
  const { hostname } = new URL(origin);
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return undefined;
  return `${origin}/api/mollie/webhook`;
}
