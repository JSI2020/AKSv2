import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Step 4 — homepage, nav, hero, category doors. */
async function main() {
  const { seedContentDefaults } = await import("@/modules/content/seed-defaults");
  const { sql } = await import("@aks/db");

  console.log("\n=== Launch Step 4: Storefront content ===\n");

  await seedContentDefaults();
  console.log("homepage, nav, hero, category tiles — OK");
  console.log("\nStep 4 complete. Browse: http://localhost:3000/en");
  console.log("Next: npm run launch:5\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
