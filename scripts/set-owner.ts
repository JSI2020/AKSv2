import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Make an email the shop Owner (full access) and print a one-time password.
 *
 *   npm run owner:set -- you@example.com ["Your Name"] [--disable-other-owners]
 *
 * - Creates the account, or promotes an existing staff account to OWNER.
 * - The printed one-time password works once, for 7 days; first sign-in at
 *   /admin/login asks for a new password (and authenticator setup on the live
 *   site). "Forgot password" on the login page also works for the Owner.
 * - --disable-other-owners disables any other OWNER accounts (e.g. a
 *   placeholder created at first setup).
 */
async function main() {
  const args = process.argv.slice(2);
  const disableOthers = args.includes("--disable-other-owners");
  const [emailArg, nameArg] = args.filter((a) => !a.startsWith("--"));
  const email = emailArg?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(
      'Usage: npm run owner:set -- you@example.com ["Your Name"] [--disable-other-owners]',
    );
    process.exit(1);
  }

  const { uuidv7 } = await import("../packages/shared");
  const { db } = await import("../packages/db/client");
  const { users } = await import("../packages/db/schema");
  const { and, eq, ne } = await import("drizzle-orm");
  const { generateTempPassword, hashPassword, TEMP_PASSWORD_TTL_MS } =
    await import("../modules/auth/password");

  const tempPassword = generateTempPassword();
  const passwordFields = {
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
    tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
  };
  const now = new Date();

  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (existing.role === "CUSTOMER") {
      console.warn(
        `Note: ${email} was a shop customer account. It becomes the Owner; use a different email to shop as a customer.`,
      );
    }
    await db
      .update(users)
      .set({
        role: "OWNER",
        status: "ACTIVE",
        deletedAt: null,
        ...(nameArg ? { name: nameArg } : {}),
        ...passwordFields,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id));
    console.log(`${email} is now OWNER (was ${existing.role}).`);
  } else {
    await db.insert(users).values({
      id: uuidv7(),
      email,
      name: nameArg ?? "Owner",
      role: "OWNER",
      status: "ACTIVE",
      emailVerified: now,
      ...passwordFields,
    });
    console.log(`Created OWNER ${email}.`);
  }

  const others = await db
    .select({ id: users.id, email: users.email, status: users.status })
    .from(users)
    .where(and(eq(users.role, "OWNER"), ne(users.email, email)));

  if (others.length > 0) {
    if (disableOthers) {
      for (const o of others) {
        await db
          .update(users)
          .set({ status: "DISABLED", updatedAt: now })
          .where(eq(users.id, o.id));
      }
      console.log(
        `Disabled other OWNER accounts: ${others.map((o) => o.email).join(", ")}`,
      );
    } else {
      console.log(
        `Other OWNER accounts still active: ${others.map((o) => `${o.email} (${o.status})`).join(", ")}\n` +
          "Re-run with --disable-other-owners to switch them off.",
      );
    }
  }

  console.log(
    `\nOne-time password for ${email}:  ${tempPassword}\n` +
      "Works once, expires in 7 days. Sign in at /admin/login — you'll choose your own password next.\n",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
