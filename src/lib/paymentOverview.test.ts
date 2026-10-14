import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { encrypt } from "@/lib/encryption";
import { parseManagerQuery, type PaymentColumn, type PaymentsQuery } from "@/lib/managerQuery";
import { decryptAccount, formatIban, readPaymentOverview } from "@/lib/paymentOverview";
import type { PaymentStatus } from "@/lib/payments";
import { memoryPaymentStore, prismaPaymentStore, type PaymentStore } from "@/lib/paymentStore";
import { ROWS_PER_PAGE, type SortDir } from "@/lib/tables";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 8);

const query = (change: Partial<PaymentsQuery> = {}): PaymentsQuery => ({ ...parseManagerQuery({}).payments, ...change });

// Betalingen in de geheugenopslag; elke betaling een minuut na de vorige
interface Seed {
  name: string | null;
  account?: string;
  key?: Buffer;
  status?: PaymentStatus;
  amountCents?: number;
  spent?: number; // afgeboekte credits
}

async function storeWith(seeds: Seed[]) {
  let minute = 0;
  const store = memoryPaymentStore(() => new Date(Date.UTC(2026, 9, 14, 10, minute++)));
  for (const [i, seed] of seeds.entries()) {
    const token = `token-${i}`.padEnd(32, "x");
    await store.create({
      token,
      reference: null,
      mollieId: `tr_${i}`,
      checkoutUrl: `https://mollie.test/${i}`,
      amountCents: seed.amountCents ?? 100,
      credits: 4,
    });
    await store.updateStatus(`tr_${i}`, {
      status: seed.status ?? "paid",
      name: seed.name,
      accountEncrypted: seed.account ? encrypt(seed.account, seed.key ?? KEY) : null,
      paidAt: null,
    });
    for (let s = 0; s < (seed.spent ?? 0); s++) await store.spendCredit(token);
  }
  return store;
}

async function read(q: PaymentsQuery, store: PaymentStore, key: Buffer | null = KEY) {
  const overview = await readPaymentOverview(q, store, key);
  if (overview.status !== "ok") throw new Error(overview.status);
  return overview;
}

describe("formatIban", () => {
  it("zet spaties na elke vier tekens", () => {
    expect(formatIban("NL53INGB0654422370")).toBe("NL53 INGB 0654 4223 70");
    expect(formatIban("NL53 INGB 0654422370")).toBe("NL53 INGB 0654 4223 70");
  });
});

describe("decryptAccount", () => {
  it("ontsleutelt met de juiste sleutel", () => {
    expect(decryptAccount(encrypt("NL53INGB0654422370", KEY), KEY)).toEqual({ kind: "ok", iban: "NL53INGB0654422370" });
  });

  it("zonder rekeningnummer, zonder sleutel of met een andere sleutel: geen nummer", () => {
    expect(decryptAccount(null, KEY)).toEqual({ kind: "none" });
    expect(decryptAccount(encrypt("NL53INGB0654422370", KEY), null)).toEqual({ kind: "no-key" });
    expect(decryptAccount(encrypt("NL53INGB0654422370", KEY), OTHER_KEY)).toEqual({ kind: "error" });
    expect(decryptAccount("kapot", KEY)).toEqual({ kind: "error" });
  });
});

