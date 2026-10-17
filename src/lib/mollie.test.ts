import { describe, expect, it } from "vitest";
import { createMollieClient, isMollieId, parseMolliePayment } from "@/lib/mollie";

const config = { apiKey: "test_abc", apiUrl: "https://mollie.test/v2", priceCents: 100, live: false };

const molliePayment = {
  resource: "payment",
  id: "tr_WDqYK6vllg",
  status: "open",
  amount: { currency: "EUR", value: "1.00" },
  _links: { checkout: { href: "https://www.mollie.com/checkout/select-method/WDqYK6vllg" } },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// fetch nabootsen; geeft de aanroepen terug als [url, init]
function fakeFetch(response: () => Response) {
  const calls: [string, RequestInit][] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return response();
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("parseMolliePayment", () => {
  it("haalt ID, status en betaallink uit het antwoord", () => {
    expect(parseMolliePayment(molliePayment)).toEqual({
      id: "tr_WDqYK6vllg",
      status: "open",
      checkoutUrl: "https://www.mollie.com/checkout/select-method/WDqYK6vllg",
      consumerName: null,
      consumerAccount: null,
      paidAt: null,
    });
  });

  it("neemt naam en rekeningnummer van de rekeninghouder over na betalen", () => {
    const paid = {
      ...molliePayment,
      status: "paid",
      paidAt: "2026-10-14T10:00:00+00:00",
      details: { consumerName: " T. TEST ", consumerAccount: "NL53INGB0654422370" },
      _links: {},
    };
    expect(parseMolliePayment(paid)).toMatchObject({
      status: "paid",
      consumerName: "T. TEST",
      consumerAccount: "NL53INGB0654422370",
      checkoutUrl: null,
    });
  });

  it("weigert een antwoord dat geen betaling is", () => {
    for (const body of [null, {}, { id: "tr_x", status: "betaald" }, { id: "ord_1", status: "paid" }]) {
      expect(() => parseMolliePayment(body), JSON.stringify(body)).toThrow();
    }
  });
});

describe("isMollieId", () => {
  it("alleen tr_ gevolgd door letters en cijfers", () => {
    expect(isMollieId("tr_WDqYK6vllg")).toBe(true);
    for (const id of ["", "tr_", "tr_../x", "WDqYK6vllg", "tr_a b", 7]) expect(isMollieId(id)).toBe(false);
  });
});

describe("createMollieClient", () => {
  it("geeft door of het om echte betalingen gaat (taak 12a)", () => {
    const { fetchFn } = fakeFetch(() => json(molliePayment));
    expect(createMollieClient(config, fetchFn).live).toBe(false);
    expect(createMollieClient({ ...config, apiKey: "live_abc", live: true }, fetchFn).live).toBe(true);
  });

  it("maakt een betaling met bedrag, omschrijving, terugkeer en webhook", async () => {
    const { fetchFn, calls } = fakeFetch(() => json(molliePayment, 201));
    const payment = await createMollieClient(config, fetchFn).createPayment({
      amountCents: 100,
      description: "Gokkast: 4 spelletjes",
      reference: "r".repeat(16),
      redirectUrl: "https://gokkast.test/betaald",
      webhookUrl: "https://gokkast.test/api/mollie/webhook",
    });

    expect(payment.id).toBe("tr_WDqYK6vllg");
    const [url, init] = calls[0];
    expect(url).toBe("https://mollie.test/v2/payments");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test_abc");
    expect(JSON.parse(init.body as string)).toEqual({
      amount: { currency: "EUR", value: "1.00" },
      description: "Gokkast: 4 spelletjes",
      redirectUrl: "https://gokkast.test/betaald",
      webhookUrl: "https://gokkast.test/api/mollie/webhook",
    });
  });

  it("stuurt geen webhookUrl mee als er geen is (localhost)", async () => {
    const { fetchFn, calls } = fakeFetch(() => json(molliePayment, 201));
    await createMollieClient(config, fetchFn).createPayment({
      amountCents: 100,
      description: "x",
      reference: "r".repeat(16),
      redirectUrl: "http://localhost:3000/betaald",
    });
    expect(JSON.parse(calls[0][1].body as string)).not.toHaveProperty("webhookUrl");
  });

  it("haalt een betaling op", async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ ...molliePayment, status: "paid" }));
    expect((await createMollieClient(config, fetchFn).getPayment("tr_WDqYK6vllg")).status).toBe("paid");
    expect(calls[0][0]).toBe("https://mollie.test/v2/payments/tr_WDqYK6vllg");
  });

  it("vraagt een ongeldig ID niet op bij Mollie", async () => {
    const { fetchFn, calls } = fakeFetch(() => json(molliePayment));
    await expect(createMollieClient(config, fetchFn).getPayment("tr_../../methods")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("geeft een fout met de melding van Mollie", async () => {
    const { fetchFn } = fakeFetch(() => json({ status: 401, detail: "Missing authentication" }, 401));
    await expect(createMollieClient(config, fetchFn).getPayment("tr_WDqYK6vllg")).rejects.toThrow(
      "Mollie 401: Missing authentication",
    );
  });
});
