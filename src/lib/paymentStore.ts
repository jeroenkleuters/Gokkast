// Betalingen opslaan en credits afboeken (alleen op de server). In de database (tabel payments),
// of in het geheugen voor de Playwright-tests (zie memoryStoreAllowed in payments.ts).
import type { PaymentProvider as DbPaymentProvider, PaymentStatus as DbPaymentStatus } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { memoryStoreAllowed, type PaymentStatus } from "@/lib/payments";
import type { PaymentProvider } from "@/lib/settings";
import { matchesName } from "@/lib/tables";

export interface StoredPayment {
  id: number;
  token: string;
  reference: string | null; // null bij betalingen van voor taak 10b
  provider: PaymentProvider; // waarmee betaald wordt (taak 13b)
  mollieId: string | null; // tr_..., alleen bij Mollie
  paypalId: string | null; // INV2-..., alleen bij PayPal
  checkoutUrl: string;
  status: PaymentStatus;
  amountCents: number;
  credits: number;
  creditsLeft: number;
  name: string | null;
  accountEncrypted: string | null; // rekeningnummer, versleuteld (src/lib/encryption.ts); nooit naar de browser
  createdAt: Date;
}

export type NewPayment = Pick<StoredPayment, "token" | "reference" | "provider" | "checkoutUrl" | "amountCents" | "credits"> & {
  providerId: string; // ID bij Mollie of PayPal
};

// Het ID van de betaling bij de betaalmethode
export const providerId = (payment: Pick<StoredPayment, "provider" | "mollieId" | "paypalId">) =>
  (payment.provider === "paypal" ? payment.paypalId : payment.mollieId) ?? "";

export interface StatusUpdate {
  status: PaymentStatus;
  name: string | null;
  accountEncrypted: string | null; // al versleuteld door paymentService
  paidAt: Date | null;
}

export interface PaymentStore {
  create(data: NewPayment): Promise<StoredPayment>;
  findByToken(token: string): Promise<StoredPayment | null>;
  findByProviderId(provider: PaymentProvider, id: string): Promise<StoredPayment | null>;
  findByReference(reference: string): Promise<StoredPayment | null>;
  // Nieuwe status van Mollie of PayPal. Betaald is definitief: de credits komen er precies één keer
  // bij, ook als de webhook en het spel de betaling tegelijk bijwerken.
  updateStatus(provider: PaymentProvider, id: string, update: StatusUpdate): Promise<StoredPayment | null>;
  // Eén credit afboeken als er een betaalde betaling met credits is; anders null
  spendCredit(token: string): Promise<StoredPayment | null>;
  // Voor de game-manager (taak 14): alle betalingen met een naam die `name` bevat, zonder op
  // hoofdletters te letten ("": alle betalingen, ook zonder naam)
  listByName(name: string): Promise<StoredPayment[]>;
}

const toDb = (status: PaymentStatus) => status.toUpperCase() as DbPaymentStatus;
const fromDb = (status: DbPaymentStatus) => status.toLowerCase() as PaymentStatus;
const toDbProvider = (provider: PaymentProvider) => provider.toUpperCase() as DbPaymentProvider;
const fromDbProvider = (provider: DbPaymentProvider) => provider.toLowerCase() as PaymentProvider;
// Zoeken op het ID bij de betaalmethode (elk in een eigen kolom)
const byProviderId = (provider: PaymentProvider, id: string) => (provider === "paypal" ? { paypalId: id } : { mollieId: id });

export function prismaPaymentStore(db: PrismaClient): PaymentStore {
  const select = {
    id: true,
    token: true,
    reference: true,
    provider: true,
    mollieId: true,
    paypalId: true,
    checkoutUrl: true,
    status: true,
    amountCents: true,
    credits: true,
    creditsLeft: true,
    name: true,
    accountEncrypted: true,
    createdAt: true,
  } as const;
  type Row = Omit<StoredPayment, "status" | "provider"> & { status: DbPaymentStatus; provider: DbPaymentProvider };
  const toPayment = (row: Row | null): StoredPayment | null =>
    row && { ...row, status: fromDb(row.status), provider: fromDbProvider(row.provider) };

  return {
    create: async ({ provider, providerId: id, ...data }) =>
      toPayment(await db.payment.create({ data: { ...data, provider: toDbProvider(provider), ...byProviderId(provider, id) }, select }))!,
    findByToken: async (token) => toPayment(await db.payment.findUnique({ where: { token }, select })),
    findByProviderId: async (provider, id) => toPayment(await db.payment.findFirst({ where: byProviderId(provider, id), select })),
    findByReference: async (reference) => toPayment(await db.payment.findUnique({ where: { reference }, select })),

    async updateStatus(provider, id, { status, name, accountEncrypted, paidAt }) {
      const where = byProviderId(provider, id);
      const current = await db.payment.findFirst({ where, select });
      if (!current) return null;
      // Alleen bijwerken zolang de betaling nog niet betaald is (de where maakt het atomair)
      await db.payment.updateMany({
        where: { ...where, status: { not: "PAID" } },
        data:
          status === "paid"
            ? { status: "PAID", creditsLeft: current.credits, name, accountEncrypted, paidAt }
            : { status: toDb(status), ...(name && { name }), ...(accountEncrypted && { accountEncrypted }) },
      });
      return toPayment(await db.payment.findUnique({ where: { id: current.id }, select }));
    },

    async spendCredit(token) {
      const { count } = await db.payment.updateMany({
        where: { token, status: "PAID", creditsLeft: { gt: 0 } },
        data: { creditsLeft: { decrement: 1 } },
      });
      return count ? toPayment(await db.payment.findUnique({ where: { token }, select })) : null;
    },

    async listByName(name) {
      const rows = await db.payment.findMany({
        where: name ? { name: { contains: name, mode: "insensitive" } } : {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select,
      });
      return rows.map((row) => toPayment(row)!);
    },
  };
}

export function memoryPaymentStore(now: () => Date = () => new Date()): PaymentStore {
  const payments: StoredPayment[] = [];
  const copy = (p: StoredPayment | undefined) => (p ? { ...p } : null);
  return {
    async create({ providerId: id, ...data }) {
      const payment: StoredPayment = {
        ...data,
        mollieId: data.provider === "mollie" ? id : null,
        paypalId: data.provider === "paypal" ? id : null,
        id: payments.length + 1,
        status: "open" as const,
        creditsLeft: 0,
        name: null,
        accountEncrypted: null,
        createdAt: now(),
      };
      payments.push(payment);
      return { ...payment };
    },
    findByToken: async (token) => copy(payments.find((p) => p.token === token)),
    findByProviderId: async (provider, id) => copy(payments.find((p) => p.provider === provider && providerId(p) === id)),
    findByReference: async (reference) => copy(payments.find((p) => p.reference === reference)),
    async updateStatus(provider, id, { status, name, accountEncrypted }) {
      const p = payments.find((p) => p.provider === provider && providerId(p) === id);
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
    listByName: async (name) => payments.filter((p) => matchesName(p.name, name)).reverse().map((p) => ({ ...p })),
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
