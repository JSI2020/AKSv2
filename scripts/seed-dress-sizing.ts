import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, sql } = await import("@/packages/db");
  const { seedBodyGrid } = await import("@/modules/dress-sizing/db/seed-grid");
  const { seedStyleTemplates } = await import(
    "@/modules/dress-sizing/db/seed-templates"
  );

  const grid = await seedBodyGrid(db);
  const templateCount = await seedStyleTemplates(db);
  console.log(
    `Seeded dress sizing: ${grid.rowCount} grid rows, ${templateCount} templates.`,
  );
  await sql.end({ timeout: 5 });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
