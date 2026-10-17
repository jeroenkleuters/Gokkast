import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPayPalTokens,
  createPayPalClient,
  invoiceEventType,
  invoiceIdFromEvent,
  isPayPalInvoiceId,
  parsePayPalInvoice,
  payPalStatus,
  qrDataUrlFromResponse,
} from "@/lib/paypal";

const ID = "INV2-Z56S-5LLA-Q52L-CPZ5";
const PAYER_VIEW = `https://www.sandbox.paypal.com/invoice/p/#${ID}`;
const config = { clientId: "client", clientSecret: "secret", apiUrl: "https://paypal.test", webhookId: "WH-1", live: false };

const invoice = (status: string, extra: Record<string, unknown> = {}) => ({
  id: ID,
  status,
  detail: { currency_code: "EUR", metadata: { recipient_view_url: PAYER_VIEW } },
  ...extra,
});

const paidInvoice = (shippingInfo: unknown) =>
  invoice("PAID", {
    payments: {
      transactions: [{ payment_id: "7X", payment_date: "2026-10-15", method: "PAYPAL", shipping_info: shippingInfo }],
    },
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// fetch nabootsen per pad; geeft de aanroepen terug als [url, init]
function fakeFetch(routes: (path: string, init: RequestInit) => Response) {
  const calls: [string, RequestInit][] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    if (url.endsWith("/v1/oauth2/token")) return json({ access_token: "A21", expires_in: 32400 });
    return routes(url.replace("https://paypal.test", ""), init);
  }) as unknown as typeof fetch;
  return { fetchFn, calls, api: () => calls.filter(([url]) => !url.endsWith("/v1/oauth2/token")) };
}

describe("isPayPalInvoiceId", () => {
  it("accepteert alleen factuur-ID's van PayPal", () => {
    expect(isPayPalInvoiceId(ID)).toBe(true);
    for (const id of ["", "INV2-", "INV2-AAAA-BBBB-CCCC", "inv2-z56s-5lla-q52l-cpz5", "INV2-../x", "tr_abc", 7]) {
      expect(isPayPalInvoiceId(id), String(id)).toBe(false);
    }
  });
});

describe("payPalStatus", () => {
  it("beeldt de factuurstatussen af op die van het spel", () => {
    expect(["DRAFT", "SENT", "SCHEDULED", "UNPAID", "SHARED"].map(payPalStatus)).toEqual(Array(5).fill("open"));
    expect(["PAYMENT_PENDING", "PARTIALLY_PAID"].map(payPalStatus)).toEqual(["pending", "pending"]);
    expect(["PAID", "MARKED_AS_PAID", "PAID_EXTERNAL"].map(payPalStatus)).toEqual(["paid", "paid", "paid"]);
    expect(["CANCELLED", "AUTO_CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"].map(payPalStatus)).toEqual(Array(4).fill("canceled"));
    expect(payPalStatus("ONBEKEND")).toBeNull();
    expect(payPalStatus(undefined)).toBeNull();
  });
});

describe("parsePayPalInvoice", () => {
  it("een verstuurde factuur: open met de betaallink, nog geen naam", () => {
    expect(parsePayPalInvoice(invoice("SENT"))).toEqual({
      id: ID,
      status: "open",
      checkoutUrl: PAYER_VIEW,
      consumerName: null,
      consumerAccount: null,
      paidAt: null,
    });
  });

  it("na betalen: de naam van de betaler, nooit een rekeningnummer, geen betaallink meer", () => {
    const parsed = parsePayPalInvoice(paidInvoice({ name: { given_name: "Jan", surname: "Jansen" } }));
    expect(parsed).toEqual({
      id: ID,
      status: "paid",
      checkoutUrl: null,
      consumerName: "Jan Jansen",
      consumerAccount: null,
      paidAt: "2026-10-15",
    });
  });

  it("zoekt de naam: volledige naam, voor- en achternaam, bedrijfsnaam, anders de ontvanger", () => {
    expect(parsePayPalInvoice(paidInvoice({ name: { full_name: " P. de Vries " } })).consumerName).toBe("P. de Vries");
    expect(parsePayPalInvoice(paidInvoice({ name: { surname: "Jansen" } })).consumerName).toBe("Jansen");
    expect(parsePayPalInvoice(paidInvoice({ business_name: "Café De Kroeg" })).consumerName).toBe("Café De Kroeg");
    const recipient = {
      ...paidInvoice({}),
      primary_recipients: [{ billing_info: { name: { given_name: "Kees", surname: "Bakker" } } }],
    };
    expect(parsePayPalInvoice(recipient).consumerName).toBe("Kees Bakker");
    expect(parsePayPalInvoice(paidInvoice(undefined)).consumerName).toBeNull();
  });

  it("gooit een fout bij een antwoord dat geen factuur is", () => {
    expect(() => parsePayPalInvoice(null)).toThrow();
    expect(() => parsePayPalInvoice({ id: "tr_abc", status: "PAID" })).toThrow();
    expect(() => parsePayPalInvoice({ id: ID, status: "IETS" })).toThrow();
  });
});

