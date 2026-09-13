import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, garmentCategories, sizeBlocks, sql } = await import("@aks/db");
  const { eq, and } = await import("drizzle-orm");

  const cats = await db
    .select({
      id: garmentCategories.id,
      key: garmentCategories.key,
      active: garmentCategories.active,
    })
    .from(garmentCategories)
    .orderBy(garmentCategories.sortOrder);

  const defs = await db
    .select({
      id: sizeBlocks.id,
      categoryId: sizeBlocks.categoryId,
      name: sizeBlocks.name,
    })
    .from(sizeBlocks)
    .where(and(eq(sizeBlocks.isDefault, true), eq(sizeBlocks.active, true)));

  const defByCat = new Map(defs.map((d) => [d.categoryId, d]));
  const missing = cats.filter((c) => !defByCat.has(c.id));

  console.log("categories:", cats.length);
  console.log("default blocks:", defs.length);
  console.log("missing default block:", missing.length);
  if (missing.length) {
    console.log("missing keys:", missing.map((m) => m.key).join(", "));
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
