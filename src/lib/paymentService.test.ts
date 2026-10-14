import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatePaymentInput, MollieClient, MolliePayment } from "@/lib/mollie";
import {
  getPlayerPayment,
  getReturnPayment,
  loadPaymentInfo,
  NO_PAYMENT,
  PAYMENT_ERROR,
  spendCredit,
  startPayment,
  syncPaymentById,
  type PaymentDeps,
} from "@/lib/paymentService";
import { memoryPaymentStore, type PaymentStore } from "@/lib/paymentStore";
import type { PaymentStatus } from "@/lib/payments";

// Nep-Mollie: betalingen in het geheugen; pay() doet wat de speler op de betaalpagina doet
function fakeMollie() {
  const payments = new Map<string, MolliePayment>();
  const created: CreatePaymentInput[] = [];
  const client: MollieClient = {
    async createPayment(input) {
      created.push(input);
      const id = `tr_test${payments.size + 1}`;
      const payment = { id, status: "open" as const, checkoutUrl: `https://mollie.test/checkout/${id}`, consumerName: null, paidAt: null };
      payments.set(id, payment);
      return { ...payment };
    },
    async getPayment(id) {
      const payment = payments.get(id);
      if (!payment) throw new Error("Mollie 404");
      return { ...payment };
    },
  };
  function setStatus(id: string, status: PaymentStatus, consumerName: string | null = null) {
    const payment = payments.get(id)!;
    Object.assign(payment, {
      status,
      consumerName,
      paidAt: status === "paid" ? "2026-10-14T10:00:00+00:00" : null,
      checkoutUrl: status === "open" ? payment.checkoutUrl : null,
    });
  }
  return { client, created, setStatus };
}

const ORIGIN = "https://gokkast.test";

