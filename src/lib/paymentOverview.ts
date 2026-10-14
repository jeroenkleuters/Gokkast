// Betalingen voor de game-manager (taak 14): naam, rekeningnummer (ontsleuteld), bedrag, status
// en gespeelde spelletjes. Alleen op de server, en alleen na checkAdmin (src/app/game-manager/page.tsx).
// Het rekeningnummer kan pas na het ontsleutelen gesorteerd worden; daarom gebeurt sorteren en
// bladeren hier in het geheugen (het gaat om de betalingen van één spel, niet om duizenden).
import { DB_TIMEOUT_MS, withTimeout } from "@/lib/db";
import { decrypt, readEncryptionKey } from "@/lib/encryption";
import type { PaymentColumn, PaymentsQuery } from "@/lib/managerQuery";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/lib/payments";
import { getPaymentStore, type PaymentStore, type StoredPayment } from "@/lib/paymentStore";
import { clampPage, pageCount, pageSlice, sortRows, type SortValue } from "@/lib/tables";

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  open: "Open",
  pending: "Wordt verwerkt",
  authorized: "Geautoriseerd",
  paid: "Betaald",
  canceled: "Geannuleerd",
  expired: "Verlopen",
  failed: "Mislukt",
};

// Rekeningnummer zoals de game-manager het toont
export type Account =
  | { kind: "ok"; iban: string }
  | { kind: "none" } // niet bekend (nog niet betaald, of betaald voor taak 11)
  | { kind: "no-key" } // PAYMENT_ENCRYPTION_KEY ontbreekt of is ongeldig
  | { kind: "error" }; // niet te ontsleutelen (bijv. een andere sleutel)

// Eén regel in het overzicht: alleen wat getoond wordt (geen token of betaallink)
export interface PaymentRow {
  id: number;
  createdAt: Date;
  name: string | null;
  account: Account;
  amountCents: number;
  status: PaymentStatus;
  credits: number; // spelletjes voor de betaling
  played: number; // daarvan gespeeld (afgeboekte credits)
}

// "NL53INGB0654422370" → "NL53 INGB 0654 4223 70"
export const formatIban = (iban: string) => iban.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");

export function decryptAccount(encrypted: string | null, key: Buffer | null): Account {
  if (!encrypted) return { kind: "none" };
  if (!key) return { kind: "no-key" };
  try {
    return { kind: "ok", iban: decrypt(encrypted, key) };
  } catch {
    return { kind: "error" };
  }
}

export function toPaymentRow(payment: StoredPayment, key: Buffer | null): PaymentRow {
  return {
    id: payment.id,
    createdAt: payment.createdAt,
    name: payment.name,
    account: decryptAccount(payment.accountEncrypted, key),
    amountCents: payment.amountCents,
    status: payment.status,
    credits: payment.credits,
    played: payment.status === "paid" ? payment.credits - payment.creditsLeft : 0,
  };
}

// Waarde van een kolom; een onbekend rekeningnummer staat altijd onderaan
function paymentValue(row: PaymentRow, column: PaymentColumn): SortValue {
  if (column === "datum") return row.createdAt;
  if (column === "naam") return row.name;
  if (column === "rekeningnummer") return row.account.kind === "ok" ? row.account.iban : null;
  if (column === "bedrag") return row.amountCents;
  if (column === "status") return PAYMENT_STATUSES.indexOf(row.status);
  return row.played;
}

// Gesorteerd op de kolom; bij gelijke waarden de nieuwste eerst
export const sortPayments = (rows: PaymentRow[], sort: PaymentsQuery["sort"]) =>
  sortRows(rows, sort, paymentValue, (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);

export type PaymentOverview =
  | {
      status: "ok";
      query: PaymentsQuery; // met de pagina die echt getoond wordt
      total: number; // aantal betalingen (met de naam)
      pageCount: number;
      rows: PaymentRow[]; // deze pagina
      keyMissing: boolean; // er zijn versleutelde rekeningnummers, maar geen (geldige) sleutel
    }
  | { status: "no-database" }
  | { status: "error" };

export async function readPaymentOverview(
  query: PaymentsQuery,
  store: PaymentStore | null = getPaymentStore(),
  key: Buffer | null = readEncryptionKey(),
  timeoutMs = DB_TIMEOUT_MS,
): Promise<PaymentOverview> {
  if (!store) return { status: "no-database" };
  try {
    const payments = await withTimeout(store.listByName(query.name), timeoutMs);
    const rows = sortPayments(
      payments.map((payment) => toPaymentRow(payment, key)),
      query.sort,
    );
    const failed = rows.filter((row) => row.account.kind === "error").length;
    // Zonder de rekeningnummers of de versleutelde tekst in de log
    if (failed) console.warn(`${failed} rekeningnummer(s) niet te ontsleutelen: klopt PAYMENT_ENCRYPTION_KEY?`);
    const page = clampPage(query.page, rows.length);
    return {
      status: "ok",
      query: { ...query, page },
      total: rows.length,
      pageCount: pageCount(rows.length),
      rows: pageSlice(rows, page),
      keyMissing: rows.some((row) => row.account.kind === "no-key"),
    };
  } catch (error) {
    console.warn("Betalingen niet uit de database gelezen:", error);
    return { status: "error" };
  }
}
