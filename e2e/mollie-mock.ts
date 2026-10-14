// Nep-Mollie voor de Playwright-tests (taak 10): geen echte Mollie-aanroepen.
// Doet de twee API-aanroepen van src/lib/mollie.ts na, plus een betaalpagina waarop je,
// net als op de testpagina van Mollie, zelf kiest hoe de betaling afloopt.
// Starten: npx tsx e2e/mollie-mock.ts (doet playwright.config.ts zelf)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MOCK_API_KEY, MOCK_CONSUMER_ACCOUNT, MOCK_CONSUMER_NAME, MOLLIE_MOCK_PORT } from "./payments";

const port = MOLLIE_MOCK_PORT;
const base = `http://localhost:${port}`;

interface MockPayment {
  id: string;
  status: string;
  amount: { currency: string; value: string };
  description: string;
  redirectUrl: string;
  consumerName: string | null;
}

const payments = new Map<string, MockPayment>();

function toJson(p: MockPayment) {
  return {
    resource: "payment",
    id: p.id,
    mode: "test",
    status: p.status,
    amount: p.amount,
    description: p.description,
    redirectUrl: p.redirectUrl,
    ...(p.status === "paid" && { paidAt: new Date().toISOString(), details: { consumerName: p.consumerName, consumerAccount: MOCK_CONSUMER_ACCOUNT } }),
    _links: p.status === "open" ? { checkout: { href: `${base}/checkout/${p.id}` } } : {},
  };
}

async function body(req: IncomingMessage): Promise<string> {
  let data = "";
  for await (const chunk of req) data += chunk;
  return data;
}

function send(res: ServerResponse, status: number, data: unknown, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(data) : String(data));
}

const STATUSES = { paid: "Betaald", canceled: "Geannuleerd", failed: "Mislukt", expired: "Verlopen" };

function checkoutPage(p: MockPayment) {
  const buttons = Object.entries(STATUSES)
    .map(([value, label]) => `<button name="status" value="${value}">${label}</button>`)
    .join(" ");
  return `<!doctype html><meta charset="utf-8"><title>Nep-Mollie</title>
    <h1>Testbetaling ${p.id}</h1><p>${p.description} — € ${p.amount.value}</p>
    <form method="post">${buttons}</form>`;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", base);
  const [, first, second, id] = url.pathname.split("/");

  // API: alleen met de test-key
  if (first === "v2" && second === "payments") {
    if (req.headers.authorization !== `Bearer ${MOCK_API_KEY}`) return send(res, 401, { status: 401, detail: "Missing authentication" });
    if (req.method === "POST" && !id) {
      const input = JSON.parse(await body(req));
      const payment: MockPayment = {
        id: `tr_e2e${payments.size + 1}`,
        status: "open",
        amount: input.amount,
        description: input.description,
        redirectUrl: input.redirectUrl,
        consumerName: null,
      };
      payments.set(payment.id, payment);
      return send(res, 201, toJson(payment));
    }
    const payment = id && payments.get(id);
    if (req.method === "GET" && payment) return send(res, 200, toJson(payment));
    return send(res, 404, { status: 404, detail: "Not found" });
  }

  // Betaalpagina: de speler kiest de uitkomst, daarna terug naar het spel (redirectUrl)
  if (first === "checkout" && second) {
    const payment = payments.get(second);
    if (!payment) return send(res, 404, "Onbekende betaling", "text/plain");
    if (req.method === "POST") {
      const status = new URLSearchParams(await body(req)).get("status") ?? "";
      if (status in STATUSES && payment.status === "open") {
        payment.status = status;
        if (status === "paid") payment.consumerName = MOCK_CONSUMER_NAME;
      }
      res.writeHead(303, { Location: payment.redirectUrl });
      return res.end();
    }
    return send(res, 200, checkoutPage(payment), "text/html; charset=utf-8");
  }

  send(res, url.pathname === "/" ? 200 : 404, "nep-Mollie", "text/plain");
}).listen(port, () => console.log(`Nep-Mollie op ${base}`));
