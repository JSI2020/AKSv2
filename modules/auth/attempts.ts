import { db, signInAttempts } from "@aks/db";
import { uuidv7 } from "@aks/shared";

export async function logSignInAttempt(params: {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  reason: string;
}): Promise<void> {
  await db.insert(signInAttempts).values({
    id: uuidv7(),
    email: params.email.trim().toLowerCase(),
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
    success: params.success,
    reason: params.reason,
  });
}
