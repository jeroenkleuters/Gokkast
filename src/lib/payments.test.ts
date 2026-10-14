import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRICE_CENTS,
  formatEuro,
  isFinalStatus,
  isPaymentToken,
  memoryStoreAllowed,
  MOLLIE_API_URL,
  mollieAmount,
  newPaymentToken,
  readPaymentConfig,
  webhookUrl,
} from "@/lib/payments";

describe("readPaymentConfig", () => {
  afterEach(() => vi.restoreAllMocks());

  it("staat uit zonder MOLLIE_API_KEY (spel gratis)", () => {
    expect(readPaymentConfig({})).toBeNull();
    expect(readPaymentConfig({ MOLLIE_API_KEY: "  " })).toBeNull();
  });

  it("gebruikt een test-key met de standaardprijs en de echte Mollie-API", () => {
    expect(readPaymentConfig({ MOLLIE_API_KEY: "test_abc" })).toEqual({
      apiKey: "test_abc",
      apiUrl: MOLLIE_API_URL,
      priceCents: DEFAULT_PRICE_CENTS,
    });
    expect(DEFAULT_PRICE_CENTS).toBe(100);
  });

  it("weigert een live-key: geen echte betalingen in deze versie", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readPaymentConfig({ MOLLIE_API_KEY: "live_abc" })).toBeNull();
    expect(readPaymentConfig({ MOLLIE_API_KEY: "iets_anders" })).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("leest de prijs en een andere API-url (voor tests)", () => {
    const config = readPaymentConfig({
      MOLLIE_API_KEY: "test_abc",
      GAME_PRICE_CENTS: "250",
      MOLLIE_API_URL: "http://localhost:3101/v2/",
    });
    expect(config).toMatchObject({ priceCents: 250, apiUrl: "http://localhost:3101/v2" });
  });

  it("valt terug op de standaardprijs bij een ongeldige prijs", () => {
    for (const price of ["0", "-5", "1.50", "abc", "10001"]) {
      expect(readPaymentConfig({ MOLLIE_API_KEY: "test_abc", GAME_PRICE_CENTS: price })?.priceCents, price).toBe(100);
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
});
