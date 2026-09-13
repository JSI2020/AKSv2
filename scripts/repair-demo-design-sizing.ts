/**
 * Repair demo designs whose availableSizeLabels don't match their size block
 * (e.g. Dupatta "One size" vs forced XS–XL) and re-seed RTW rows for those labels.
 *
 * Run: npx tsx scripts/repair-demo-design-sizing.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { eq, like } = await import("drizzle-orm");
  const { db, designs, sizeBlocks, users, sql } = await import("@aks/db");
  const { STANDARD_SIZE_LABELS } = await import("@aks/shared");
  const { seedAndReceiveRtwForDesign } = await import(
    "@/modules/inventory/rtw-stock"
  );

  const fallback = STANDARD_SIZE_LABELS.filter((l) => l !== "XXL");
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER");

  const rows = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      sizeBlockId: designs.sizeBlockId,
      availableSizeLabels: designs.availableSizeLabels,
    })
    .from(designs)
    .where(like(designs.slug, "demo-%"));

  let fixed = 0;
  for (const d of rows) {
    if (!d.sizeBlockId) continue;
    const [block] = await db
      .select({ sizeLabels: sizeBlocks.sizeLabels })
      .from(sizeBlocks)
      .where(eq(sizeBlocks.id, d.sizeBlockId))
      .limit(1);
    const labels =
      block?.sizeLabels?.length ? [...block.sizeLabels] : fallback;
    const current = d.availableSizeLabels ?? [];
    const same =
      current.length === labels.length &&
      current.every((l, i) => l === labels[i]);
    if (!same) {
      await db
        .update(designs)
        .set({ availableSizeLabels: labels, updatedAt: new Date() })
        .where(eq(designs.id, d.id));
      console.log(`  labels ${d.slug} → ${labels.join(", ")}`);
      fixed += 1;
    }

    await db.transaction((tx) =>
      seedAndReceiveRtwForDesign(
        tx,
        d.id,
        labels,
        5,
        owner.id,
        "Demo sizing repair opening stock",
      ),
    );
  }

  console.log(`\nRepaired ${fixed} design label set(s); RTW synced for ${rows.length}.\n`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
