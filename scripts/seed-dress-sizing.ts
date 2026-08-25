import "dotenv/config";
import { db, sql } from "@/packages/db";
import { seedBodyGrid } from "@/modules/dress-sizing/db/seed-grid";
import { seedStyleTemplates } from "@/modules/dress-sizing/db/seed-templates";

async function main() {
  const grid = await seedBodyGrid(db);
  const templateCount = await seedStyleTemplates(db);
  console.log(`Seeded dress sizing: ${grid.rowCount} grid rows, ${templateCount} templates.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