describe("qrDataUrlFromResponse", () => {
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

  it("leest base64-tekst, ook met regeleinden of in een multipart-antwoord", () => {
    const enc = (text: string) => new TextEncoder().encode(text);
    expect(qrDataUrlFromResponse("text/plain", enc(PNG))).toBe(`data:image/png;base64,${PNG}`);
    expect(qrDataUrlFromResponse("text/plain", enc(`${PNG.slice(0, 20)}\r\n${PNG.slice(20)}`))).toBe(`data:image/png;base64,${PNG}`);
    const multipart = `--b\r\nContent-Type: application/json\r\n\r\n${PNG}\r\n--b--`;
    expect(qrDataUrlFromResponse("multipart/mixed; boundary=b", enc(multipart))).toBe(`data:image/png;base64,${PNG}`);
  });

  it("zet een echte PNG om naar base64", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(qrDataUrlFromResponse("image/png", bytes)).toBe("data:image/png;base64,iVBORw==");
  });

  it("gooit een fout als er geen QR-code in staat", () => {
    expect(() => qrDataUrlFromResponse("application/json", new TextEncoder().encode("{}"))).toThrow();
  });
});

describe("webhook-berichten", () => {
  it("leest het factuur-ID en alleen berichten over facturen", () => {
    expect(invoiceIdFromEvent({ resource: { invoice: { id: ID } } })).toBe(ID);
    expect(invoiceIdFromEvent({ resource: { id: ID } })).toBe(ID);
    expect(invoiceIdFromEvent({ resource: { id: "../x" } })).toBeNull();
    expect(invoiceIdFromEvent(null)).toBeNull();
    expect(invoiceEventType({ event_type: "INVOICING.INVOICE.PAID" })).toBe(true);
    expect(invoiceEventType({ event_type: "PAYMENT.CAPTURE.COMPLETED" })).toBe(false);
  });
});

