// Betaalflow (taak 10): betaling starten, status ophalen en credits afboeken. Met Mollie of, sinds
// taak 13b, PayPal; de game-manager kiest welke (standaard Mollie).
// Het rekeningnummer van de rekeninghouder wordt alleen versleuteld opgeslagen (taak 11).
// Alleen op de server. De status komt altijd van Mollie of PayPal zelf, nooit uit een verzoek van buiten.
import { encrypt, readEncryptionKey } from "@/lib/encryption";
import { createMollieClient, type MollieClient } from "@/lib/mollie";
import { getPaymentStore, providerId, type PaymentStore, type StatusUpdate, type StoredPayment } from "@/lib/paymentStore";
import {
  formatEuro,
  isFinalStatus,
  isPaymentReference,
  isPaymentToken,
  newPaymentReference,
  newPaymentToken,
  readMollieConfig,
  readPayPalConfig,
  readPriceCents,
  webhookUrl,
  type PaymentClient,
  type PaymentStatus,
  type ProviderPayment,
} from "@/lib/payments";
import { createPayPalClient, type PayPalClient } from "@/lib/paypal";
import { qrDataUrl } from "@/lib/qr";
import type { PaymentProvider } from "@/lib/settings";
import { loadPaymentProvider, loadSettings } from "@/lib/settingsStore";

export interface PaymentDeps {
  priceCents: number;
  store: PaymentStore | null; // null: geen database, betalen lukt dan niet
  mollie: MollieClient | null; // null: geen Mollie-key, of een key die in deze omgeving niet mag (taak 12a)
  paypal: PayPalClient | null; // null: geen PayPal-sleutels, of een omgeving die niet mag (taak 12b)
  provider(): Promise<PaymentProvider>; // gekozen in de game-manager, anders .env, anders Mollie
  credits(): Promise<number>; // spelletjes per betaling (game-manager, anders .env)
  encryptionKey: Buffer | null; // PAYMENT_ENCRYPTION_KEY; null: rekeningnummer niet opslaan
}

// De gekozen methode, of de andere als de gekozen niet is ingesteld (met een waarschuwing)
export function choosePaymentProvider(
  chosen: PaymentProvider,
  available: Record<PaymentProvider, boolean>,
): PaymentProvider {
  if (available[chosen]) return chosen;
  const other: PaymentProvider = chosen === "mollie" ? "paypal" : "mollie";
  console.warn(`Betaalmethode ${chosen} is niet ingesteld; ${other} wordt gebruikt.`);
  return other;
}

// null = betalen staat uit (geen Mollie- en geen PayPal-sleutels): het spel is gratis
export function defaultPaymentDeps(): PaymentDeps | null {
  const mollieConfig = readMollieConfig();
  const paypalConfig = readPayPalConfig();
  if (!mollieConfig && !paypalConfig) return null;
  const available = { mollie: !!mollieConfig, paypal: !!paypalConfig };
  return {
    priceCents: readPriceCents(),
    store: getPaymentStore(),
    mollie: mollieConfig && createMollieClient(mollieConfig),
    paypal: paypalConfig && createPayPalClient(paypalConfig),
    provider: async () => choosePaymentProvider(await loadPaymentProvider(), available),
    credits: async () => (await loadSettings()).roundsPerPayment,
    encryptionKey: readEncryptionKey(),
  };
}

const clientFor = (provider: PaymentProvider, deps: PaymentDeps): PaymentClient | null =>
  provider === "paypal" ? deps.paypal : deps.mollie;

// Testbetaling (geen echt geld)? Alleen echt met de live-key van Mollie (taak 12a) of de live-API van
// PayPal (taak 12b), en die zijn er alleen in productie.
export const isTestPayment = (provider: PaymentProvider, deps: PaymentDeps): boolean =>
  !(provider === "paypal" ? deps.paypal : deps.mollie)?.live;

// Wat de browser van de betaling mag weten
export interface PaymentView {
  status: PaymentStatus | "none"; // none: deze browser heeft (nog) geen betaling
  creditsLeft: number;
  checkoutUrl: string | null; // alleen zolang er betaald kan worden
}

// Voor de gokkast in de browser (alleen als betalen aan staat)
export interface PaymentInfo {
  price: string; // bijv. "€ 1,00"
  credits: number; // spelletjes per betaling
  payment: PaymentView;
}

export const NO_PAYMENT: PaymentView = { status: "none", creditsLeft: 0, checkoutUrl: null };

