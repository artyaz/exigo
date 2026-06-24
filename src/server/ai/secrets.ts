import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/* Custom-endpoint API keys are stored encrypted. Convex only ever holds
   opaque ciphertext; the symmetric key lives solely in AI_SETTINGS_SECRET
   in the Next.js server env, so a Convex data leak never exposes a key.
   AES-256-GCM gives us authenticated encryption (tamper-evident). */

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const secret = process.env.AI_SETTINGS_SECRET;
  if (!secret) throw new Error("AI_SETTINGS_SECRET is not set — cannot encrypt/decrypt custom API keys.");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AI_SETTINGS_SECRET must be at least 32 bytes; generate it with crypto.randomBytes(32).");
  }
  // Derive a stable 32-byte key from the (sufficiently strong) secret.
  return createHash("sha256").update(secret).digest();
}

export interface Encrypted {
  cipher: string; // base64 ciphertext + auth tag
  iv: string; // base64 nonce
}

export function encryptSecret(plain: string): Encrypted {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return { cipher: Buffer.concat([enc, tag]).toString("base64"), iv: iv.toString("base64") };
}

export function decryptSecret(enc: Encrypted): string {
  const raw = Buffer.from(enc.cipher, "base64");
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(0, raw.length - 16);
  const d = createDecipheriv(ALGO, key(), Buffer.from(enc.iv, "base64"));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
