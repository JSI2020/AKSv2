import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Rename legacy DEMO-prefixed fabric names to Demo prefix. */
async function main() {
  const { db, fabrics, sql: dbSql } = await import("@aks/db");
  const { eq, like } = await import("drizzle-orm");

  const rows = await db
    .select({ id: fabrics.id, name: fabrics.name })
    .from(fabrics)
    .where(like(fabrics.name, "DEMO %"));

  for (const row of rows) {
    const next = `Demo ${row.name.slice(5)}`;
    await db
      .update(fabrics)
      .set({ name: next, updatedAt: new Date() })
      .where(eq(fabrics.id, row.id));
    console.log(`  ${row.name} → ${next}`);
  }

  if (rows.length === 0) console.log("  (no DEMO % names found)");

  await dbSql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
