// Versleutelen van gevoelige gegevens (taak 11: het rekeningnummer van een betaling).
// AES-256-GCM uit node:crypto: geheim én beveiligd tegen aanpassen. Alleen op de server.
// Sleutel: PAYMENT_ENCRYPTION_KEY in .env, 32 willekeurige bytes als base64
//   maken: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // aanbevolen lengte voor GCM
const TAG_BYTES = 16;
const VERSION = "v1"; // voorvoegsel, zodat een andere methode later te herkennen is

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

// Sleutel uit de omgeving → 32 bytes, of null als hij ontbreekt of ongeldig is
export function parseEncryptionKey(value: string | undefined): Buffer | null {
  const text = value?.trim();
  if (!text || !BASE64.test(text)) return null;
  const key = Buffer.from(text, "base64");
  return key.length === KEY_BYTES ? key : null;
}

export function readEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  return parseEncryptionKey(env.PAYMENT_ENCRYPTION_KEY);
}

// Tekst → "v1:<iv>:<tag>:<versleuteld>" (base64). Elke keer een nieuwe iv, dus elke keer een andere uitkomst.
export function encrypt(plain: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) throw new Error("ongeldige sleutel");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((part) => (typeof part === "string" ? part : part.toString("base64"))).join(":");
}

// Terug naar de tekst. Gooit een fout bij een verkeerde sleutel of een aangepaste tekst.
export function decrypt(payload: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) throw new Error("ongeldige sleutel");
  const [version, iv, tag, data, ...rest] = payload.split(":");
  if (version !== VERSION || rest.length || ![iv, tag, data].every((part) => part !== undefined && BASE64.test(part))) {
    throw new Error("geen versleutelde tekst");
  }
  const ivBytes = Buffer.from(iv, "base64");
  const tagBytes = Buffer.from(tag, "base64");
  if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) throw new Error("geen versleutelde tekst");
  const decipher = createDecipheriv(ALGORITHM, key, ivBytes, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
