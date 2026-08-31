import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Write the house standard blocks into house charts that are still seed filler.
 *
 * Categories without a researched block were seeded from a generic fallback —
 * every girth 36", every width 14", every length 38", and every row grading by
 * the same 2". That charts and publishes exactly like a real block, so a design
 * inheriting it looks finished while carrying numbers no pattern room would
 * cut.
 *
 * Only filler is touched: a researched block, an edited house chart, and any
 * per-design fork are all left alone. Idempotent — once a chart holds real
 * numbers it no longer matches the filler signature.
 *
 *   npx tsx scripts/apply-house-standards.ts          (dry run)
 *   npx tsx scripts/apply-house-standards.ts --apply
 */

const apply = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const { HOUSE_STANDARD_BLOCKS, HOUSE_GRADE_BY_KEY } = await import(
    "../packages/shared/sizing-research/house-standard-blocks"
  );
  const { looksLikePlaceholderChart } = await import(
    "../packages/shared/placeholder-chart"
  );

  const sql = postgres(url, { max: 1 });
  const hundredths = (inches: number) => Math.round(inches * 100);

  const blocks = await sql<
    { id: string; name: string; key: string }[]
  >`
    select b.id, b.name, gc.key
    from size_blocks b
    join garment_categories gc on gc.id = b.category_id
    where b.is_default = true and b.owner_design_id is null
    order by gc.key`;

  let updated = 0;
  let skipped = 0;

  for (const block of blocks) {
    const spec = HOUSE_STANDARD_BLOCKS[block.key];
    if (!spec) {
      skipped++;
      continue;
    }

    const rows = await sql<
      { measurement_key: string; base_value: number; grade_increment: number }[]
    >`
      select measurement_key, base_value, grade_increment
      from size_block_rows where block_id = ${block.id}`;
    if (rows.length === 0) {
      skipped++;
      continue;
    }

    const isFiller = looksLikePlaceholderChart(
      rows.map((r) => ({
        measurementKey: r.measurement_key,
        baseValue: r.base_value,
        gradeIncrement: r.grade_increment,
      })),
    );
    if (!isFiller) {
      skipped++;
      continue;
    }

    // Only keys this chart already carries — a trouser must not grow a sleeve.
    const changes = rows
      .map((r) => {
        const value = spec.base[r.measurement_key];
        if (value === undefined) return null;
        return {
          key: r.measurement_key,
          base: hundredths(value),
          grade: hundredths(HOUSE_GRADE_BY_KEY[r.measurement_key] ?? 0.5),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (changes.length === 0) {
      skipped++;
      continue;
    }

    console.log(
      `${block.key.padEnd(16)} ${changes
        .map((c) => `${c.key}=${(c.base / 100).toFixed(1)}`)
        .join("  ")}`,
    );

    if (apply) {
      for (const c of changes) {
        await sql`
          update size_block_rows
          set base_value = ${c.base}, grade_increment = ${c.grade}
          where block_id = ${block.id} and measurement_key = ${c.key}`;
      }
      await sql`
        update size_blocks
        set name = ${`${block.key} house standard`},
            notes = ${`${spec.note} Finished-garment measurements at base M.`}
        where id = ${block.id}`;
    }
    updated++;
  }

  console.log(
    `\n${updated} chart(s) ${apply ? "updated" : "would be updated"}, ${skipped} left alone.`,
  );
  if (!apply) console.log("Dry run. Re-run with --apply to write.");
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
