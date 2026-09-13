import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type Issue = { level: "blocker" | "warn"; design: string; slug: string; detail: string };

/**
 * F9 — Launch catalogue audit. Lists published designs missing sizing ghost,
 * empty size charts, zero inventory rows, or missing renders.
 *
 * Exit 1 when any blockers exist (use before marketing push).
 */
async function main() {
  const strict = process.argv.includes("--strict");
  const { db, sql } = await import("@aks/db");

  const rows = await sql<
    {
      id: string;
      slug: string;
      name: string;
      sizing_ghost_url: string | null;
      size_block_id: string | null;
      size_row_count: number;
      colourway_count: number;
      render_count: number;
      rtw_row_count: number;
      rtw_on_hand: number;
    }[]
  >`
    select
      d.id,
      d.slug,
      d.name,
      d.sizing_ghost_url,
      d.size_block_id,
      d.garment_type_id,
      coalesce((
      select count(*)::int
      from size_block_rows sbr
      where sbr.block_id = coalesce(
        d.size_block_id,
        (
          select sb.id from size_blocks sb
          inner join garment_categories gc on gc.id = sb.category_id
          where gc.id = d.garment_type_id
            and sb.is_default = true
            and sb.active = true
          limit 1
        )
      )
    ), 0) as size_row_count,
      coalesce((
        select count(*)::int from colourways cw
        where cw.design_id = d.id and cw.active
      ), 0) as colourway_count,
      coalesce((
        select count(*)::int from design_renders dr
        where dr.design_id = d.id
      ), 0) as render_count,
      coalesce((
        select count(*)::int from rtw_stock rs
        where rs.design_id = d.id
      ), 0) as rtw_row_count,
      coalesce((
        select sum(rs.quantity_on_hand)::int from rtw_stock rs
        where rs.design_id = d.id
      ), 0) as rtw_on_hand
    from designs d
    where d.status = 'PUBLISHED'
    order by d.name`;

  const issues: Issue[] = [];

  for (const d of rows) {
    if (!d.sizing_ghost_url?.trim()) {
      issues.push({
        level: strict ? "blocker" : "warn",
        design: d.name,
        slug: d.slug,
        detail: "no sizing ghost — run Recognise sizing in Design Studio",
      });
    }
    if (d.size_row_count < 1) {
      issues.push({
        level: "blocker",
        design: d.name,
        slug: d.slug,
        detail: "size chart empty (no category fallback either)",
      });
    }
    if (d.colourway_count < 1) {
      issues.push({
        level: "blocker",
        design: d.name,
        slug: d.slug,
        detail: "no active colourways",
      });
    }
    if (d.render_count < 1) {
      issues.push({
        level: "blocker",
        design: d.name,
        slug: d.slug,
        detail: "no renders",
      });
    }
    if (d.rtw_row_count < 1) {
      issues.push({
        level: "blocker",
        design: d.name,
        slug: d.slug,
        detail: "no RTW inventory rows — republish or run db:ensure:rtw-stock",
      });
    } else if (d.rtw_on_hand < 1) {
      issues.push({
        level: "warn",
        design: d.name,
        slug: d.slug,
        detail: "RTW rows exist but on-hand qty is 0 everywhere",
      });
    }
  }

  console.log(`\n=== Launch catalogue audit (${rows.length} published) ===\n`);

  if (issues.length === 0) {
    console.log("All published designs pass launch checks.");
    await sql.end({ timeout: 5 });
    return;
  }

  const blockers = issues.filter((i) => i.level === "blocker");
  const warns = issues.filter((i) => i.level === "warn");

  for (const i of blockers) {
    console.log(`BLOCKER  ${i.slug} — ${i.detail}`);
  }
  for (const i of warns) {
    console.log(`WARN     ${i.slug} — ${i.detail}`);
  }

  console.log(`\n${blockers.length} blocker(s), ${warns.length} warning(s).`);

  await sql.end({ timeout: 5 });
  if (blockers.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
