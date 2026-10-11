import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Staff passwords — scrypt (Node built-in, no native deps).
 * Stored as `scrypt:N:r:p:<salt b64>:<hash b64>` so parameters can be raised
 * later without breaking existing hashes.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

/** One-time passwords handed to new staff expire after this. */
export const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const PASSWORD_MIN_LENGTH = 10;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  keyLen: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyLen,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEY_LEN);
  return `scrypt:${N}:${R}:${P}:${salt.toString("base64")}:${key.toString("base64")}`;
}

/** Hash used to spend the same time when the account has no password. */
const DUMMY_HASH = `scrypt:${N}:${R}:${P}:${Buffer.alloc(16).toString("base64")}:${Buffer.alloc(KEY_LEN).toString("base64")}`;

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  const parts = (stored ?? DUMMY_HASH).split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const expected = Buffer.from(hashB64, "base64");
  const key = await derive(
    password,
    Buffer.from(saltB64, "base64"),
    Number(n),
    Number(r),
    Number(p),
    expected.length,
  );
  const ok = key.length === expected.length && timingSafeEqual(key, expected);
  return ok && stored != null;
}

/** Readable one-time password, e.g. `kT7m-Qp4r-Zx9w` (no 0/O, 1/l/I). */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const group = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(
      "",
    );
  return `${group()}-${group()}-${group()}`;
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(
  password: string,
  email?: string | null,
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 200) return "That password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use at least one letter and one number.";
  }
  const local = email?.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Don't use your email name in the password.";
  }
  return null;
}
