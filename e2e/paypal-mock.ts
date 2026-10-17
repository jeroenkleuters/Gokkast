// Nep-PayPal voor de Playwright-tests (taak 13b): geen echte PayPal-aanroepen.
// Doet de aanroepen van src/lib/paypal.ts na (token, factuur maken, versturen, ophalen, QR-code),
// plus een betaalpagina waarop je zelf kiest hoe de betaling afloopt. Net als bij echte PayPal
// gaat de betaler daarna niet terug naar het spel.
// Starten: npx tsx e2e/paypal-mock.ts (doet playwright.config.ts zelf)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MOCK_PAYPAL_CLIENT_ID, MOCK_PAYPAL_CLIENT_SECRET, MOCK_PAYPAL_PAYER, MOCK_PAYPAL_QR, PAYPAL_MOCK_PORT } from "./payments";

const port = PAYPAL_MOCK_PORT;
const base = `http://localhost:${port}`;
const TOKEN = "e2e-token";

interface MockInvoice {
  id: string;
  status: string;
  detail: Record<string, unknown>;
  items: unknown[];
  payer: string | null;
}

const invoices = new Map<string, MockInvoice>();

function toJson(invoice: MockInvoice) {
  return {
    id: invoice.id,
    status: invoice.status,
    detail: { ...invoice.detail, metadata: { recipient_view_url: `${base}/invoice/p/${invoice.id}` } },
    items: invoice.items,
    ...(invoice.status === "PAID" && {
      payments: {
        transactions: [{ payment_id: "E2E", payment_date: "2026-10-15", method: "PAYPAL", shipping_info: { name: { full_name: invoice.payer } } }],
      },
    }),
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

const STATUSES = { PAID: "Betaald", CANCELLED: "Geannuleerd" };

function payPage(invoice: MockInvoice) {
  const buttons = Object.entries(STATUSES)
    .map(([value, label]) => `<button name="status" value="${value}">${label}</button>`)
    .join(" ");
  return `<!doctype html><meta charset="utf-8"><title>Nep-PayPal</title>
    <h1>Factuur ${invoice.id}</h1><p>${String(invoice.detail.note)}</p>
    <p>Status: ${invoice.status}</p><form method="post">${buttons}</form>`;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", base);
  const path = url.pathname;

  if (path === "/v1/oauth2/token" && req.method === "POST") {
    const basic = `Basic ${Buffer.from(`${MOCK_PAYPAL_CLIENT_ID}:${MOCK_PAYPAL_CLIENT_SECRET}`).toString("base64")}`;
    if (req.headers.authorization !== basic) return send(res, 401, { error: "invalid_client", error_description: "Client Authentication failed" });
    return send(res, 200, { access_token: TOKEN, token_type: "Bearer", expires_in: 32400 });
  }

  if (path.startsWith("/v2/invoicing/invoices")) {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { name: "AUTHENTICATION_FAILURE" });
    const [, , , , id, action] = path.split("/");
    if (req.method === "POST" && !id) {
      const input = JSON.parse(await body(req));
      const invoice: MockInvoice = {
        id: `INV2-E2E0-0000-0000-${String(invoices.size + 1).padStart(4, "0")}`,
        status: "DRAFT",
        detail: input.detail,
        items: input.items,
        payer: null,
      };
      invoices.set(invoice.id, invoice);
      return send(res, 201, toJson(invoice));
    }
    const invoice = id && invoices.get(id);
    if (!invoice) return send(res, 404, { name: "RESOURCE_NOT_FOUND", message: "Invoice not found" });
    if (req.method === "POST" && action === "send") {
      invoice.status = "UNPAID";
      return send(res, 200, { href: `${base}/invoice/p/${invoice.id}`, rel: "payer-view", method: "GET" });
    }
    if (req.method === "POST" && action === "generate-qr-code") {
      if (invoice.status === "DRAFT") return send(res, 422, { name: "UNPROCESSABLE_ENTITY", message: "Invoice is a draft" });
      return send(res, 200, MOCK_PAYPAL_QR, "text/plain");
    }
    if (req.method === "GET" && !action) return send(res, 200, toJson(invoice));
    return send(res, 404, { name: "NOT_FOUND" });
  }

  // Betaalpagina: de betaler kiest de uitkomst en blijft op PayPal (geen terugkeer naar het spel)
  if (path.startsWith("/invoice/p/")) {
    const invoice = invoices.get(path.split("/")[3] ?? "");
    if (!invoice) return send(res, 404, "Onbekende factuur", "text/plain");
    if (req.method === "POST") {
      const status = new URLSearchParams(await body(req)).get("status") ?? "";
      if (status in STATUSES && invoice.status === "UNPAID") {
        invoice.status = status;
        if (status === "PAID") invoice.payer = MOCK_PAYPAL_PAYER;
      }
    }
    return send(res, 200, payPage(invoice), "text/html; charset=utf-8");
  }

  send(res, path === "/" ? 200 : 404, "nep-PayPal", "text/plain");
}).listen(port, () => console.log(`Nep-PayPal op ${base}`));
