"use server";

import { eq } from "drizzle-orm";

import { db, users } from "@aks/db";
import { auth, unstable_update } from "@/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/modules/auth";

/** First sign-in (or any time): replace the password with one the user chose. */
export async function setOwnPasswordAction(input: {
  password: string;
  confirm: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "CUSTOMER") {
    return { error: "Not signed in" };
  }

  const password = input.password ?? "";
  if (password !== (input.confirm ?? "")) {
    return { error: "The two passwords don't match." };
  }
  const problem = passwordProblem(password, session.user.email);
  if (problem) return { error: problem };

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user) return { error: "Account not found" };

  if (await verifyPassword(password, user.passwordHash)) {
    return { error: "Choose a new password, not the one-time one." };
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
      passwordSetAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, session.user.id));

  // Re-reads the flags from the DB (jwt callback, trigger "update").
  await unstable_update({ user: { mustChangePassword: false } });

  return { ok: true };
}
