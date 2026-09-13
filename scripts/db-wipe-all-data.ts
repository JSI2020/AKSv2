import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Staff roles kept when wiping — everything else (CUSTOMER) is removed. */
const STAFF_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "STAFF",
  "TAILOR",
  "ACCOUNTANT",
  "READ_ONLY",
] as const;

/** Drop integration-test staff; keep real owner from OWNER_EMAIL. */
async function pruneTestStaff(
  sql: Awaited<typeof import("@aks/db")>["sql"],
) {
  const keepEmail =
    process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "owner@aks.local";

  const removed = await sql<{ email: string; role: string }[]>`
    with gone as (
      delete from users
      where role = any(${STAFF_ROLES})
        and lower(email) <> ${keepEmail}
        and (
          email like '%@example.com'
          or email like '%-test-%@example.com'
          or email like 'staff-%@example.com'
          or email like 'accountant-%@example.com'
          or email like 'inventory-test-%'
          or email like 'production-test-%'
          or email like 'manual-order-%'
        )
      returning email, role::text as role
    )
    select email, role from gone`;

  if (removed.length > 0) {
    console.log("\nRemoved test staff accounts:");
    for (const u of removed) {
      console.log(`  ${u.role.padEnd(12)} ${u.email}`);
    }
  }
}

/** Auth/RBAC tables never truncated — admin can still sign in. */
const KEEP_TABLES = new Set([
  "users",
  "permissions",
  "role_permissions",
  "user_permissions",
]);

/**
 * Wipe all catalogue, commerce, inventory, content, and customer data.
 * Keeps staff users + permission catalogue so /admin still works.
 *
 * Usage:
 *   npm run db:wipe -- --confirm
 *   npm run db:wipe -- --confirm --bootstrap   # also restore empty category/size reference data
 *
 * Then sign in:
 *   npm run dev:admin-code
 */
async function main() {
  const confirm = process.argv.includes("--confirm");
  const force = process.argv.includes("--force");
  const bootstrap = process.argv.includes("--bootstrap");

  if (!confirm) {
    console.error(
      "Refusing to run without --confirm.\n\n  npm run db:wipe -- --confirm\n",
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && !force) {
    console.error(
      "Refusing to wipe production without --force (and --confirm).",
    );
    process.exit(1);
  }

  const { sql } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");

  const before = await sql<
    {
      designs: number;
      fabrics: number;
      orders: number;
      discounts: number;
      rtw_stock: number;
      customers: number;
      staff_users: number;
    }[]
  >`
    select
      (select count(*)::int from designs) as designs,
      (select count(*)::int from fabrics) as fabrics,
      (select count(*)::int from orders) as orders,
      (select count(*)::int from discounts) as discounts,
      (select count(*)::int from rtw_stock) as rtw_stock,
      (select count(*)::int from users where role = 'CUSTOMER') as customers,
      (select count(*)::int from users where role <> 'CUSTOMER') as staff_users`;

  console.log("\n=== Before wipe ===");
  console.log(before[0]);

  const staffBefore = await sql<{ email: string; role: string }[]>`
    select email, role::text as role
    from users
    where role = any(${STAFF_ROLES})
    order by role, email`;

  console.log("\nKeeping staff accounts:");
  for (const u of staffBefore) {
    console.log(`  ${u.role.padEnd(12)} ${u.email}`);
  }

  console.log("\n=== Wiping all business data ===");

  const deletedCustomers = await sql<{ count: string }[]>`
    with removed as (
      delete from users where role = 'CUSTOMER' returning id
    )
    select count(*)::text as count from removed`;
  console.log(`removed CUSTOMER users: ${deletedCustomers[0]?.count ?? 0}`);

  const tables = await sql<{ tablename: string }[]>`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename`;

  const toTruncate = tables
    .map((t) => t.tablename)
    .filter((name) => !KEEP_TABLES.has(name));

  if (toTruncate.length > 0) {
    const quoted = toTruncate.map((name) => `"${name.replace(/"/g, '""')}"`);
    await sql.unsafe(
      `truncate table ${quoted.join(", ")} restart identity cascade`,
    );
    console.log(`truncated ${toTruncate.length} table(s)`);
  }

  const owners = await sql<{ id: string; email: string }[]>`
    select id, email from users where role = 'OWNER' order by created_at`;

  if (owners.length === 0) {
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const ownerName = process.env.OWNER_NAME?.trim() || "Demo Owner";

    if (!ownerEmail) {
      console.error(
        "\nNo OWNER user left. Set OWNER_EMAIL (+ OWNER_NAME) in .env.local and re-run, or:\n  npm run db:seed\n",
      );
      await sql.end({ timeout: 5 });
      process.exit(1);
    }

    const id = uuidv7();
    await sql`
      insert into users (id, email, name, role, status, email_verified_at, created_at, updated_at)
      values (${id}, ${ownerEmail}, ${ownerName}, 'OWNER', 'ACTIVE', now(), now(), now())`;
    console.log(`created OWNER ${ownerEmail}`);
  }

  const { execSync } = await import("node:child_process");
  execSync("npx tsx scripts/sync-permissions.ts", {
    stdio: "inherit",
    env: process.env,
  });

  if (bootstrap) {
    execSync("npx tsx scripts/seed-bootstrap-data.ts", {
      stdio: "inherit",
      env: process.env,
    });
  }

  await pruneTestStaff(sql);

  const after = await sql<
    {
      designs: number;
      fabrics: number;
      orders: number;
      discounts: number;
      rtw_stock: number;
      customers: number;
      staff_users: number;
      permissions: number;
    }[]
  >`
    select
      (select count(*)::int from designs) as designs,
      (select count(*)::int from fabrics) as fabrics,
      (select count(*)::int from orders) as orders,
      (select count(*)::int from discounts) as discounts,
      (select count(*)::int from rtw_stock) as rtw_stock,
      (select count(*)::int from users where role = 'CUSTOMER') as customers,
      (select count(*)::int from users where role <> 'CUSTOMER') as staff_users,
      (select count(*)::int from permissions) as permissions`;

  console.log("\n=== After wipe ===");
  console.log(after[0]);

  const staffAfter = await sql<{ email: string; role: string }[]>`
    select email, role::text as role
    from users
    where role = any(${STAFF_ROLES})
    order by role, email`;

  console.log("\nAdmin sign-in (dev OTP):");
  console.log("  npm run dev:admin-code");
  console.log("  http://localhost:3000/admin/login\n");
  console.log("Staff kept:");
  for (const u of staffAfter) {
    console.log(`  ${u.role.padEnd(12)} ${u.email}`);
  }

  if (!bootstrap) {
    console.log(
      "\nOptional — empty reference data for Design Studio (categories + size blocks, no fabrics/designs):",
    );
    console.log("  npm run db:wipe -- --confirm --bootstrap");
    console.log("  # or: npm run db:seed:bootstrap\n");
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
