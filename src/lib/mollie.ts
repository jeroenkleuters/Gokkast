// Kleine client voor de Mollie Payments API (https://docs.mollie.com/reference/create-payment).
// Alleen de twee aanroepen die het spel nodig heeft; alleen op de server (de API-key is geheim).
import { isPaymentStatus, mollieAmount, type PaymentConfig, type PaymentStatus } from "@/lib/payments";

export interface MolliePayment {
  id: string; // tr_...
  status: PaymentStatus;
  checkoutUrl: string | null; // betaalpagina; er niet meer na betalen of verlopen
  consumerName: string | null; // naam van de rekeninghouder, pas na betalen (o.a. iDEAL)
  paidAt: string | null;
}

export interface CreatePaymentInput {
  amountCents: number;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata?: Record<string, string | number>;
}

export interface MollieClient {
  createPayment(input: CreatePaymentInput): Promise<MolliePayment>;
  getPayment(id: string): Promise<MolliePayment>;
}

export const isMollieId = (value: unknown): value is string => typeof value === "string" && /^tr_[A-Za-z0-9]{1,64}$/.test(value);

const TIMEOUT_MS = 10_000;

// Antwoord van Mollie → MolliePayment; gooit een fout als het er niet uitziet als een betaling
export function parseMolliePayment(body: unknown): MolliePayment {
  const p = (body ?? {}) as Record<string, unknown>;
  if (!isMollieId(p.id) || !isPaymentStatus(p.status)) throw new Error("onverwacht antwoord van Mollie");
  const links = (p._links ?? {}) as Record<string, { href?: unknown } | undefined>;
  const details = (p.details ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return {
    id: p.id,
    status: p.status,
    checkoutUrl: text(links.checkout?.href),
    consumerName: text(details.consumerName),
    paidAt: text(p.paidAt),
  };
}

export function createMollieClient(config: PaymentConfig, fetchFn: typeof fetch = fetch): MollieClient {
  async function call(path: string, init: RequestInit = {}): Promise<MolliePayment> {
    const response = await fetchFn(`${config.apiUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = (body as { detail?: unknown } | null)?.detail;
      throw new Error(`Mollie ${response.status}: ${typeof detail === "string" ? detail : response.statusText}`);
    }
    return parseMolliePayment(body);
  }

  return {
    createPayment: ({ amountCents, description, redirectUrl, webhookUrl, metadata }) =>
      call("/payments", {
        method: "POST",
        body: JSON.stringify({
          amount: { currency: "EUR", value: mollieAmount(amountCents) },
          description,
          redirectUrl,
          ...(webhookUrl && { webhookUrl }),
          ...(metadata && { metadata }),
        }),
      }),
    getPayment: (id) => {
      if (!isMollieId(id)) return Promise.reject(new Error(`ongeldig Mollie-ID: ${id}`));
      return call(`/payments/${id}`);
    },
  };
}
