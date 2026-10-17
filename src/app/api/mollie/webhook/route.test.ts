import { beforeEach, describe, expect, it, vi } from "vitest";

// De route zonder Mollie of database: alleen wat er met het verzoek gebeurt.
// De verwerking zelf (status ophalen bij Mollie) staat in paymentService.test.ts.
const defaultPaymentDeps = vi.fn();
const syncPaymentById = vi.fn();
vi.mock("@/lib/paymentService", () => ({ defaultPaymentDeps, syncPaymentById }));

const { POST } = await import("./route");

const webhook = (body: string) =>
  POST(
    new Request("https://gokkast.test/api/mollie/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
  );

describe("POST /api/mollie/webhook", () => {
  const deps = { mollie: {} };

  beforeEach(() => {
    vi.resetAllMocks();
    defaultPaymentDeps.mockReturnValue(deps);
    syncPaymentById.mockResolvedValue("updated");
  });

  it("verwerkt het ID van Mollie", async () => {
    expect((await webhook("id=tr_WDqYK6vllg")).status).toBe(200);
    expect(syncPaymentById).toHaveBeenCalledExactlyOnceWith("mollie", "tr_WDqYK6vllg", deps);
  });

  it("negeert een meegestuurde status: alleen het ID telt", async () => {
    await webhook("id=tr_WDqYK6vllg&status=paid");
    expect(syncPaymentById).toHaveBeenCalledExactlyOnceWith("mollie", "tr_WDqYK6vllg", deps);
  });

  it("weigert een verzoek zonder geldig ID", async () => {
    for (const body of ["", "id=", "id=123", "id=tr_../x"]) {
      expect((await webhook(body)).status, body).toBe(400);
    }
    expect(syncPaymentById).not.toHaveBeenCalled();
  });

  it("geeft 200 bij een onbekende betaling", async () => {
    syncPaymentById.mockResolvedValue("unknown");
    expect((await webhook("id=tr_onbekend")).status).toBe(200);
  });

  it("geeft 500 bij een fout, zodat Mollie het opnieuw probeert", async () => {
    syncPaymentById.mockResolvedValue("error");
    expect((await webhook("id=tr_WDqYK6vllg")).status).toBe(500);
  });

  it("bestaat niet als betalen uit staat", async () => {
    defaultPaymentDeps.mockReturnValue(null);
    expect((await webhook("id=tr_WDqYK6vllg")).status).toBe(404);
    expect(syncPaymentById).not.toHaveBeenCalled();
  });
});
