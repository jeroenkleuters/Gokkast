// Betaalflow (taak 10): betaling starten, status bij Mollie ophalen en credits afboeken.
// Het rekeningnummer van de rekeninghouder wordt alleen versleuteld opgeslagen (taak 11).
// Alleen op de server. De status komt altijd van Mollie zelf, nooit uit een verzoek van buiten.
import { encrypt, readEncryptionKey } from "@/lib/encryption";
import { createMollieClient, type MollieClient, type MolliePayment } from "@/lib/mollie";
import { getPaymentStore, type PaymentStore, type StatusUpdate, type StoredPayment } from "@/lib/paymentStore";
import {
  formatEuro,
  isFinalStatus,
  isPaymentReference,
  isPaymentToken,
  newPaymentReference,
  newPaymentToken,
  readPaymentConfig,
  webhookUrl,
  type PaymentConfig,
  type PaymentStatus,
} from "@/lib/payments";
import { loadSettings } from "@/lib/settingsStore";

export interface PaymentDeps {
  config: PaymentConfig;
  store: PaymentStore | null; // null: geen database, betalen lukt dan niet
  mollie: MollieClient;
  credits(): Promise<number>; // spelletjes per betaling (game-manager, anders .env)
  encryptionKey: Buffer | null; // PAYMENT_ENCRYPTION_KEY; null: rekeningnummer niet opslaan
}

// null = betalen staat uit (geen MOLLIE_API_KEY): het spel is gratis
export function defaultPaymentDeps(): PaymentDeps | null {
  const config = readPaymentConfig();
  if (!config) return null;
  return {
    config,
    store: getPaymentStore(),
    mollie: createMollieClient(config),
    credits: async () => (await loadSettings()).roundsPerPayment,
    encryptionKey: readEncryptionKey(),
  };
}

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

// Betaling zoals Mollie die teruggeeft → wat we ervan opslaan
function statusUpdate(mollie: MolliePayment, deps: PaymentDeps): StatusUpdate {
  return {
    status: mollie.status,
    name: mollie.consumerName,
    accountEncrypted: encryptAccount(mollie.consumerAccount, deps.encryptionKey),
    paidAt: mollie.paidAt ? new Date(mollie.paidAt) : null,
  };
}

// Zolang de betaling nog niet af is: de status bij Mollie ophalen en opslaan.
// Een fout bij Mollie geeft de opgeslagen betaling terug; de volgende keer opnieuw.
export async function refreshPayment(payment: StoredPayment, deps: PaymentDeps): Promise<StoredPayment> {
  if (isFinalStatus(payment.status) || !deps.store) return payment;
  try {
    const mollie = await deps.mollie.getPayment(payment.mollieId);
    return (await deps.store.updateStatus(payment.mollieId, statusUpdate(mollie, deps))) ?? payment;
  } catch (error) {
    console.warn("Status van betaling niet opgehaald bij Mollie:", error);
    return payment;
  }
}

// De betaling van deze browser (token uit de cookie), bijgewerkt met de status bij Mollie
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
  | { ok: true; token: string; payment: PaymentView }
  | { ok: false; error: string };

export const PAYMENT_ERROR = "Betalen lukt nu niet. Probeer het later opnieuw.";

// Popup bij speel zonder credits. Een betaling die nog loopt of nog credits heeft blijft staan
// (dezelfde QR-code); anders een nieuwe, unieke betaling bij Mollie voor deze speler.
export async function startPayment(
  token: string | undefined,
  origin: string,
  deps: PaymentDeps,
): Promise<StartPaymentResult> {
  const { store } = deps;
  if (!store) {
    console.error("Betalen staat aan (MOLLIE_API_KEY) maar er is geen database (DATABASE_URL).");
    return { ok: false, error: PAYMENT_ERROR };
  }
  try {
    const existing = token ? await store.findByToken(token) : null;
    if (existing) {
      const view = toView(await refreshPayment(existing, deps));
      if (view.creditsLeft > 0 || (view.checkoutUrl && view.status !== "paid")) return { ok: true, token: existing.token, payment: view };
    }

    const credits = await deps.credits();
    const amountCents = deps.config.priceCents;
    const reference = newPaymentReference();
    const mollie = await deps.mollie.createPayment({
      amountCents,
      description: `Gokkast: ${credits} ${credits === 1 ? "spel" : "spelletjes"}`,
      redirectUrl: `${origin}/betaald?ref=${reference}`,
      webhookUrl: webhookUrl(origin),
    });
    if (!mollie.checkoutUrl) throw new Error(`Mollie gaf geen betaalpagina voor ${mollie.id}`);

    const payment = await store.create({
      token: newPaymentToken(),
      reference,
      mollieId: mollie.id,
      checkoutUrl: mollie.checkoutUrl,
      amountCents,
      credits,
    });
    return { ok: true, token: payment.token, payment: toView(payment) };
  } catch (error) {
    console.error("Betaling niet gestart:", error);
    return { ok: false, error: PAYMENT_ERROR };
  }
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

// Webhook: Mollie stuurt alleen het ID; de status halen we zelf op bij Mollie
export async function syncPaymentById(mollieId: string, deps: PaymentDeps): Promise<WebhookResult> {
  if (!deps.store) return "error";
  try {
    const payment = await deps.store.findByMollieId(mollieId);
    if (!payment) return "unknown";
    const mollie = await deps.mollie.getPayment(mollieId);
    await deps.store.updateStatus(mollieId, statusUpdate(mollie, deps));
    return "updated";
  } catch (error) {
    console.error("Webhook van Mollie niet verwerkt:", error);
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
    price: formatEuro(deps.config.priceCents),
    credits,
    payment: await getPlayerPayment(isPaymentToken(token) ? token : undefined, deps),
  };
}
