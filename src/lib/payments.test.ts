import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRICE_CENTS,
  formatEuro,
  isFinalStatus,
  isPaymentReference,
  isPaymentToken,
  memoryStoreAllowed,
  MOLLIE_API_URL,
  mollieAmount,
  newPaymentReference,
  newPaymentToken,
  PAYPAL_LIVE_API_URL,
  PAYPAL_SANDBOX_API_URL,
  readMollieConfig,
  readPayPalConfig,
  readPriceCents,
  webhookUrl,
} from "@/lib/payments";

describe("readMollieConfig", () => {
  afterEach(() => vi.restoreAllMocks());

  it("staat uit zonder MOLLIE_API_KEY (spel gratis)", () => {
    expect(readMollieConfig({})).toBeNull();
    expect(readMollieConfig({ MOLLIE_API_KEY: "  " })).toBeNull();
  });

  it("gebruikt een test-key met de standaardprijs en de echte Mollie-API", () => {
    expect(readMollieConfig({ MOLLIE_API_KEY: "test_abc" })).toEqual({
      apiKey: "test_abc",
      apiUrl: MOLLIE_API_URL,
      priceCents: DEFAULT_PRICE_CENTS,
    });
    expect(DEFAULT_PRICE_CENTS).toBe(100);
  });

  it("weigert een live-key: geen echte betalingen in deze versie", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readMollieConfig({ MOLLIE_API_KEY: "live_abc" })).toBeNull();
    expect(readMollieConfig({ MOLLIE_API_KEY: "iets_anders" })).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("leest de prijs en een andere API-url (voor tests)", () => {
    const config = readMollieConfig({
      MOLLIE_API_KEY: "test_abc",
      GAME_PRICE_CENTS: "250",
      MOLLIE_API_URL: "http://localhost:3101/v2/",
    });
    expect(config).toMatchObject({ priceCents: 250, apiUrl: "http://localhost:3101/v2" });
  });

  it("valt terug op de standaardprijs bij een ongeldige prijs", () => {
    for (const price of ["0", "-5", "1.50", "abc", "10001"]) {
      expect(readMollieConfig({ MOLLIE_API_KEY: "test_abc", GAME_PRICE_CENTS: price })?.priceCents, price).toBe(100);
    }
  });
});

describe("memoryStoreAllowed", () => {
  it("alleen met de testvlag, zonder database en niet in productie", () => {
    expect(memoryStoreAllowed({ PAYMENTS_TEST_STORE: "true" })).toBe(true);
    expect(memoryStoreAllowed({})).toBe(false);
    expect(memoryStoreAllowed({ PAYMENTS_TEST_STORE: "true", DATABASE_URL: "postgres://x" })).toBe(false);
    expect(memoryStoreAllowed({ PAYMENTS_TEST_STORE: "true", VERCEL_ENV: "production" })).toBe(false);
  });
});

describe("bedragen", () => {
  it("geeft Mollie het bedrag met twee decimalen", () => {
    expect(mollieAmount(100)).toBe("1.00");
    expect(mollieAmount(5)).toBe("0.05");
    expect(mollieAmount(1250)).toBe("12.50");
  });

  it("toont het bedrag in euro's", () => {
    expect(formatEuro(100)).toBe("€ 1,00");
    expect(formatEuro(1250)).toBe("€ 12,50");
  });
});

