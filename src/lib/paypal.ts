// Kleine client voor PayPal Invoicing v2 (taak 13b): per speler een eigen factuur, verstuurd zonder
// e-mail, met de QR-code van PayPal (https://developer.paypal.com/api/invoicing/v2/invoices-generate-qr-code).
// Alleen de aanroepen die het spel nodig heeft; alleen op de server (client-secret is geheim).
import {
  mollieAmount,
  type PaymentClient,
  type PaymentStatus,
  type PayPalConfig,
  type ProviderPayment,
} from "@/lib/payments";

export interface PayPalClient extends PaymentClient {
  qrCode(id: string): Promise<string>; // data-URL met de PNG van PayPal
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
}

export const isPayPalInvoiceId = (value: unknown): value is string =>
  typeof value === "string" && /^INV2(-[A-Z0-9]{4}){4}$/.test(value);

// Factuurstatus van PayPal → status van het spel (zelfde taal als Mollie)
const STATUS_MAP: Record<string, PaymentStatus> = {
  DRAFT: "open",
  SENT: "open",
  SCHEDULED: "open",
  SHARED: "open",
  UNPAID: "open",
  PAYMENT_PENDING: "pending",
  PARTIALLY_PAID: "pending", // nog niet alles betaald: nog geen credits
  PAID: "paid",
  MARKED_AS_PAID: "paid",
  PAID_EXTERNAL: "paid",
  CANCELLED: "canceled",
  AUTO_CANCELLED: "canceled",
  // Terugbetaald voordat het spel de betaling zag: geen credits
  REFUNDED: "canceled",
  PARTIALLY_REFUNDED: "canceled",
  MARKED_AS_REFUNDED: "canceled",
  REFUNDED_EXTERNAL: "canceled",
};

export function payPalStatus(status: unknown): PaymentStatus | null {
  return typeof status === "string" ? (STATUS_MAP[status] ?? null) : null;
}

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

// Naam uit een contact van PayPal: volledige naam, anders voor- en achternaam, anders de bedrijfsnaam
function contactName(contact: unknown): string | null {
  const c = obj(contact);
  const name = obj(c.name);
  const parts = [text(name.given_name), text(name.surname)].filter(Boolean).join(" ");
  return text(name.full_name) ?? (parts || null) ?? text(c.business_name);
}

// Naam van de betaler: uit de (laatste) betaling op de factuur, anders de ontvanger van de factuur.
// In de sandbox (17 oktober 2026) stond de naam er bij een betaalde factuur niet in: dan null
// ("Zonder naam", besluit gebruiker). Komt hij er wel in, dan wordt hij gewoon opgeslagen.
function payerName(invoice: Json): string | null {
  const transactions = obj(invoice.payments).transactions;
  const list = Array.isArray(transactions) ? transactions : [];
  for (const transaction of [...list].reverse()) {
    const name = contactName(obj(transaction).shipping_info);
    if (name) return name;
  }
  const recipients = Array.isArray(invoice.primary_recipients) ? invoice.primary_recipients : [];
  return contactName(obj(recipients[0]).billing_info);
}

function paidAt(invoice: Json): string | null {
  const transactions = obj(invoice.payments).transactions;
  const last = Array.isArray(transactions) ? obj(transactions[transactions.length - 1]) : {};
  return text(last.payment_date_time) ?? text(last.payment_date);
}

// Factuur van PayPal → ProviderPayment; gooit een fout als het er niet uitziet als een factuur
export function parsePayPalInvoice(body: unknown): ProviderPayment {
  const invoice = obj(body);
  const status = payPalStatus(invoice.status);
  if (!isPayPalInvoiceId(invoice.id) || !status) throw new Error("onverwacht antwoord van PayPal");
  const payerView = text(obj(obj(invoice.detail).metadata).recipient_view_url);
  return {
    id: invoice.id,
    status,
    checkoutUrl: status === "open" || status === "pending" ? payerView : null,
    consumerName: status === "paid" ? payerName(invoice) : null,
    consumerAccount: null, // PayPal geeft geen rekeningnummer
    paidAt: status === "paid" ? paidAt(invoice) : null,
  };
}

// Webhook: alleen berichten over facturen (INVOICING.INVOICE.PAID, .CANCELLED, ...)
export function invoiceEventType(event: unknown): boolean {
  const type = obj(event).event_type;
  return typeof type === "string" && type.startsWith("INVOICING.INVOICE.");
}

// Factuur-ID uit een webhook-bericht: resource.invoice.id, of resource.id
export function invoiceIdFromEvent(event: unknown): string | null {
  const resource = obj(obj(event).resource);
  const id = obj(resource.invoice).id ?? resource.id;
  return isPayPalInvoiceId(id) ? id : null;
}

