import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

import { db, recoveryCodes, users } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { decryptSecret, encryptSecret } from "./encryption";

const RECOVERY_CODE_COUNT = 10;
const ISSUER = "AKS Admin";

function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function generateRecoveryCode(): string {
  // 8 bytes → 16 hex chars, grouped for readability
  const raw = randomBytes(8).toString("hex");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export function rolesRequiring2fa(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Start TOTP enrolment: secret + otpauth URI + QR data URL (not yet persisted). */
export async function beginTotpEnrolment(params: {
  email: string;
}): Promise<{ secret: string; uri: string; qrDataUrl: string }> {
  const secret = generateSecret();
  const uri = generateURI({
    issuer: ISSUER,
    label: params.email,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
  return { secret, uri, qrDataUrl };
}

/**
 * Confirm enrolment with a valid TOTP code.
 * Encrypts the secret, stores it, and returns plaintext recovery codes (once).
 */
export async function confirmTotpEnrolment(params: {
  userId: string;
  secret: string;
  code: string;
}): Promise<{ recoveryCodes: string[] } | { error: string }> {
  const result = await verify({ secret: params.secret, token: params.code });
  if (!result.valid) {
    return { error: "Invalid authenticator code" };
  }

  const encrypted = encryptSecret(params.secret);
  const plainCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    generateRecoveryCode(),
  );

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        twoFactorSecret: encrypted,
        twoFactorEnabledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.userId));

    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, params.userId));

    await tx.insert(recoveryCodes).values(
      plainCodes.map((code) => ({
        id: uuidv7(),
        userId: params.userId,
        codeHash: hashRecoveryCode(code),
      })),
    );
  });

  return { recoveryCodes: plainCodes };
}

export async function verifyTotpForUser(params: {
  userId: string;
  encryptedSecret: string;
  code: string;
}): Promise<boolean> {
  const token = params.code.trim();
  if (!/^\d{6}$/.test(token)) return false;

  let secret: string;
  try {
    secret = decryptSecret(params.encryptedSecret);
  } catch {
    return false;
  }

  const result = await verify({ secret, token });
  return result.valid;
}

/** Consume a single-use recovery code. Returns true if valid and unused. */
export async function consumeRecoveryCode(params: {
  userId: string;
  code: string;
}): Promise<boolean> {
  const normalized = params.code.trim().toLowerCase();
  const codeHash = hashRecoveryCode(normalized);

  const rows = await db
    .select()
    .from(recoveryCodes)
    .where(
      and(
        eq(recoveryCodes.userId, params.userId),
        eq(recoveryCodes.codeHash, codeHash),
        isNull(recoveryCodes.usedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  // timing-safe compare on hashes (equal length hex)
  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  await db
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(eq(recoveryCodes.id, row.id));

  return true;
}
