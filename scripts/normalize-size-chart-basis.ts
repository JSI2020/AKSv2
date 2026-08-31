import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * One-time normalisation of size charts already stored in the database.
 *
 * The seed fix put newly seeded blocks on a single basis (finished
 * circumference for torso loops), but blocks written before it — in particular
 * per-design forks — still hold the old mix. A chart can therefore read
 * "chest 20.50, waist 32.50", which describes a garment narrower at the chest
 * than the waist: impossible, and simply a flat half sitting next to a
 * circumference.
 *
 * Same rule as the seeds: a torso loop below 30" was captured flat and is
 * doubled; anything at or above 30" is already finished. Base value, grade
 * increment and every per-size override move together so a run never mixes
 * bases. Idempotent — a doubled value lands above the threshold and is skipped
 * on a second run.
 *
 *   npx tsx scripts/normalize-size-chart-basis.ts          (dry run)
 *   npx tsx scripts/normalize-size-chart-basis.ts --apply
 */

const TORSO_LOOP =
  /^(BUST|CHEST|WAIST|HIP|SWEEP|DAMAN)$|_(BUST|CHEST|WAIST|HIP)$|^(UPPER|LOWER|BOTTOM|TOP)_(WAIST|HIP)$/;
const FINISHED_FLOOR = 3000;

const apply = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1 });

  const rows = await sql<
    {
      id: string;
      block_id: string;
      measurement_key: string;
      base_value: number;
      grade_increment: number;
      grade_overrides: Record<string, number> | null;
      block_name: string | null;
      owner_design_id: string | null;
    }[]
  >`
    select r.id, r.block_id, r.measurement_key, r.base_value, r.grade_increment,
           r.grade_overrides, b.name as block_name, b.owner_design_id
    from size_block_rows r
    join size_blocks b on b.id = r.block_id
    order by b.name, r.sort_order`;

  const stale = rows.filter(
    (r) => TORSO_LOOP.test(r.measurement_key) && r.base_value < FINISHED_FLOOR,
  );

  if (stale.length === 0) {
    console.log("Every stored chart is already on the finished-circumference basis.");
    await sql.end({ timeout: 5 });
    return;
  }

  console.log(
    `${stale.length} row(s) still hold flat-captured values:\n`,
  );
  for (const r of stale) {
    const where = r.owner_design_id ? "design fork" : "house block";
    console.log(
      `  ${(r.block_name ?? "?").slice(0, 42).padEnd(44)} ${where.padEnd(12)} ` +
        `${r.measurement_key.padEnd(16)} ${(r.base_value / 100).toFixed(2)}" -> ${(
          (r.base_value * 2) /
          100
        ).toFixed(2)}"`,
    );
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    await sql.end({ timeout: 5 });
    return;
  }

  let changed = 0;
  for (const r of stale) {
    const overrides = r.grade_overrides
      ? Object.fromEntries(
          Object.entries(r.grade_overrides).map(([size, step]) => [
            size,
            Math.round(Number(step) * 2),
          ]),
        )
      : r.grade_overrides;

    await sql`
      update size_block_rows
      set base_value = ${r.base_value * 2},
          grade_increment = ${Math.round(r.grade_increment * 2)},
          grade_overrides = ${sql.json(overrides ?? {})}
      where id = ${r.id}`;
    changed++;
  }

  // Pinned cells hold the same units as the rows they belong to. The table is
  // keyed by (block_id, measurement_key, size_label), not a surrogate id.
  const pins = await sql<
    {
      block_id: string;
      measurement_key: string;
      size_label: string;
      value: number;
    }[]
  >`
    select block_id, measurement_key, size_label, value from size_block_cells
    where is_pinned = true and value < ${FINISHED_FLOOR}`;
  let pinned = 0;
  for (const p of pins) {
    if (!TORSO_LOOP.test(p.measurement_key)) continue;
    await sql`
      update size_block_cells set value = ${p.value * 2}
      where block_id = ${p.block_id}
        and measurement_key = ${p.measurement_key}
        and size_label = ${p.size_label}`;
    pinned++;
  }

  console.log(`\nUpdated ${changed} row(s) and ${pinned} pinned cell(s).`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
