import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import type { StaffRole } from "@aks/shared";

/** Dev/staging staff roster — one per invitable role (OWNER created via db:seed). */
const EMPLOYEES: readonly {
  email: string;
  name: string;
  role: StaffRole;
}[] = [
  { email: "admin@aks.local", name: "Demo Admin", role: "ADMIN" },
  { email: "manager@aks.local", name: "Demo Manager", role: "MANAGER" },
  { email: "staff@aks.local", name: "Demo Staff", role: "STAFF" },
  { email: "tailor@aks.local", name: "Demo Tailor", role: "TAILOR" },
  { email: "accountant@aks.local", name: "Demo Accountant", role: "ACCOUNTANT" },
] as const;

const DEFAULT_OWNER_NAME = "Demo Owner";

/**
 * Idempotent — creates ACTIVE staff accounts ready for OTP sign-in.
 * Run: npm run db:seed:staff
 */
async function main() {
  const { uuidv7 } = await import("@aks/shared");
  const { db, users, sql } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");

  let created = 0;
  let updated = 0;

  const ownerName = DEFAULT_OWNER_NAME;
  const ownerEmail =
    process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "owner@aks.local";

  const [owner] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, ownerEmail))
    .limit(1);

  if (owner) {
    if ((owner.name ?? "") !== ownerName) {
      await db
        .update(users)
        .set({ name: ownerName, updatedAt: new Date() })
        .where(eq(users.id, owner.id));
      console.log(`updated ${ownerEmail} name → ${ownerName}`);
      updated += 1;
    }
  }

  for (const emp of EMPLOYEES) {
    const email = emp.email.trim().toLowerCase();
    const [existing] = await db
      .select({ id: users.id, role: users.role, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      const patch: {
        role: StaffRole;
        name: string;
        status: "ACTIVE";
        updatedAt: Date;
      } = {
        role: emp.role,
        name: emp.name,
        status: "ACTIVE",
        updatedAt: new Date(),
      };
      if (existing.role !== emp.role || (existing.name ?? "") !== emp.name) {
        await db.update(users).set(patch).where(eq(users.id, existing.id));
        console.log(`updated ${email} → ${emp.role} (${emp.name})`);
        updated += 1;
      } else {
        console.log(`ok      ${email} (${emp.role})`);
      }
      continue;
    }

    await db.insert(users).values({
      id: uuidv7(),
      email,
      name: emp.name,
      role: emp.role,
      status: "ACTIVE",
      emailVerified: new Date(),
    });
    console.log(`created ${email} (${emp.role}) — ${emp.name}`);
    created += 1;
  }

  console.log(
    `\nDone: ${created} created, ${updated} updated (${EMPLOYEES.length} staff + owner).`,
  );
  console.log("\nSign in at /admin/login — Send code per email (dev auto-fills OTP).");
  console.log("OWNER dev shortcut: npm run dev:admin-code\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
