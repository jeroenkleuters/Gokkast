import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { prismaPaymentStore } from "@/lib/paymentStore";

// Prisma zonder database: controleren welke voorwaarden de opslag meegeeft,
// want daar zit de bescherming tegen dubbel credits geven en dubbel afboeken.
const row = {
  id: 1,
  token: "t".repeat(32),
  reference: "r".repeat(16),
  mollieId: "tr_test1",
  checkoutUrl: "https://mollie.test/checkout/tr_test1",
  status: "OPEN",
  amountCents: 100,
  credits: 4,
  creditsLeft: 0,
  name: null,
  accountEncrypted: null,
};

function fakeDb(found: Record<string, unknown> | null = row, count = 1) {
  const payment = {
    findUnique: vi.fn(async () => found),
    updateMany: vi.fn(async () => ({ count })),
    create: vi.fn(async () => row),
  };
  return { db: { payment } as unknown as PrismaClient, payment };
}

describe("prismaPaymentStore", () => {
  it("zet een betaling op betaald met alle credits, alleen als die nog niet betaald was", async () => {
    const { db, payment } = fakeDb();
    const paidAt = new Date("2026-10-14T10:00:00Z");
    await prismaPaymentStore(db).updateStatus("tr_test1", { status: "paid", name: "T. TEST", accountEncrypted: "v1:a:b:c", paidAt });
    expect(payment.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { mollieId: "tr_test1", status: { not: "PAID" } },
      data: { status: "PAID", creditsLeft: 4, name: "T. TEST", accountEncrypted: "v1:a:b:c", paidAt },
    });
  });

  it("bewaart een andere status zonder credits", async () => {
    const { db, payment } = fakeDb();
    await prismaPaymentStore(db).updateStatus("tr_test1", { status: "expired", name: null, accountEncrypted: null, paidAt: null });
    expect(payment.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { mollieId: "tr_test1", status: { not: "PAID" } },
      data: { status: "EXPIRED" },
    });
  });

  it("werkt een onbekende betaling niet bij", async () => {
    const { db, payment } = fakeDb(null);
    expect(await prismaPaymentStore(db).updateStatus("tr_x", { status: "paid", name: null, accountEncrypted: null, paidAt: null })).toBeNull();
    expect(payment.updateMany).not.toHaveBeenCalled();
  });

  it("boekt een credit af alleen bij een betaalde betaling met credits over", async () => {
    const { db, payment } = fakeDb({ ...row, status: "PAID", creditsLeft: 3 });
    expect(await prismaPaymentStore(db).spendCredit(row.token)).toMatchObject({ status: "paid", creditsLeft: 3 });
    expect(payment.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { token: row.token, status: "PAID", creditsLeft: { gt: 0 } },
      data: { creditsLeft: { decrement: 1 } },
    });
  });

  it("geeft null als er geen credit af te boeken was", async () => {
    const { db } = fakeDb(row, 0);
    expect(await prismaPaymentStore(db).spendCredit(row.token)).toBeNull();
  });

  it("zet de status van de database om naar die van Mollie", async () => {
    const { db } = fakeDb();
    expect((await prismaPaymentStore(db).findByToken(row.token))!.status).toBe("open");
  });
});
