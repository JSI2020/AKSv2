import { config } from "dotenv";
import { execSync } from "node:child_process";

config({ path: ".env.local" });
config({ path: ".env" });

/** Step 5 — verify counts + launch catalogue audit. */
async function main() {
  const { sql } = await import("@aks/db");

  console.log("\n=== Launch Step 5: Verify ===\n");

  const [counts] = await sql<
    {
      fabrics: number;
      published: number;
      colourways: number;
      rtw: number;
      lots: number;
      homepage: number;
    }[]
  >`
    select
      (select count(*)::int from fabrics where active) as fabrics,
      (select count(*)::int from designs where status = 'PUBLISHED') as published,
      (select count(*)::int from colourways where active) as colourways,
      (select count(*)::int from rtw_stock) as rtw,
      (select count(*)::int from fabric_lots) as lots,
      (select count(*)::int from homepages where status = 'PUBLISHED') as homepage`;

  console.log(counts);

  await sql.end({ timeout: 5 });

  execSync("npm run audit:launch-catalogue", {
    stdio: "inherit",
    env: process.env,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
