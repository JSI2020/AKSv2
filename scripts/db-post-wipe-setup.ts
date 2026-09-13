import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** One-shot post-wipe tidy: drop test staff, seed reference data, print admin OTP hint. */
async function main() {
  const { sql } = await import("@aks/db");
  const keepEmail =
    process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "owner@aks.local";

  const staffRoles = [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "STAFF",
    "TAILOR",
    "ACCOUNTANT",
    "READ_ONLY",
  ];

  const removed = await sql<{ email: string; role: string }[]>`
    with gone as (
      delete from users
      where role = any(${staffRoles})
        and lower(email) <> ${keepEmail}
        and (
          email like '%@example.com'
          or email like 'inventory-test-%'
          or email like 'production-test-%'
          or email like 'manual-order-%'
        )
      returning email, role::text as role
    )
    select email, role from gone`;

  if (removed.length) {
    console.log("Removed test staff:");
    for (const u of removed) console.log(`  ${u.email}`);
  } else {
    console.log("No test staff to remove.");
  }

  await sql.end({ timeout: 5 });

  const { execSync } = await import("node:child_process");
  execSync("npx tsx scripts/seed-bootstrap-data.ts", {
    stdio: "inherit",
    env: process.env,
  });

  execSync("npx tsx scripts/dev-admin-code.ts", {
    stdio: "inherit",
    env: process.env,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
