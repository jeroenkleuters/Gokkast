// Betaalflow (taak 10): betaling starten, status bij Mollie ophalen en credits afboeken.
// Alleen op de server. De status komt altijd van Mollie zelf, nooit uit een verzoek van buiten.
import { createMollieClient, type MollieClient, type MolliePayment } from "@/lib/mollie";
import { getPaymentStore, type PaymentStore, type StatusUpdate, type StoredPayment } from "@/lib/paymentStore";
import {
  formatEuro,
  isFinalStatus,
  isPaymentToken,
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

// Betaling zoals Mollie die teruggeeft → wat we ervan opslaan
function statusUpdate(mollie: MolliePayment): StatusUpdate {
  return {
    status: mollie.status,
    name: mollie.consumerName,
    paidAt: mollie.paidAt ? new Date(mollie.paidAt) : null,
  };
}

// Zolang de betaling nog niet af is: de status bij Mollie ophalen en opslaan.
// Een fout bij Mollie geeft de opgeslagen betaling terug; de volgende keer opnieuw.
export async function refreshPayment(payment: StoredPayment, deps: PaymentDeps): Promise<StoredPayment> {
  if (isFinalStatus(payment.status) || !deps.store) return payment;
  try {
    const mollie = await deps.mollie.getPayment(payment.mollieId);
    return (await deps.store.updateStatus(payment.mollieId, statusUpdate(mollie))) ?? payment;
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
    const mollie = await deps.mollie.createPayment({
      amountCents,
      description: `Gokkast: ${credits} ${credits === 1 ? "spel" : "spelletjes"}`,
      redirectUrl: `${origin}/betaald`,
      webhookUrl: webhookUrl(origin),
    });
    if (!mollie.checkoutUrl) throw new Error(`Mollie gaf geen betaalpagina voor ${mollie.id}`);

    const payment = await store.create({
      token: newPaymentToken(),
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

export type WebhookResult = "updated" | "unknown" | "error";

// Webhook: Mollie stuurt alleen het ID; de status halen we zelf op bij Mollie
export async function syncPaymentById(mollieId: string, deps: PaymentDeps): Promise<WebhookResult> {
  if (!deps.store) return "error";
  try {
    const payment = await deps.store.findByMollieId(mollieId);
    if (!payment) return "unknown";
    const mollie = await deps.mollie.getPayment(mollieId);
    await deps.store.updateStatus(mollieId, statusUpdate(mollie));
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
