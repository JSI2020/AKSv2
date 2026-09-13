import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Safepay reconciliation — orders awaiting deposit with no matching SUCCEEDED
 * Safepay payment. Bank transfer / COD excluded.
 */
async function main() {
  const { sql } = await import("@aks/db");

  const awaiting = await sql<
    {
      order_number: string;
      status: string;
      total_minor: number;
      deposit_minor: number;
      created_at: Date;
      safepay_payments: number;
    }[]
  >`
    select
      o.order_number,
      o.status,
      o.total_minor,
      o.deposit_amount_minor as deposit_minor,
      o.created_at,
      coalesce((
        select count(*)::int
        from payments p
        where p.order_id = o.id
          and p.provider = 'SAFEPAY'
          and p.status = 'SUCCEEDED'
      ), 0) as safepay_payments
    from orders o
    where o.status in ('AWAITING_DEPOSIT', 'DEPOSIT_PAID')
    order by o.created_at desc
    limit 200`;

  const unmatched = awaiting.filter((o) => o.safepay_payments === 0);

  console.log("\n=== Safepay reconciliation ===\n");
  console.log(`Open orders (awaiting/partial): ${awaiting.length}`);
  console.log(`Without Safepay SUCCEEDED payment: ${unmatched.length}\n`);

  for (const o of unmatched.slice(0, 30)) {
    console.log(
      `  ${o.order_number}  ${o.status}  deposit ${o.deposit_minor}  created ${o.created_at.toISOString().slice(0, 10)}`,
    );
  }

  if (unmatched.length > 30) {
    console.log(`  … and ${unmatched.length - 30} more`);
  }

  const dupes = await sql<
    { idempotency_key: string; count: number }[]
  >`
    select idempotency_key, count(*)::int as count
    from payments
    where provider = 'SAFEPAY' and idempotency_key is not null
    group by idempotency_key
    having count(*) > 1`;

  if (dupes.length > 0) {
    console.log(`\nWARNING: ${dupes.length} duplicate Safepay idempotency key(s).`);
    for (const d of dupes) {
      console.log(`  ${d.idempotency_key} × ${d.count}`);
    }
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  await sql.end({ timeout: 5 });
  console.log("\nNo duplicate Safepay idempotency keys.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