describe("betaalflow", () => {
  let mollie: ReturnType<typeof fakeMollie>;
  let store: PaymentStore;
  let deps: PaymentDeps;

  beforeEach(() => {
    mollie = fakeMollie();
    store = memoryPaymentStore();
    deps = {
      config: { apiKey: "test_abc", apiUrl: "https://mollie.test/v2", priceCents: 100 },
      store,
      mollie: mollie.client,
      credits: async () => 4,
    };
  });
  afterEach(() => vi.restoreAllMocks());

  async function start(token?: string) {
    const result = await startPayment(token, ORIGIN, deps);
    if (!result.ok) throw new Error(result.error);
    return result;
  }

  it("maakt per speler een eigen Mollie-betaling van € 1,00 voor 4 spelletjes", async () => {
    const a = await start();
    const b = await start();

    expect(a.token).not.toBe(b.token);
    expect(a.payment).toEqual({ status: "open", creditsLeft: 0, checkoutUrl: "https://mollie.test/checkout/tr_test1" });
    expect(b.payment.checkoutUrl).toBe("https://mollie.test/checkout/tr_test2");
    expect(mollie.created[0]).toEqual({
      amountCents: 100,
      description: "Gokkast: 4 spelletjes",
      redirectUrl: expect.stringMatching(/^https:\/\/gokkast\.test\/betaald\?ref=[A-Za-z0-9_-]{16}$/),
      webhookUrl: "https://gokkast.test/api/mollie/webhook",
    });
    const stored = await store.findByToken(a.token);
    expect(stored).toMatchObject({ mollieId: "tr_test1", amountCents: 100, credits: 4, creditsLeft: 0 });
    // De referentie in de terugkeer-URL is die van de betaling, en niet het token van de cookie
    expect(mollie.created[0].redirectUrl).toBe(`${ORIGIN}/betaald?ref=${stored!.reference}`);
    expect(stored!.reference).not.toBe(a.token);
    expect((await store.findByToken(b.token))!.reference).not.toBe(stored!.reference);
  });

  it("toont dezelfde betaling opnieuw zolang die nog open is", async () => {
    const first = await start();
    const again = await start(first.token);
    expect(again.token).toBe(first.token);
    expect(mollie.created).toHaveLength(1);
  });

  it("geeft 4 credits na betalen en neemt de naam van de rekeninghouder over", async () => {
    const { token } = await start();
    expect(await spendCredit(token, deps)).toEqual({ ok: false, payment: expect.objectContaining({ status: "open" }) });

    mollie.setStatus("tr_test1", "paid", "T. TEST");
    expect(await getPlayerPayment(token, deps)).toEqual({ status: "paid", creditsLeft: 4, checkoutUrl: null });
    expect(await store.findByToken(token)).toMatchObject({ status: "paid", name: "T. TEST" });
  });

  it("elk spel kost 1 credit; bij 0 credits is er een nieuwe betaling nodig", async () => {
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid", "T. TEST");
    await syncPaymentById("tr_test1", deps);

    for (const left of [3, 2, 1, 0]) {
      expect(await spendCredit(token, deps)).toEqual({ ok: true, payment: expect.objectContaining({ creditsLeft: left }) });
    }
    expect((await spendCredit(token, deps)).ok).toBe(false);

    // Op: een nieuwe betaling (nieuw token), de oude blijft betaald
    const next = await start(token);
    expect(next.token).not.toBe(token);
    expect(mollie.created).toHaveLength(2);
  });

  it("start geen nieuwe betaling zolang er nog credits zijn", async () => {
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid");
    const again = await start(token);
    expect(again.payment.creditsLeft).toBe(4);
    expect(mollie.created).toHaveLength(1);
  });

  it("geeft de credits maar één keer, ook als webhook en spel allebei bijwerken", async () => {
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid");
    await syncPaymentById("tr_test1", deps);
    await spendCredit(token, deps);
    await syncPaymentById("tr_test1", deps); // Mollie stuurt de webhook nog eens
    await getPlayerPayment(token, deps);
    expect((await store.findByToken(token))!.creditsLeft).toBe(3);
  });

  it("een afgebroken of verlopen betaling geeft geen credits, opnieuw proberen maakt een nieuwe", async () => {
    const { token } = await start();
    mollie.setStatus("tr_test1", "canceled");
    expect(await getPlayerPayment(token, deps)).toEqual({ status: "canceled", creditsLeft: 0, checkoutUrl: null });
    expect((await spendCredit(token, deps)).ok).toBe(false);

    const next = await start(token);
    expect(next.token).not.toBe(token);
    expect(next.payment.status).toBe("open");
  });

  it("de webhook leest de status bij Mollie, niet uit het verzoek", async () => {
    const { token } = await start();
    // Iemand roept de webhook aan terwijl er nog niet betaald is: er verandert niets
    expect(await syncPaymentById("tr_test1", deps)).toBe("updated");
    expect((await store.findByToken(token))!.status).toBe("open");

    mollie.setStatus("tr_test1", "paid");
    await syncPaymentById("tr_test1", deps);
    expect((await store.findByToken(token))!).toMatchObject({ status: "paid", creditsLeft: 4 });
  });

  it("de webhook negeert onbekende betalingen", async () => {
    expect(await syncPaymentById("tr_onbekend", deps)).toBe("unknown");
  });

  it("de webhook meldt een fout als Mollie niet antwoordt (Mollie probeert het later opnieuw)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await start();
    deps.mollie = { ...mollie.client, getPayment: () => Promise.reject(new Error("timeout")) };
    expect(await syncPaymentById("tr_test1", deps)).toBe("error");
  });

  it("houdt de opgeslagen status als Mollie even niet bereikbaar is", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { token } = await start();
    deps.mollie = { ...mollie.client, getPayment: () => Promise.reject(new Error("timeout")) };
    expect((await getPlayerPayment(token, deps)).status).toBe("open");
  });

  it("geeft een nette melding als Mollie de betaling weigert", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    deps.mollie = { ...mollie.client, createPayment: () => Promise.reject(new Error("Mollie 401")) };
    expect(await startPayment(undefined, ORIGIN, deps)).toEqual({ ok: false, error: PAYMENT_ERROR });
    expect(error).toHaveBeenCalled();
  });

  it("betalen lukt niet zonder database", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deps.store = null;
    expect(await startPayment(undefined, ORIGIN, deps)).toEqual({ ok: false, error: PAYMENT_ERROR });
    expect(await spendCredit("x".repeat(32), deps)).toEqual({ ok: false, payment: NO_PAYMENT });
  });

  it("zonder of met een onbekend token heeft de speler geen betaling", async () => {
    expect(await getPlayerPayment(undefined, deps)).toEqual(NO_PAYMENT);
    expect(await getPlayerPayment("a".repeat(32), deps)).toEqual(NO_PAYMENT);
    expect(await spendCredit(undefined, deps)).toEqual({ ok: false, payment: NO_PAYMENT });
  });

  it("/betaald toont via de referentie wat er betaald is, ook zonder cookie", async () => {
    await start();
    const { reference } = (await store.findByMollieId("tr_test1"))!;
    expect(await getReturnPayment(reference!, deps)).toEqual({ status: "open", amount: "€ 1,00", credits: 4 });

    // De status komt van Mollie, ook als de webhook nog niet is geweest
    mollie.setStatus("tr_test1", "paid", "T. TEST");
    expect(await getReturnPayment(reference!, deps)).toEqual({ status: "paid", amount: "€ 1,00", credits: 4 });
  });

  it("/betaald toont een mislukte betaling als mislukt", async () => {
    await start();
    const { reference } = (await store.findByMollieId("tr_test1"))!;
    mollie.setStatus("tr_test1", "canceled");
    expect(await getReturnPayment(reference!, deps)).toMatchObject({ status: "canceled" });
  });

  it("/betaald zonder geldige of met een onbekende referentie toont geen betaling", async () => {
    const { token } = await start();
    expect(await getReturnPayment(undefined, deps)).toBeNull();
    expect(await getReturnPayment("kort", deps)).toBeNull();
    expect(await getReturnPayment(token, deps)).toBeNull(); // het token van de cookie werkt niet als referentie
    expect(await getReturnPayment("a".repeat(16), deps)).toBeNull();
    deps.store = null;
    expect(await getReturnPayment("a".repeat(16), deps)).toBeNull();
  });

  it("de referentie geeft geen credits: alleen het token van de cookie kan spelen", async () => {
    const { token } = await start();
    const { reference } = (await store.findByMollieId("tr_test1"))!;
    mollie.setStatus("tr_test1", "paid");
    await getReturnPayment(reference!, deps);
    expect(await spendCredit(reference!, deps)).toEqual({ ok: false, payment: NO_PAYMENT });
    expect(await spendCredit(token, deps)).toMatchObject({ ok: true });
  });

  it("geeft het spel de prijs, de credits per betaling en de betaling van de speler", async () => {
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid");
    expect(await loadPaymentInfo(token, 4, deps)).toEqual({
      price: "€ 1,00",
      credits: 4,
      payment: { status: "paid", creditsLeft: 4, checkoutUrl: null },
    });
    expect((await loadPaymentInfo("ongeldig", 4, deps)).payment).toEqual(NO_PAYMENT);
  });
});
