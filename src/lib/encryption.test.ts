import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, parseEncryptionKey, readEncryptionKey } from "@/lib/encryption";

const KEY = randomBytes(32);
const ACCOUNT = "NL53INGB0654422370";

describe("encrypt en decrypt", () => {
  it("geeft na versleutelen en ontsleutelen dezelfde tekst terug", () => {
    for (const text of [ACCOUNT, "", "ä € 🎰", "x".repeat(1000)]) {
      expect(decrypt(encrypt(text, KEY), KEY)).toBe(text);
    }
  });

  it("de versleutelde tekst bevat het rekeningnummer niet", () => {
    const payload = encrypt(ACCOUNT, KEY);
    expect(payload).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(payload).not.toContain(ACCOUNT);
    expect(Buffer.from(payload.split(":")[3], "base64").toString("utf8")).not.toContain("INGB");
  });

  it("geeft elke keer een andere uitkomst voor dezelfde tekst", () => {
    const payloads = new Set(Array.from({ length: 20 }, () => encrypt(ACCOUNT, KEY)));
    expect(payloads.size).toBe(20);
  });

  it("lukt niet met een andere sleutel", () => {
    expect(() => decrypt(encrypt(ACCOUNT, KEY), randomBytes(32))).toThrow();
  });

  it("merkt een aangepaste versleutelde tekst op", () => {
    const [version, iv, tag, data] = encrypt(ACCOUNT, KEY).split(":");
    const flip = (part: string) => {
      const bytes = Buffer.from(part, "base64");
      bytes[0] ^= 1;
      return bytes.toString("base64");
    };
    for (const changed of [
      [version, flip(iv), tag, data],
      [version, iv, flip(tag), data],
      [version, iv, tag, flip(data)],
    ]) {
      expect(() => decrypt(changed.join(":"), KEY)).toThrow();
    }
  });

  it("weigert tekst die niet versleuteld is", () => {
    const [, iv, tag, data] = encrypt(ACCOUNT, KEY).split(":");
    for (const payload of [ACCOUNT, "", "v1:", `v2:${iv}:${tag}:${data}`, `v1:${iv}:${tag}`, `v1:${iv}:${tag}:${data}:x`, `v1:!!:${tag}:${data}`]) {
      expect(() => decrypt(payload, KEY), payload).toThrow();
    }
  });

  it("weigert een sleutel van de verkeerde lengte", () => {
    expect(() => encrypt(ACCOUNT, randomBytes(16))).toThrow("ongeldige sleutel");
    expect(() => decrypt(encrypt(ACCOUNT, KEY), randomBytes(16))).toThrow("ongeldige sleutel");
  });
});

describe("parseEncryptionKey", () => {
  it("leest 32 bytes in base64", () => {
    const text = KEY.toString("base64");
    expect(parseEncryptionKey(text)?.equals(KEY)).toBe(true);
    expect(parseEncryptionKey(` ${text}\n`)?.equals(KEY)).toBe(true);
  });

  it("geen of een ongeldige sleutel: null", () => {
    for (const value of [undefined, "", "   ", "geheim", randomBytes(16).toString("base64"), randomBytes(33).toString("base64"), "é".repeat(44)]) {
      expect(parseEncryptionKey(value), String(value)).toBeNull();
    }
  });

  it("readEncryptionKey gebruikt PAYMENT_ENCRYPTION_KEY", () => {
    expect(readEncryptionKey({ PAYMENT_ENCRYPTION_KEY: KEY.toString("base64") } as unknown as NodeJS.ProcessEnv)?.equals(KEY)).toBe(true);
    expect(readEncryptionKey({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
