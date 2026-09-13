import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Unpublish launch-seeded demo catalogue designs (slug demo-*). Keeps rows; hides from inventory hub. */
async function main() {
  const { db, designs, sql } = await import("@aks/db");
  const { and, eq, like } = await import("drizzle-orm");

  const rows = await db
    .update(designs)
    .set({
      status: "DRAFT",
      publishedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(designs.status, "PUBLISHED"), like(designs.slug, "demo-%")))
    .returning({ slug: designs.slug });

  console.log(`Unpublished ${rows.length} demo catalogue design(s).`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
