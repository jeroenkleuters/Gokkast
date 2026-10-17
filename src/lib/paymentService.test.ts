import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt } from "@/lib/encryption";
import type { CreatePaymentInput, MollieClient, MolliePayment } from "@/lib/mollie";
import {
  choosePaymentProvider,
  getPlayerPayment,
  isTestPayment,
  getReturnPayment,
  loadPaymentInfo,
  NO_PAYMENT,
  PAYMENT_ERROR,
  paymentQr,
  spendCredit,
  startPayment,
  syncPaymentById,
  type PaymentDeps,
} from "@/lib/paymentService";
import { memoryPaymentStore, type PaymentStore } from "@/lib/paymentStore";
import type { PaymentStatus } from "@/lib/payments";
import type { PayPalClient } from "@/lib/paypal";
import type { PaymentProvider } from "@/lib/settings";

// Nep-Mollie: betalingen in het geheugen; pay() doet wat de speler op de betaalpagina doet
function fakeMollie() {
  const payments = new Map<string, MolliePayment>();
  const created: CreatePaymentInput[] = [];
  const client: MollieClient = {
    async createPayment(input) {
      created.push(input);
      const id = `tr_test${payments.size + 1}`;
      const payment = { id, status: "open" as const, checkoutUrl: `https://mollie.test/checkout/${id}`, consumerName: null, consumerAccount: null, paidAt: null };
      payments.set(id, payment);
      return { ...payment };
    },
    async getPayment(id) {
      const payment = payments.get(id);
      if (!payment) throw new Error("Mollie 404");
      return { ...payment };
    },
  };
  function setStatus(id: string, status: PaymentStatus, consumerName: string | null = null, consumerAccount: string | null = null) {
    const payment = payments.get(id)!;
    Object.assign(payment, {
      status,
      consumerName,
      consumerAccount,
      paidAt: status === "paid" ? "2026-10-14T10:00:00+00:00" : null,
      checkoutUrl: status === "open" ? payment.checkoutUrl : null,
    });
  }
  return { client, created, setStatus };
}

const ORIGIN = "https://gokkast.test";
const KEY = randomBytes(32);
const ACCOUNT = "NL53INGB0654422370";

