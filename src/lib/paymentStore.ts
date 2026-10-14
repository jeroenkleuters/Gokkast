// Betalingen opslaan en credits afboeken (alleen op de server). In de database (tabel payments),
// of in het geheugen voor de Playwright-tests (zie memoryStoreAllowed in payments.ts).
import type { PaymentStatus as DbPaymentStatus } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { memoryStoreAllowed, type PaymentStatus } from "@/lib/payments";

export interface StoredPayment {
  id: number;
  token: string;
  reference: string | null; // null bij betalingen van voor taak 10b
  mollieId: string;
  checkoutUrl: string;
  status: PaymentStatus;
  amountCents: number;
  credits: number;
  creditsLeft: number;
  name: string | null;
  accountEncrypted: string | null; // rekeningnummer, versleuteld (src/lib/encryption.ts); nooit naar de browser
}

export type NewPayment = Pick<StoredPayment, "token" | "reference" | "mollieId" | "checkoutUrl" | "amountCents" | "credits">;

export interface StatusUpdate {
  status: PaymentStatus;
  name: string | null;
  accountEncrypted: string | null; // al versleuteld door paymentService
  paidAt: Date | null;
}

export interface PaymentStore {
  create(data: NewPayment): Promise<StoredPayment>;
  findByToken(token: string): Promise<StoredPayment | null>;
  findByMollieId(mollieId: string): Promise<StoredPayment | null>;
  findByReference(reference: string): Promise<StoredPayment | null>;
  // Nieuwe status van Mollie. Betaald is definitief: de credits komen er precies één keer bij,
  // ook als de webhook en het spel de betaling tegelijk bijwerken.
  updateStatus(mollieId: string, update: StatusUpdate): Promise<StoredPayment | null>;
  // Eén credit afboeken als er een betaalde betaling met credits is; anders null
  spendCredit(token: string): Promise<StoredPayment | null>;
}

const toDb = (status: PaymentStatus) => status.toUpperCase() as DbPaymentStatus;
const fromDb = (status: DbPaymentStatus) => status.toLowerCase() as PaymentStatus;

export function prismaPaymentStore(db: PrismaClient): PaymentStore {
  const select = {
    id: true,
    token: true,
    reference: true,
    mollieId: true,
    checkoutUrl: true,
    status: true,
    amountCents: true,
    credits: true,
    creditsLeft: true,
    name: true,
    accountEncrypted: true,
  } as const;
  type Row = Omit<StoredPayment, "status"> & { status: DbPaymentStatus };
  const toPayment = (row: Row | null): StoredPayment | null => row && { ...row, status: fromDb(row.status) };

  return {
    create: async (data) => toPayment(await db.payment.create({ data, select }))!,
    findByToken: async (token) => toPayment(await db.payment.findUnique({ where: { token }, select })),
    findByMollieId: async (mollieId) => toPayment(await db.payment.findUnique({ where: { mollieId }, select })),
    findByReference: async (reference) => toPayment(await db.payment.findUnique({ where: { reference }, select })),

    async updateStatus(mollieId, { status, name, accountEncrypted, paidAt }) {
      const current = await db.payment.findUnique({ where: { mollieId }, select });
      if (!current) return null;
      // Alleen bijwerken zolang de betaling nog niet betaald is (de where maakt het atomair)
      await db.payment.updateMany({
        where: { mollieId, status: { not: "PAID" } },
        data:
          status === "paid"
            ? { status: "PAID", creditsLeft: current.credits, name, accountEncrypted, paidAt }
            : { status: toDb(status), ...(name && { name }), ...(accountEncrypted && { accountEncrypted }) },
      });
      return toPayment(await db.payment.findUnique({ where: { mollieId }, select }));
    },

    async spendCredit(token) {
      const { count } = await db.payment.updateMany({
        where: { token, status: "PAID", creditsLeft: { gt: 0 } },
        data: { creditsLeft: { decrement: 1 } },
      });
      return count ? toPayment(await db.payment.findUnique({ where: { token }, select })) : null;
    },
  };
}

export function memoryPaymentStore(): PaymentStore {
  const payments: StoredPayment[] = [];
  const copy = (p: StoredPayment | undefined) => (p ? { ...p } : null);
  return {
    async create(data) {
      const payment = { ...data, id: payments.length + 1, status: "open" as const, creditsLeft: 0, name: null, accountEncrypted: null };
      payments.push(payment);
      return { ...payment };
    },
    findByToken: async (token) => copy(payments.find((p) => p.token === token)),
    findByMollieId: async (mollieId) => copy(payments.find((p) => p.mollieId === mollieId)),
    findByReference: async (reference) => copy(payments.find((p) => p.reference === reference)),
    async updateStatus(mollieId, { status, name, accountEncrypted }) {
      const p = payments.find((p) => p.mollieId === mollieId);
      if (!p) return null;
      if (p.status !== "paid") {
        if (status === "paid") Object.assign(p, { status, creditsLeft: p.credits, name, accountEncrypted });
        else Object.assign(p, { status, ...(name && { name }), ...(accountEncrypted && { accountEncrypted }) });
      }
      return { ...p };
    },
    async spendCredit(token) {
      const p = payments.find((p) => p.token === token && p.status === "paid" && p.creditsLeft > 0);
      if (!p) return null;
      p.creditsLeft--;
      return { ...p };
    },
  };
}

// Eén geheugenopslag per serverproces (blijft bewaard bij het herladen van modules)
const globalForStore = globalThis as unknown as { memoryPaymentStore?: PaymentStore };

// De database; zonder database alleen de geheugenopslag als die mag (tests); anders null
export function getPaymentStore(): PaymentStore | null {
  const db = getDb();
  if (db) return prismaPaymentStore(db);
  if (!memoryStoreAllowed()) return null;
  globalForStore.memoryPaymentStore ??= memoryPaymentStore();
  return globalForStore.memoryPaymentStore;
}
