import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY must be 32 bytes encoded as base64",
    );
  }
  return key;
}

/** Encrypt plaintext with AES-256-GCM. Returns `iv:tag:ciphertext` (base64). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypt a value produced by {@link encryptSecret}. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
