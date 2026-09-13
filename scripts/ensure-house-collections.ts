import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { DEFAULT_HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

/** Idempotent seed for house_collections after migrate. */
async function main() {
  const { db, houseCollections, sql } = await import("@aks/db");
  const { count } = await import("drizzle-orm");
  const { uuidv7 } = await import("@aks/shared");

  const existing = await db.select({ slug: houseCollections.slug }).from(houseCollections);
  const bySlug = new Set(existing.map((r) => r.slug));

  let inserted = 0;
  for (const def of DEFAULT_HOUSE_COLLECTIONS) {
    if (bySlug.has(def.slug)) continue;
    await db.insert(houseCollections).values({
      id: uuidv7(),
      tag: def.tag,
      slug: def.slug,
      itemCode: def.itemCode,
      navLabel: def.navLabel,
      title: def.title,
      tagline: def.tagline,
      card: def.card,
      intro: def.intro,
      sortOrder: def.sortOrder,
      active: true,
    });
    inserted += 1;
    console.log(`  + ${def.navLabel}`);
  }

  const [totalRow] = await db
    .select({ n: count() })
    .from(houseCollections);
  const total = Number(totalRow?.n ?? 0);
  console.log(`\nensure-house-collections: ${inserted} inserted, ${total} total`);

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