describe("token", () => {
  it("maakt willekeurige, geldige tokens", () => {
    const a = newPaymentToken();
    const b = newPaymentToken();
    expect(isPaymentToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("weigert alles wat geen token is", () => {
    for (const value of [undefined, "", "kort", "a".repeat(31), "a".repeat(33), "!".repeat(32), 42]) {
      expect(isPaymentToken(value)).toBe(false);
    }
  });
});

describe("isFinalStatus", () => {
  it("betaald en mislukt zijn definitief, open en in behandeling niet", () => {
    for (const s of ["paid", "canceled", "expired", "failed"] as const) expect(isFinalStatus(s)).toBe(true);
    for (const s of ["open", "pending", "authorized"] as const) expect(isFinalStatus(s)).toBe(false);
  });
});

describe("webhookUrl", () => {
  it("geeft de webhook op een bereikbaar adres", () => {
    expect(webhookUrl("https://gokkast.vercel.app")).toBe("https://gokkast.vercel.app/api/mollie/webhook");
  });

  it("geen webhook op localhost (Mollie kan daar niet bij)", () => {
    expect(webhookUrl("http://localhost:3000")).toBeUndefined();
    expect(webhookUrl("http://127.0.0.1:3100")).toBeUndefined();
  });

  it("in een preview met het bypass-geheim van Vercel, zodat Deployment Protection de webhook doorlaat", () => {
    const preview = { VERCEL_ENV: "preview", VERCEL_AUTOMATION_BYPASS_SECRET: "geheim+/=" };
    expect(webhookUrl("https://gokkast-abc.vercel.app", preview)).toBe(
      "https://gokkast-abc.vercel.app/api/mollie/webhook?x-vercel-protection-bypass=geheim%2B%2F%3D",
    );
    // Nooit in productie, en niet zonder geheim
    expect(webhookUrl("https://gokkast.vercel.app", { ...preview, VERCEL_ENV: "production" })).toBe(
      "https://gokkast.vercel.app/api/mollie/webhook",
    );
    expect(webhookUrl("https://gokkast-abc.vercel.app", { VERCEL_ENV: "preview" })).toBe(
      "https://gokkast-abc.vercel.app/api/mollie/webhook",
    );
  });
});

describe("referentie voor /betaald", () => {
  it("maakt willekeurige, geldige referenties", () => {
    const a = newPaymentReference();
    expect(isPaymentReference(a)).toBe(true);
    expect(a).not.toBe(newPaymentReference());
  });

  it("weigert alles wat geen referentie is, ook een token", () => {
    for (const value of [undefined, "", "kort", "a".repeat(15), "a".repeat(17), "!".repeat(16), newPaymentToken(), 42]) {
      expect(isPaymentReference(value)).toBe(false);
    }
    expect(isPaymentToken(newPaymentReference())).toBe(false);
  });
});

describe("readPayPalConfig (taak 13b)", () => {
  afterEach(() => vi.restoreAllMocks());
  const keys = { PAYPAL_CLIENT_ID: "client", PAYPAL_CLIENT_SECRET: "secret" };

  it("staat uit zonder client-ID of secret", () => {
    expect(readPayPalConfig({})).toBeNull();
    expect(readPayPalConfig({ PAYPAL_CLIENT_ID: "client" })).toBeNull();
    expect(readPayPalConfig({ PAYPAL_CLIENT_SECRET: "secret", PAYPAL_CLIENT_ID: " " })).toBeNull();
  });

  it("gebruikt de sandbox, met het webhook-ID als dat er is", () => {
    expect(readPayPalConfig(keys)).toEqual({
      clientId: "client",
      clientSecret: "secret",
      apiUrl: PAYPAL_SANDBOX_API_URL,
      webhookId: null,
      live: false,
    });
    expect(readPayPalConfig({ ...keys, PAYPAL_ENV: " Sandbox " })?.live).toBe(false);
    expect(readPayPalConfig({ ...keys, PAYPAL_WEBHOOK_ID: "WH-1" })?.webhookId).toBe("WH-1");
    expect(readPayPalConfig({ ...keys, VERCEL_ENV: "preview" })?.apiUrl).toBe(PAYPAL_SANDBOX_API_URL);
  });

  it("een andere API-url mag (nep-PayPal van de tests), live PayPal niet", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readPayPalConfig({ ...keys, PAYPAL_API_URL: "http://localhost:3103/" })?.apiUrl).toBe("http://localhost:3103");
    expect(readPayPalConfig({ ...keys, PAYPAL_API_URL: "https://api-m.paypal.com" })).toBeNull();
    expect(readPayPalConfig({ ...keys, PAYPAL_API_URL: "geen url" })).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("productie zonder PAYPAL_ENV=live: PayPal uit (nooit de sandbox in productie)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readPayPalConfig({ ...keys, VERCEL_ENV: "production" })).toBeNull();
    expect(readPayPalConfig({ ...keys, VERCEL_ENV: "production", PAYPAL_ENV: "sandbox" })).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("productie met PAYPAL_ENV=live: de live-API, ook als PAYPAL_API_URL iets anders zegt (taak 12b)", () => {
    const live = { ...keys, VERCEL_ENV: "production", PAYPAL_ENV: "live", PAYPAL_WEBHOOK_ID: "WH-LIVE" };
    expect(readPayPalConfig(live)).toEqual({
      clientId: "client",
      clientSecret: "secret",
      apiUrl: PAYPAL_LIVE_API_URL,
      webhookId: "WH-LIVE",
      live: true,
    });
    expect(readPayPalConfig({ ...live, PAYPAL_API_URL: "http://localhost:3103" })?.apiUrl).toBe(PAYPAL_LIVE_API_URL);
  });

  it("PAYPAL_ENV=live buiten productie wordt geweigerd: nooit echt geld in preview of lokaal", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readPayPalConfig({ ...keys, PAYPAL_ENV: "live" })).toBeNull();
    expect(readPayPalConfig({ ...keys, PAYPAL_ENV: "live", VERCEL_ENV: "preview" })).toBeNull();
    expect(readPayPalConfig({ ...keys, PAYPAL_ENV: "echt" })).toBeNull();
    expect(error).toHaveBeenCalledTimes(3);
  });

  it("de prijs geldt voor Mollie en PayPal", () => {
    expect(readPriceCents({})).toBe(100);
    expect(readPriceCents({ GAME_PRICE_CENTS: "250" })).toBe(250);
  });
});