// Antwoord van generate-qr-code → data-URL. PayPal stuurt de PNG als base64-tekst (soms in een
// multipart-antwoord); een echte PNG (image/png) kan ook.
export function qrDataUrlFromResponse(contentType: string, body: Uint8Array): string {
  if (contentType.includes("image/png")) return `data:image/png;base64,${Buffer.from(body).toString("base64")}`;
  const base64 = /iVBORw0KGgo[A-Za-z0-9+/=\r\n]+/.exec(Buffer.from(body).toString("utf8"))?.[0].replace(/\s+/g, "");
  if (!base64) throw new Error("geen QR-code in het antwoord van PayPal");
  return `data:image/png;base64,${base64}`;
}

const TIMEOUT_MS = 10_000;
export const QR_SIZE = 300; // pixels (PayPal: 150 t/m 500)

// Toegangstoken per client-ID (PayPal: ongeveer 9 uur geldig), gedeeld binnen het serverproces
const tokens = new Map<string, { value: string; expires: number }>();

export function createPayPalClient(config: PayPalConfig, fetchFn: typeof fetch = fetch, now = () => Date.now()): PayPalClient {
  const cacheKey = `${config.apiUrl}|${config.clientId}`;

  async function accessToken(): Promise<string> {
    const cached = tokens.get(cacheKey);
    if (cached && cached.expires > now()) return cached.value;
    const response = await fetchFn(`${config.apiUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = obj(await response.json().catch(() => null));
    const value = text(body.access_token);
    if (!response.ok || !value) throw new Error(`PayPal-token ${response.status}: ${text(body.error_description) ?? response.statusText}`);
    const seconds = typeof body.expires_in === "number" ? body.expires_in : 300;
    tokens.set(cacheKey, { value, expires: now() + Math.max(seconds - 60, 30) * 1000 });
    return value;
  }

  async function request(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
    const { json, headers, ...rest } = init;
    const response = await fetchFn(`${config.apiUrl}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(json !== undefined && { body: JSON.stringify(json) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // 401: token verlopen of ingetrokken; 403: token zonder het recht (bijv. Invoicing pas later aangezet
    // in de app op developer.paypal.com). De volgende keer een nieuw token, met de rechten van nu.
    if (response.status === 401 || response.status === 403) tokens.delete(cacheKey);
    if (!response.ok) {
      const body = obj(await response.json().catch(() => null));
      throw new Error(`PayPal ${response.status}: ${text(body.message) ?? text(body.name) ?? response.statusText}`);
    }
    return response;
  }

  async function getPayment(id: string): Promise<ProviderPayment> {
    if (!isPayPalInvoiceId(id)) throw new Error(`ongeldig PayPal-factuur-ID: ${id}`);
    return parsePayPalInvoice(await (await request(`/v2/invoicing/invoices/${id}`)).json());
  }

  return {
    // Factuur maken (concept) en versturen zonder e-mail: dan is hij te betalen via de link en de QR-code
    async createPayment({ amountCents, description, reference }) {
      const amount = { currency_code: "EUR", value: mollieAmount(amountCents) };
      const created = await request("/v2/invoicing/invoices", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        json: {
          detail: { currency_code: "EUR", reference, note: description },
          items: [{ name: description, quantity: "1", unit_amount: amount }],
        },
      });
      const id = obj(await created.json().catch(() => null)).id;
      if (!isPayPalInvoiceId(id)) throw new Error("PayPal gaf geen factuur-ID terug");
      await request(`/v2/invoicing/invoices/${id}/send`, {
        method: "POST",
        json: { send_to_recipient: false, send_to_invoicer: false },
      });
      return getPayment(id);
    },

    getPayment,

    async qrCode(id) {
      if (!isPayPalInvoiceId(id)) throw new Error(`ongeldig PayPal-factuur-ID: ${id}`);
      const response = await request(`/v2/invoicing/invoices/${id}/generate-qr-code`, {
        method: "POST",
        json: { width: QR_SIZE, height: QR_SIZE, action: "pay" },
      });
      return qrDataUrlFromResponse(response.headers.get("content-type") ?? "", new Uint8Array(await response.arrayBuffer()));
    },

    // Laat PayPal zelf controleren of de webhook echt van PayPal komt (handtekening + webhook-ID).
    // Het bericht gaat ongewijzigd mee: PayPal controleert de handtekening over de oorspronkelijke tekst.
    async verifyWebhook(headers, rawBody) {
      if (!config.webhookId) {
        console.warn("Webhook van PayPal geweigerd: PAYPAL_WEBHOOK_ID ontbreekt.");
        return false;
      }
      const field = (name: string) => headers.get(name) ?? "";
      const fields = {
        auth_algo: field("paypal-auth-algo"),
        cert_url: field("paypal-cert-url"),
        transmission_id: field("paypal-transmission-id"),
        transmission_sig: field("paypal-transmission-sig"),
        transmission_time: field("paypal-transmission-time"),
        webhook_id: config.webhookId,
      };
      if (Object.values(fields).some((value) => !value)) return false;
      const body = `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${rawBody}}`;
      const response = await request("/v1/notifications/verify-webhook-signature", { method: "POST", body });
      return obj(await response.json().catch(() => null)).verification_status === "SUCCESS";
    },
  };
}

// Alleen voor tests: tokens van een eerdere test vergeten
export function clearPayPalTokens() {
  tokens.clear();
}