export function toView(payment: StoredPayment | null): PaymentView {
  if (!payment) return NO_PAYMENT;
  return {
    status: payment.status,
    creditsLeft: payment.status === "paid" ? payment.creditsLeft : 0,
    checkoutUrl: isFinalStatus(payment.status) ? null : payment.checkoutUrl,
  };
}

// Rekeningnummer → versleuteld voor de database. Zonder (geldige) sleutel of bij een fout: niet
// opslaan, wel een waarschuwing; de betaling gaat gewoon door. Het rekeningnummer zelf nooit loggen.
function encryptAccount(account: string | null, key: Buffer | null): string | null {
  if (!account) return null;
  if (!key) {
    console.warn("Rekeningnummer niet opgeslagen: PAYMENT_ENCRYPTION_KEY ontbreekt of is ongeldig.");
    return null;
  }
  try {
    return encrypt(account, key);
  } catch {
    console.warn("Rekeningnummer niet opgeslagen: versleutelen mislukt.");
    return null;
  }
}

// Betaling zoals Mollie of PayPal die teruggeeft → wat we ervan opslaan
function statusUpdate(remote: ProviderPayment, deps: PaymentDeps): StatusUpdate {
  return {
    status: remote.status,
    name: remote.consumerName,
    accountEncrypted: encryptAccount(remote.consumerAccount, deps.encryptionKey),
    paidAt: remote.paidAt ? new Date(remote.paidAt) : null,
  };
}

// Zolang de betaling nog niet af is: de status bij Mollie of PayPal ophalen en opslaan.
// Een fout (of de methode is niet meer ingesteld) geeft de opgeslagen betaling terug; de volgende keer opnieuw.
export async function refreshPayment(payment: StoredPayment, deps: PaymentDeps): Promise<StoredPayment> {
  const client = clientFor(payment.provider, deps);
  if (isFinalStatus(payment.status) || !deps.store || !client) return payment;
  const id = providerId(payment);
  try {
    const remote = await client.getPayment(id);
    return (await deps.store.updateStatus(payment.provider, id, statusUpdate(remote, deps))) ?? payment;
  } catch (error) {
    console.warn(`Status van betaling niet opgehaald bij ${payment.provider}:`, error);
    return payment;
  }
}

// De betaling van deze browser (token uit de cookie), bijgewerkt met de status bij Mollie of PayPal
export async function getPlayerPayment(token: string | undefined, deps: PaymentDeps): Promise<PaymentView> {
  if (!token || !deps.store) return NO_PAYMENT;
  try {
    const payment = await deps.store.findByToken(token);
    return toView(payment && (await refreshPayment(payment, deps)));
  } catch (error) {
    console.warn("Betaling niet gelezen:", error);
    return NO_PAYMENT;
  }
}

export type StartPaymentResult =
  | { ok: true; token: string; payment: PaymentView; provider: PaymentProvider; providerId: string }
  | { ok: false; error: string };

export const PAYMENT_ERROR = "Betalen lukt nu niet. Probeer het later opnieuw.";

// Popup bij speel zonder credits. Een betaling met credits blijft staan, net als een betaling die
// nog loopt met de methode die nu gekozen is (dezelfde QR-code); anders een nieuwe, unieke betaling
// bij Mollie of PayPal voor deze speler.
export async function startPayment(
  token: string | undefined,
  origin: string,
  deps: PaymentDeps,
): Promise<StartPaymentResult> {
  const { store } = deps;
  if (!store) {
    console.error("Betalen staat aan (Mollie- of PayPal-sleutels) maar er is geen database (DATABASE_URL).");
    return { ok: false, error: PAYMENT_ERROR };
  }
  try {
    const provider = await deps.provider();
    const existing = token ? await store.findByToken(token) : null;
    if (existing) {
      const view = toView(await refreshPayment(existing, deps));
      const open = view.checkoutUrl && view.status !== "paid" && existing.provider === provider;
      if (view.creditsLeft > 0 || open) {
        return { ok: true, token: existing.token, payment: view, provider: existing.provider, providerId: providerId(existing) };
      }
    }

    const client = clientFor(provider, deps);
    if (!client) throw new Error(`betaalmethode ${provider} is niet ingesteld`);
    const credits = await deps.credits();
    const amountCents = deps.priceCents;
    const reference = newPaymentReference();
    const remote = await client.createPayment({
      amountCents,
      description: `Jackpot: ${credits} ${credits === 1 ? "spel" : "spelletjes"}`,
      reference,
      redirectUrl: `${origin}/betaald?ref=${reference}`,
      webhookUrl: provider === "mollie" ? webhookUrl(origin) : undefined,
    });
    if (!remote.checkoutUrl) throw new Error(`${provider} gaf geen betaalpagina voor ${remote.id}`);

    const payment = await store.create({
      token: newPaymentToken(),
      reference,
      provider,
      providerId: remote.id,
      checkoutUrl: remote.checkoutUrl,
      amountCents,
      credits,
    });
    return { ok: true, token: payment.token, payment: toView(payment), provider, providerId: remote.id };
  } catch (error) {
    console.error("Betaling niet gestart:", error);
    return { ok: false, error: PAYMENT_ERROR };
  }
}

