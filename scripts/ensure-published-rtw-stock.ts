import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Backfill RTW stock rows for all published designs (safe to re-run). */
async function main() {
  const { eq } = await import("drizzle-orm");
  const { db, designs } = await import("@aks/db");
  const { STANDARD_SIZE_LABELS } = await import("@aks/shared");
  const { seedRtwStockForDesign } = await import(
    "@/modules/inventory/rtw-stock"
  );

  const rows = await db
    .select({
      id: designs.id,
      name: designs.name,
      availableSizeLabels: designs.availableSizeLabels,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  if (!rows.length) {
    console.log("No published designs.");
    return;
  }

  let totalCreated = 0;
  for (const row of rows) {
    const labels =
      row.availableSizeLabels?.length > 0
        ? row.availableSizeLabels
        : STANDARD_SIZE_LABELS.filter((l) => l !== "XXL");

    const created = await db.transaction(async (tx) =>
      seedRtwStockForDesign(tx, row.id, labels),
    );
    totalCreated += created;
    console.log(`  ${row.name}: ${created} new stock row(s)`);
  }

  console.log(
    `\nDone — ${totalCreated} new RTW stock row(s) across ${rows.length} design(s).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