describe("createPayPalClient", () => {
  beforeEach(() => clearPayPalTokens());
  afterEach(() => vi.restoreAllMocks());

  it("maakt een factuur, verstuurt die zonder e-mail en geeft de betaallink", async () => {
    const { fetchFn, api } = fakeFetch((path) => {
      if (path === "/v2/invoicing/invoices") return json(invoice("DRAFT"), 201);
      if (path.endsWith("/send")) return json({ href: PAYER_VIEW, rel: "payer-view", method: "GET" });
      return json(invoice("UNPAID"));
    });
    const payment = await createPayPalClient(config, fetchFn).createPayment({
      amountCents: 100,
      description: "Gokkast: 4 spelletjes",
      reference: "r".repeat(16),
      redirectUrl: "https://gokkast.test/betaald",
    });

    expect(payment).toMatchObject({ id: ID, status: "open", checkoutUrl: PAYER_VIEW });
    const [create, send, get] = api();
    expect(create[0]).toBe("https://paypal.test/v2/invoicing/invoices");
    expect(create[1].method).toBe("POST");
    expect((create[1].headers as Record<string, string>).Authorization).toBe("Bearer A21");
    expect((create[1].headers as Record<string, string>).Prefer).toBe("return=representation");
    expect(JSON.parse(create[1].body as string)).toEqual({
      detail: { currency_code: "EUR", reference: "r".repeat(16), note: "Gokkast: 4 spelletjes" },
      items: [{ name: "Gokkast: 4 spelletjes", quantity: "1", unit_amount: { currency_code: "EUR", value: "1.00" } }],
    });
    expect(send[0]).toBe(`https://paypal.test/v2/invoicing/invoices/${ID}/send`);
    expect(JSON.parse(send[1].body as string)).toEqual({ send_to_recipient: false, send_to_invoicer: false });
    expect(get[0]).toBe(`https://paypal.test/v2/invoicing/invoices/${ID}`);
  });

  it("haalt een toegangstoken met client-ID en secret en hergebruikt het", async () => {
    const { fetchFn, calls } = fakeFetch(() => json(invoice("SENT")));
    const client = createPayPalClient(config, fetchFn);
    await client.getPayment(ID);
    await client.getPayment(ID);

    const tokenCalls = calls.filter(([url]) => url.endsWith("/v1/oauth2/token"));
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0][0]).toBe("https://paypal.test/v1/oauth2/token");
    expect((tokenCalls[0][1].headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("client:secret").toString("base64")}`,
    );
    expect(tokenCalls[0][1].body).toBe("grant_type=client_credentials");
  });

  it.each([
    [401, "AUTHENTICATION_FAILURE"],
    [403, "NOT_AUTHORIZED"], // bijv. Invoicing pas later aangezet in de app: het oude token heeft dat recht niet
  ])("vraagt na een %i een nieuw token", async (status, name) => {
    let first = true;
    const { fetchFn, calls } = fakeFetch(() => {
      if (first) {
        first = false;
        return json({ name }, status);
      }
      return json(invoice("SENT"));
    });
    const client = createPayPalClient(config, fetchFn);
    await expect(client.getPayment(ID)).rejects.toThrow(`PayPal ${status}`);
    await client.getPayment(ID);
    expect(calls.filter(([url]) => url.endsWith("/v1/oauth2/token"))).toHaveLength(2);
  });

  it("houdt het token bij andere fouten", async () => {
    let first = true;
    const { fetchFn, calls } = fakeFetch(() => {
      if (first) {
        first = false;
        return json({ name: "RESOURCE_NOT_FOUND" }, 404);
      }
      return json(invoice("SENT"));
    });
    const client = createPayPalClient(config, fetchFn);
    await expect(client.getPayment(ID)).rejects.toThrow("PayPal 404");
    await client.getPayment(ID);
    expect(calls.filter(([url]) => url.endsWith("/v1/oauth2/token"))).toHaveLength(1);
  });

  it("geeft een fout met de melding van PayPal en weigert een ongeldig ID zonder aanroep", async () => {
    const { fetchFn, api } = fakeFetch(() => json({ name: "RESOURCE_NOT_FOUND", message: "Invoice not found" }, 404));
    const client = createPayPalClient(config, fetchFn);
    await expect(client.getPayment(ID)).rejects.toThrow("PayPal 404: Invoice not found");
    await expect(client.getPayment("../x")).rejects.toThrow("ongeldig");
    await expect(client.qrCode("../x")).rejects.toThrow("ongeldig");
    expect(api()).toHaveLength(1);
  });

  it("haalt de QR-code bij PayPal", async () => {
    const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    const { fetchFn, api } = fakeFetch(() => new Response(PNG, { headers: { "Content-Type": "text/plain" } }));
    expect(await createPayPalClient(config, fetchFn).qrCode(ID)).toBe(`data:image/png;base64,${PNG}`);
    const [[url, init]] = api();
    expect(url).toBe(`https://paypal.test/v2/invoicing/invoices/${ID}/generate-qr-code`);
    expect(JSON.parse(init.body as string)).toEqual({ width: 300, height: 300, action: "pay" });
  });

  describe("verifyWebhook", () => {
    const headers = new Headers({
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
      "paypal-transmission-id": "t-1",
      "paypal-transmission-sig": "sig",
      "paypal-transmission-time": "2026-10-15T10:00:00Z",
    });
    // Precies zoals PayPal het stuurde (bijv. 1.00 blijft 1.00): de handtekening hoort bij deze tekst
    const raw = '{"id":"WH-EV","event_type":"INVOICING.INVOICE.PAID","resource":{"invoice":{"id":"INV2-Z56S-5LLA-Q52L-CPZ5","amount":1.00}}}';

    it("laat PayPal de handtekening controleren met het ongewijzigde bericht", async () => {
      const { fetchFn, api } = fakeFetch(() => json({ verification_status: "SUCCESS" }));
      expect(await createPayPalClient(config, fetchFn).verifyWebhook(headers, raw)).toBe(true);
      const [[url, init]] = api();
      expect(url).toBe("https://paypal.test/v1/notifications/verify-webhook-signature");
      expect(init.body).toContain(`"webhook_event":${raw}}`);
      expect(JSON.parse(init.body as string)).toMatchObject({
        auth_algo: "SHA256withRSA",
        transmission_id: "t-1",
        webhook_id: "WH-1",
      });
    });

    it("weigert bij een mislukte controle, zonder headers of zonder webhook-ID", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { fetchFn, api } = fakeFetch(() => json({ verification_status: "FAILURE" }));
      expect(await createPayPalClient(config, fetchFn).verifyWebhook(headers, raw)).toBe(false);
      expect(await createPayPalClient(config, fetchFn).verifyWebhook(new Headers(), raw)).toBe(false);
      expect(await createPayPalClient({ ...config, webhookId: null }, fetchFn).verifyWebhook(headers, raw)).toBe(false);
      expect(api()).toHaveLength(1); // alleen de eerste ging naar PayPal
    });
  });
});