describe("readPaymentOverview", () => {
  afterEach(() => vi.restoreAllMocks());

  it("zonder database: no-database", async () => {
    expect(await readPaymentOverview(query(), null, KEY)).toEqual({ status: "no-database" });
  });

  it("toont naam, ontsleuteld rekeningnummer, bedrag, status en gespeelde spelletjes; nieuwste eerst", async () => {
    const store = await storeWith([
      { name: "T. TEST", account: "NL53INGB0654422370", spent: 3 },
      { name: null, status: "expired" },
    ]);
    const overview = await read(query(), store);
    expect(overview.total).toBe(2);
    expect(overview.keyMissing).toBe(false);
    expect(overview.rows).toEqual([
      {
        id: 2,
        createdAt: new Date("2026-10-14T10:01:00Z"),
        name: null,
        account: { kind: "none" },
        amountCents: 100,
        status: "expired",
        credits: 4,
        played: 0,
      },
      {
        id: 1,
        createdAt: new Date("2026-10-14T10:00:00Z"),
        name: "T. TEST",
        account: { kind: "ok", iban: "NL53INGB0654422370" },
        amountCents: 100,
        status: "paid",
        credits: 4,
        played: 3,
      },
    ]);
    // Geen token, betaallink of versleutelde tekst in het overzicht
    expect(JSON.stringify(overview)).not.toMatch(/token-|mollie\.test|v1:/);
  });

  it("filtert op een deel van de naam, zonder op hoofdletters te letten", async () => {
    const store = await storeWith([{ name: "A. Jansen" }, { name: "P. JANSSEN" }, { name: "Bob" }, { name: null }]);
    const overview = await read(query({ name: "jans" }), store);
    expect(overview.rows.map((r) => r.name)).toEqual(["P. JANSSEN", "A. Jansen"]);
    expect((await read(query({ name: "xyz" }), store)).total).toBe(0);
  });

  it("sorteert op elke kolom, ook op het ontsleutelde rekeningnummer", async () => {
    const store = await storeWith([
      { name: "Cees", account: "NL02ABNA0123456789", amountCents: 200, spent: 1 },
      { name: "anna", account: "NL91ABNA0417164300", status: "pending" },
      { name: null, status: "open", amountCents: 50 },
      { name: "Bob", account: "BE68539007547034", spent: 4 },
    ]);
    const names = async (column: PaymentColumn, dir: SortDir) =>
      (await read(query({ sort: { column, dir } }), store)).rows.map((r) => r.name);

    expect(await names("datum", "asc")).toEqual(["Cees", "anna", null, "Bob"]);
    expect(await names("naam", "asc")).toEqual(["anna", "Bob", "Cees", null]);
    expect(await names("naam", "desc")).toEqual(["Cees", "Bob", "anna", null]);
    expect(await names("rekeningnummer", "asc")).toEqual(["Bob", "Cees", "anna", null]);
    expect(await names("rekeningnummer", "desc")).toEqual(["anna", "Cees", "Bob", null]);
    expect(await names("bedrag", "desc")).toEqual(["Cees", "Bob", "anna", null]);
    // status in de volgorde van Mollie: open, pending, ..., paid; bij gelijke waarden nieuwste eerst
    expect(await names("status", "asc")).toEqual([null, "anna", "Bob", "Cees"]);
    expect(await names("spelletjes", "desc")).toEqual(["Bob", "Cees", null, "anna"]);
  });

  it("verdeelt over pagina's van 15; een pagina voorbij het einde wordt de laatste", async () => {
    const store = await storeWith(Array.from({ length: ROWS_PER_PAGE + 2 }, (_, i) => ({ name: `Speler ${i}` })));
    const page1 = await read(query(), store);
    expect(page1.pageCount).toBe(2);
    expect(page1.rows).toHaveLength(ROWS_PER_PAGE);

    const tooFar = await read(query({ page: 5 }), store);
    expect(tooFar.query.page).toBe(2);
    expect(tooFar.rows.map((r) => r.name)).toEqual(["Speler 1", "Speler 0"]);
  });

  it("zonder sleutel: geen rekeningnummers en keyMissing; met een andere sleutel één waarschuwing zonder nummer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = await storeWith([
      { name: "A", account: "NL53INGB0654422370" },
      { name: "B", account: "NL91ABNA0417164300", key: OTHER_KEY },
      { name: "C", account: "NL02ABNA0123456789", key: OTHER_KEY },
    ]);

    const noKey = await read(query(), store, null);
    expect(noKey.keyMissing).toBe(true);
    expect(noKey.rows.map((r) => r.account.kind)).toEqual(["no-key", "no-key", "no-key"]);

    const wrongKey = await read(query(), store);
    expect(wrongKey.keyMissing).toBe(false);
    expect(wrongKey.rows.map((r) => r.account.kind)).toEqual(["error", "error", "ok"]);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0])).not.toMatch(/NL\d\d|v1:/);
  });

  it("een databasefout of time-out geeft error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing: PaymentStore = { ...memoryPaymentStore(), listByName: () => Promise.reject(new Error("kapot")) };
    expect(await readPaymentOverview(query(), failing, KEY)).toEqual({ status: "error" });
    const slow: PaymentStore = { ...memoryPaymentStore(), listByName: () => new Promise(() => {}) };
    expect(await readPaymentOverview(query(), slow, KEY, 10)).toEqual({ status: "error" });
  });
});

describe("prismaPaymentStore.listByName", () => {
  it("filtert in de database op een deel van de naam, zonder op hoofdletters te letten", async () => {
    const findMany = vi.fn(async () => [{ id: 1, status: "PAID" }]);
    const store = prismaPaymentStore({ payment: { findMany } } as unknown as PrismaClient);

    expect(await store.listByName("jan")).toEqual([{ id: 1, status: "paid" }]);
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { name: { contains: "jan", mode: "insensitive" } } }),
    );
    await store.listByName("");
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {} }));
  });
});