describe("betaalflow", () => {
  let mollie: ReturnType<typeof fakeMollie>;
  let store: PaymentStore;
  let deps: PaymentDeps;

  beforeEach(() => {
    mollie = fakeMollie();
    store = memoryPaymentStore();
    deps = {
      priceCents: 100,
      store,
      mollie: mollie.client,
      paypal: null,
      provider: async () => "mollie",
      credits: async () => 4,
      encryptionKey: KEY,
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
      reference: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
      redirectUrl: expect.stringMatching(/^https:\/\/gokkast\.test\/betaald\?ref=[A-Za-z0-9_-]{16}$/),
      webhookUrl: "https://gokkast.test/api/mollie/webhook",
    });
    const stored = await store.findByToken(a.token);
    expect(stored).toMatchObject({ provider: "mollie", mollieId: "tr_test1", paypalId: null, amountCents: 100, credits: 4, creditsLeft: 0 });
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

  it("slaat het rekeningnummer na betalen alleen versleuteld op", async () => {
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid", "T. TEST", ACCOUNT);
    const view = await getPlayerPayment(token, deps);

    const stored = (await store.findByToken(token))!;
    expect(stored.accountEncrypted).toMatch(/^v1:/);
    expect(stored.accountEncrypted).not.toContain(ACCOUNT);
    expect(decrypt(stored.accountEncrypted!, KEY)).toBe(ACCOUNT);
    // De browser krijgt het rekeningnummer niet te zien, ook niet versleuteld
    expect(JSON.stringify(view)).not.toMatch(/NL53|v1:/);
  });

  it("ook via de webhook; een betaling zonder rekeningnummer blijft leeg", async () => {
    const a = await start();
    const b = await start();
    mollie.setStatus("tr_test1", "paid", "T. TEST", ACCOUNT);
    mollie.setStatus("tr_test2", "paid", "T. TEST");
    await syncPaymentById("mollie", "tr_test1", deps);
    await syncPaymentById("mollie", "tr_test2", deps);
    expect(decrypt((await store.findByToken(a.token))!.accountEncrypted!, KEY)).toBe(ACCOUNT);
    expect((await store.findByToken(b.token))!.accountEncrypted).toBeNull();
  });

  it("zonder sleutel: geen rekeningnummer opslaan, waarschuwen, betaling gaat door", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    deps.encryptionKey = null;
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid", "T. TEST", ACCOUNT);

    expect(await getPlayerPayment(token, deps)).toEqual({ status: "paid", creditsLeft: 4, checkoutUrl: null });
    expect(await store.findByToken(token)).toMatchObject({ name: "T. TEST", accountEncrypted: null });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("PAYMENT_ENCRYPTION_KEY"));
    // Het rekeningnummer zelf staat nooit in de log
    expect(JSON.stringify(warn.mock.calls)).not.toContain(ACCOUNT);
  });

  it("versleutelen mislukt: geen rekeningnummer, betaling gaat door", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    deps.encryptionKey = randomBytes(16); // kan alleen als iemand de deps verkeerd maakt
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid", "T. TEST", ACCOUNT);

    expect((await getPlayerPayment(token, deps)).creditsLeft).toBe(4);
    expect((await store.findByToken(token))!.accountEncrypted).toBeNull();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(ACCOUNT);
  });

  it("elk spel kost 1 credit; bij 0 credits is er een nieuwe betaling nodig", async () => {
    const { token } = await start();
    mollie.setStatus("tr_test1", "paid", "T. TEST");
    await syncPaymentById("mollie", "tr_test1", deps);

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
    await syncPaymentById("mollie", "tr_test1", deps);
    await spendCredit(token, deps);
    await syncPaymentById("mollie", "tr_test1", deps); // Mollie stuurt de webhook nog eens
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
    expect(await syncPaymentById("mollie", "tr_test1", deps)).toBe("updated");
    expect((await store.findByToken(token))!.status).toBe("open");

    mollie.setStatus("tr_test1", "paid");
    await syncPaymentById("mollie", "tr_test1", deps);
    expect((await store.findByToken(token))!).toMatchObject({ status: "paid", creditsLeft: 4 });
  });

  it("de webhook negeert onbekende betalingen", async () => {
    expect(await syncPaymentById("mollie", "tr_onbekend", deps)).toBe("unknown");
  });

  it("de webhook meldt een fout als Mollie niet antwoordt (Mollie probeert het later opnieuw)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await start();
    deps.mollie = { ...mollie.client, getPayment: () => Promise.reject(new Error("timeout")) };
    expect(await syncPaymentById("mollie", "tr_test1", deps)).toBe("error");
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
    const { reference } = (await store.findByProviderId("mollie", "tr_test1"))!;
    expect(await getReturnPayment(reference!, deps)).toEqual({ status: "open", amount: "€ 1,00", credits: 4 });

    // De status komt van Mollie, ook als de webhook nog niet is geweest
    mollie.setStatus("tr_test1", "paid", "T. TEST");
    expect(await getReturnPayment(reference!, deps)).toEqual({ status: "paid", amount: "€ 1,00", credits: 4 });
  });

  it("/betaald toont een mislukte betaling als mislukt", async () => {
    await start();
    const { reference } = (await store.findByProviderId("mollie", "tr_test1"))!;
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
    const { reference } = (await store.findByProviderId("mollie", "tr_test1"))!;
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

// Nep-PayPal: facturen in het geheugen, met de naam van de betaler na betalen (taak 13b)
function fakePayPal() {
  const invoices = new Map<string, MolliePayment>();
  const created: CreatePaymentInput[] = [];
  let qrFails = false;
  const client: PayPalClient = {
    async createPayment(input) {
      created.push(input);
      const id = `INV2-TEST-0000-0000-000${invoices.size + 1}`;
      const invoice = { id, status: "open" as const, checkoutUrl: `https://paypal.test/invoice/p/#${id}`, consumerName: null, consumerAccount: null, paidAt: null };
      invoices.set(id, invoice);
      return { ...invoice };
    },
    async getPayment(id) {
      const invoice = invoices.get(id);
      if (!invoice) throw new Error("PayPal 404");
      return { ...invoice };
    },
    async qrCode(id) {
      if (qrFails) throw new Error("PayPal 500");
      return `data:image/png;base64,QR-${id}`;
    },
    verifyWebhook: async () => true,
    live: false,
  };
  function pay(id: string, name: string | null) {
    Object.assign(invoices.get(id)!, { status: "paid", consumerName: name, checkoutUrl: null, paidAt: "2026-10-15" });
  }
  return { client, created, pay, failQr: () => (qrFails = true) };
}

describe("betalen met PayPal (taak 13b)", () => {
  let mollie: ReturnType<typeof fakeMollie>;
  let paypal: ReturnType<typeof fakePayPal>;
  let store: PaymentStore;
  let provider: PaymentProvider;
  let deps: PaymentDeps;

  beforeEach(() => {
    mollie = fakeMollie();
    paypal = fakePayPal();
    store = memoryPaymentStore();
    provider = "paypal";
    deps = {
      priceCents: 100,
      store,
      mollie: mollie.client,
      paypal: paypal.client,
      provider: async () => provider,
      credits: async () => 4,
      encryptionKey: KEY,
    };
  });
  afterEach(() => vi.restoreAllMocks());

  async function start(token?: string) {
    const result = await startPayment(token, ORIGIN, deps);
    if (!result.ok) throw new Error(result.error);
    return result;
  }

  it("maakt een PayPal-factuur van € 1,00 en legt de methode vast", async () => {
    const result = await start();
    expect(result).toMatchObject({ provider: "paypal", providerId: "INV2-TEST-0000-0000-0001" });
    expect(result.payment).toEqual({ status: "open", creditsLeft: 0, checkoutUrl: "https://paypal.test/invoice/p/#INV2-TEST-0000-0000-0001" });
    expect(paypal.created[0]).toMatchObject({ amountCents: 100, description: "Gokkast: 4 spelletjes", webhookUrl: undefined });
    expect(mollie.created).toHaveLength(0);

    const stored = (await store.findByToken(result.token))!;
    expect(stored).toMatchObject({ provider: "paypal", paypalId: "INV2-TEST-0000-0000-0001", mollieId: null });
    expect(paypal.created[0].reference).toBe(stored.reference);
  });

  it("geeft 4 credits na betalen en slaat de naam van de betaler op, zonder rekeningnummer", async () => {
    const { token } = await start();
    paypal.pay("INV2-TEST-0000-0000-0001", "Jan Jansen");
    expect(await getPlayerPayment(token, deps)).toEqual({ status: "paid", creditsLeft: 4, checkoutUrl: null });
    expect(await store.findByToken(token)).toMatchObject({ status: "paid", name: "Jan Jansen", accountEncrypted: null });
    expect(await spendCredit(token, deps)).toMatchObject({ ok: true, payment: { creditsLeft: 3 } });
  });

  it("de webhook van PayPal werkt de juiste betaling bij", async () => {
    const { token } = await start();
    paypal.pay("INV2-TEST-0000-0000-0001", "Jan Jansen");
    expect(await syncPaymentById("paypal", "INV2-TEST-0000-0000-0001", deps)).toBe("updated");
    expect(await store.findByToken(token)).toMatchObject({ status: "paid", creditsLeft: 4 });
    // Een Mollie-ID of een onbekende factuur: niets bijwerken
    expect(await syncPaymentById("mollie", "INV2-TEST-0000-0000-0001", deps)).toBe("unknown");
    expect(await syncPaymentById("paypal", "INV2-TEST-0000-0000-9999", deps)).toBe("unknown");
  });

  it("wisselt de beheerder van methode, dan krijgt een open betaling een nieuwe met de nieuwe methode", async () => {
    const first = await start();
    provider = "mollie";
    const second = await start(first.token);
    expect(second.provider).toBe("mollie");
    expect(second.token).not.toBe(first.token);
    expect(mollie.created).toHaveLength(1);
  });

  it("een betaling met credits blijft staan, ook na het wisselen van methode", async () => {
    const first = await start();
    paypal.pay("INV2-TEST-0000-0000-0001", "Jan Jansen");
    provider = "mollie";
    const again = await start(first.token);
    expect(again).toMatchObject({ token: first.token, provider: "paypal", payment: { creditsLeft: 4 } });
    expect(mollie.created).toHaveLength(0);
  });

  it("een PayPal-betaling blijft leesbaar zolang PayPal ingesteld is; zonder PayPal de opgeslagen status", async () => {
    const { token } = await start();
    paypal.pay("INV2-TEST-0000-0000-0001", "Jan Jansen");
    expect((await getPlayerPayment(token, { ...deps, paypal: null })).status).toBe("open");
    expect((await getPlayerPayment(token, deps)).status).toBe("paid");
  });

  it("de QR-code komt van PayPal; lukt dat niet, dan een eigen van de betaallink", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const id = "INV2-TEST-0000-0000-0001";
    const link = `https://paypal.test/invoice/p/#${id}`;
    expect(await paymentQr("paypal", id, link, deps)).toBe(`data:image/png;base64,QR-${id}`);
    paypal.failQr();
    expect(await paymentQr("paypal", id, link, deps)).toMatch(/^data:image\/svg\+xml/);
    expect(warn).toHaveBeenCalledOnce();
    // Mollie: altijd een eigen QR-code; zonder betaallink geen QR-code
    expect(await paymentQr("mollie", "tr_test1", "https://mollie.test/checkout/tr_test1", deps)).toMatch(/^data:image\/svg\+xml/);
    expect(await paymentQr("paypal", id, null, deps)).toBeNull();
  });
});

describe("choosePaymentProvider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gebruikt de gekozen methode als die ingesteld is, anders de andere met een waarschuwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(choosePaymentProvider("paypal", { mollie: true, paypal: true })).toBe("paypal");
    expect(choosePaymentProvider("mollie", { mollie: true, paypal: false })).toBe("mollie");
    expect(warn).not.toHaveBeenCalled();
    expect(choosePaymentProvider("paypal", { mollie: true, paypal: false })).toBe("mollie");
    expect(choosePaymentProvider("mollie", { mollie: false, paypal: true })).toBe("paypal");
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("isTestPayment (taak 12b)", () => {
  const deps = (paypal: { live: boolean } | null) => ({ paypal }) as unknown as PaymentDeps;

  it("Mollie is altijd een test (alleen een test-key); PayPal alleen echt met de live-API", () => {
    expect(isTestPayment("mollie", deps({ live: true }))).toBe(true);
    expect(isTestPayment("paypal", deps({ live: false }))).toBe(true);
    expect(isTestPayment("paypal", deps(null))).toBe(true);
    expect(isTestPayment("paypal", deps({ live: true }))).toBe(false);
  });
});
