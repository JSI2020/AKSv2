import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  const sql = postgres(url, { max: 1 });

  const q = async (label: string, query: string) => {
    const rows = await sql.unsafe(query);
    console.log(JSON.stringify({ label, rows }));
  };

  await q(
    "counts",
    `
    select
      (select count(*)::int from designs) as designs,
      (select count(*)::int from designs where status = 'PUBLISHED') as designs_published,
      (select count(*)::int from colourways) as colourways,
      (select count(*)::int from fabrics) as fabrics,
      (select count(*)::int from fabrics where active) as fabrics_active,
      (select count(*)::int from fabric_lots) as fabric_lots,
      (select count(*)::int from rtw_stock) as rtw_stock,
      (select count(*)::int from discounts) as discounts,
      (select count(*)::int from discounts where status = 'ACTIVE') as discounts_active,
      (select count(*)::int from announcements) as announcements,
      (select count(*)::int from announcements where active) as announcements_active,
      (select count(*)::int from hero_slides) as hero_slides,
      (select count(*)::int from category_tiles) as category_tiles,
      (select count(*)::int from featured_blocks) as featured_blocks,
      (select count(*)::int from homepages) as homepages,
      (select count(*)::int from content_pages) as content_pages,
      (select count(*)::int from nav_items) as nav_items,
      (select count(*)::int from orders) as orders,
      (select count(*)::int from garment_categories) as garment_categories,
      (select count(*)::int from size_blocks where active) as size_blocks_active
  `,
  );

  await q(
    "design_statuses",
    `select status, count(*)::int as n from designs group by status order by n desc`,
  );

  await q(
    "sample_designs",
    `select slug, status, name, "basePriceMinor" as price from designs order by created_at desc limit 15`,
  );

  await q(
    "fabrics_sample",
    `select name, active, "costPerMeterMinor" is not null as has_cost from fabrics order by name limit 20`,
  );

  await q(
    "discounts_sample",
    `select name, code, status, type, "appliesTo" from discounts order by created_at desc limit 10`,
  );

  await q(
    "announcements_sample",
    `select message, active, "startsAt", "endsAt" from announcements order by sort_order, created_at desc limit 10`,
  );

  await q(
    "homepage",
    `select id, status from homepages`,
  );

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
