// Webhook van Mollie: bij elke statuswijziging stuurt Mollie alleen het ID van de betaling
// (id=tr_..., als formulier). De status zelf halen we op bij Mollie, zodat een nagemaakt verzoek
// niets kan vrijgeven. https://docs.mollie.com/reference/webhooks
import { isMollieId } from "@/lib/mollie";
import { defaultPaymentDeps, syncPaymentById } from "@/lib/paymentService";

export async function POST(request: Request) {
  const deps = defaultPaymentDeps();
  if (!deps) return new Response(null, { status: 404 }); // betalen staat uit

  const form = await request.formData().catch(() => null);
  const id = form?.get("id");
  if (!isMollieId(id)) return new Response(null, { status: 400 });

  // Onbekend ID: toch 200, zodat Mollie niet blijft proberen en niemand kan aftasten welke ID's bestaan.
  // Bij een fout 500: Mollie probeert het later opnieuw.
  const result = await syncPaymentById(id, deps);
  return new Response(null, { status: result === "error" ? 500 : 200 });
}