// QR-code voor de popup. PayPal maakt de QR-code zelf (generate-qr-code); lukt dat niet, dan maken
// we er zelf een van de betaallink. Bij Mollie altijd zelf, van de betaallink.
export async function paymentQr(
  provider: PaymentProvider,
  id: string,
  checkoutUrl: string | null,
  deps: PaymentDeps,
): Promise<string | null> {
  if (!checkoutUrl) return null;
  if (provider === "paypal" && deps.paypal) {
    try {
      return await deps.paypal.qrCode(id);
    } catch (error) {
      console.warn("QR-code niet opgehaald bij PayPal, eigen QR-code van de betaallink:", error);
    }
  }
  return qrDataUrl(checkoutUrl);
}

// Voor /betaald: wat er met een betaling is gebeurd en wat ervoor betaald is
export interface ReturnPayment {
  status: PaymentStatus;
  amount: string; // bijv. "€ 1,00"
  credits: number; // spelletjes voor deze betaling
}

// Terugkeer van Mollie naar /betaald?ref=..., ook op een telefoon zonder de cookie van het spel.
// Alleen om te tonen: de referentie geeft geen credits en zet geen cookie. Onbekend of fout: null.
export async function getReturnPayment(reference: string | undefined, deps: PaymentDeps): Promise<ReturnPayment | null> {
  if (!isPaymentReference(reference) || !deps.store) return null;
  try {
    const found = await deps.store.findByReference(reference);
    if (!found) return null;
    const payment = await refreshPayment(found, deps);
    return { status: payment.status, amount: formatEuro(payment.amountCents), credits: payment.credits };
  } catch (error) {
    console.warn("Betaling voor /betaald niet gelezen:", error);
    return null;
  }
}

export type WebhookResult = "updated" | "unknown" | "error";

// Webhook: Mollie of PayPal stuurt het ID; de status halen we zelf op
export async function syncPaymentById(provider: PaymentProvider, id: string, deps: PaymentDeps): Promise<WebhookResult> {
  const client = clientFor(provider, deps);
  if (!deps.store || !client) return "error";
  try {
    const payment = await deps.store.findByProviderId(provider, id);
    if (!payment) return "unknown";
    const remote = await client.getPayment(id);
    await deps.store.updateStatus(provider, id, statusUpdate(remote, deps));
    return "updated";
  } catch (error) {
    console.error(`Webhook van ${provider} niet verwerkt:`, error);
    return "error";
  }
}

export interface CreditResult {
  ok: boolean;
  payment: PaymentView;
}

// Begin van een nieuw spel: één credit afboeken. Zonder credits: ok false (de popup gaat open).
export async function spendCredit(token: string | undefined, deps: PaymentDeps): Promise<CreditResult> {
  if (!token || !deps.store) return { ok: false, payment: NO_PAYMENT };
  try {
    const used = await deps.store.spendCredit(token);
    if (used) return { ok: true, payment: toView(used) };
    return { ok: false, payment: await getPlayerPayment(token, deps) };
  } catch (error) {
    console.error("Credit niet afgeboekt:", error);
    return { ok: false, payment: NO_PAYMENT };
  }
}

// Bij het laden van het spel: prijs, credits per betaling en de betaling van deze browser
export async function loadPaymentInfo(token: string | undefined, credits: number, deps: PaymentDeps): Promise<PaymentInfo> {
  return {
    price: formatEuro(deps.priceCents),
    credits,
    payment: await getPlayerPayment(isPaymentToken(token) ? token : undefined, deps),
  };
}
