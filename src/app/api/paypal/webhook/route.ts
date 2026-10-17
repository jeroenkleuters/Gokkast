// Webhook van PayPal (taak 13b): bij een betaalde of geannuleerde factuur stuurt PayPal een bericht.
// Eerst laat PayPal zelf de handtekening controleren (PAYPAL_WEBHOOK_ID); daarna gebruiken we alleen
// het factuur-ID en halen we de status zelf op bij PayPal, zodat een nagemaakt verzoek niets kan
// vrijgeven. https://developer.paypal.com/api/rest/webhooks/
import { defaultPaymentDeps, syncPaymentById } from "@/lib/paymentService";
import { invoiceEventType, invoiceIdFromEvent } from "@/lib/paypal";

export async function POST(request: Request) {
  const deps = defaultPaymentDeps();
  if (!deps?.paypal) return new Response(null, { status: 404 }); // PayPal staat uit

  const raw = await request.text();
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const verified = await deps.paypal.verifyWebhook(request.headers, raw).catch((error) => {
    console.error("Handtekening van de PayPal-webhook niet gecontroleerd:", error);
    return null;
  });
  if (verified === null) return new Response(null, { status: 500 }); // PayPal probeert het later opnieuw
  if (!verified) return new Response(null, { status: 401 });

  // Andere berichten (bijv. herinneringen) of zonder factuur: niets te doen
  const id = invoiceIdFromEvent(event);
  if (!invoiceEventType(event) || !id) return new Response(null, { status: 200 });

  // Onbekend ID: toch 200, zodat PayPal niet blijft proberen; bij een fout 500: later opnieuw
  const result = await syncPaymentById("paypal", id, deps);
  return new Response(null, { status: result === "error" ? 500 : 200 });
}
