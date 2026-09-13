import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { sql } = await import("@aks/db");
  const [c] = await sql<
    {
      pub: number;
      demo: number;
      launch: number;
      fabrics: number;
      rtw_sum: number;
      orders: number;
    }[]
  >`
    select
      (select count(*)::int from designs where status = 'PUBLISHED') as pub,
      (select count(*)::int from designs where slug like 'demo-%') as demo,
      (select count(*)::int from designs where slug like 'essentials-%' or slug like 'tailored-%' or slug like 'occasion-%' or slug like 'signature-%' or slug like 'separates-%') as launch,
      (select count(*)::int from fabrics where active) as fabrics,
      (select coalesce(sum(quantity_on_hand),0)::int from rtw_stock) as rtw_sum,
      (select count(*)::int from orders) as orders`;
  console.log("counts", c);
  const sample = await sql`select slug, name, status from designs order by created_at desc limit 5`;
  console.log("recent", sample);
  await sql.end({ timeout: 5 });
}
main();
