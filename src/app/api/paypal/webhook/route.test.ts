import { beforeEach, describe, expect, it, vi } from "vitest";

// De route zonder PayPal of database: alleen wat er met het verzoek gebeurt.
// De verwerking zelf (status ophalen bij PayPal) staat in paymentService.test.ts.
const defaultPaymentDeps = vi.fn();
const syncPaymentById = vi.fn();
vi.mock("@/lib/paymentService", () => ({ defaultPaymentDeps, syncPaymentById }));

const { POST } = await import("./route");

const ID = "INV2-Z56S-5LLA-Q52L-CPZ5";
const event = (type: string, resource: unknown = { invoice: { id: ID } }) =>
  JSON.stringify({ id: "WH-EV", event_type: type, resource });

const webhook = (body: string) =>
  POST(new Request("https://gokkast.test/api/paypal/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body }));

describe("POST /api/paypal/webhook", () => {
  const verifyWebhook = vi.fn();
  const deps = { paypal: { verifyWebhook } };

  beforeEach(() => {
    vi.resetAllMocks();
    defaultPaymentDeps.mockReturnValue(deps);
    verifyWebhook.mockResolvedValue(true);
    syncPaymentById.mockResolvedValue("updated");
  });

  it("verwerkt een betaalde factuur na controle van de handtekening", async () => {
    const body = event("INVOICING.INVOICE.PAID");
    expect((await webhook(body)).status).toBe(200);
    expect(verifyWebhook).toHaveBeenCalledExactlyOnceWith(expect.any(Headers), body);
    expect(syncPaymentById).toHaveBeenCalledExactlyOnceWith("paypal", ID, deps);
  });

  it("weigert een bericht met een ongeldige handtekening", async () => {
    verifyWebhook.mockResolvedValue(false);
    expect((await webhook(event("INVOICING.INVOICE.PAID"))).status).toBe(401);
    expect(syncPaymentById).not.toHaveBeenCalled();
  });

  it("geeft 500 als de controle niet lukt, zodat PayPal het opnieuw probeert", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    verifyWebhook.mockRejectedValue(new Error("PayPal 503"));
    expect((await webhook(event("INVOICING.INVOICE.PAID"))).status).toBe(500);
    expect(syncPaymentById).not.toHaveBeenCalled();
  });

  it("negeert andere berichten en berichten zonder geldig factuur-ID", async () => {
    expect((await webhook(event("PAYMENT.CAPTURE.COMPLETED"))).status).toBe(200);
    expect((await webhook(event("INVOICING.INVOICE.PAID", { invoice: { id: "../x" } }))).status).toBe(200);
    expect(syncPaymentById).not.toHaveBeenCalled();
  });

  it("weigert een bericht dat geen JSON is", async () => {
    expect((await webhook("geen json")).status).toBe(400);
    expect(verifyWebhook).not.toHaveBeenCalled();
  });

  it("geeft 500 bij een fout bij het bijwerken; 404 als PayPal uit staat", async () => {
    syncPaymentById.mockResolvedValue("error");
    expect((await webhook(event("INVOICING.INVOICE.PAID"))).status).toBe(500);
    defaultPaymentDeps.mockReturnValue({ paypal: null });
    expect((await webhook(event("INVOICING.INVOICE.PAID"))).status).toBe(404);
  });
});
