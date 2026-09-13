import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { ensureDefaultSizeBlocksForAllCategories } = await import(
    "../modules/sizing/ensure-default-blocks"
  );
  const { sql } = await import("@aks/db");

  const result = await ensureDefaultSizeBlocksForAllCategories();
  console.log(
    `[ensure] ${result.defaultBlocksTotal}/${result.categoriesTotal} active categories have default charts`,
  );
  if (result.blocksCreated) {
    console.log(`[ensure] created ${result.blocksCreated} blocks`);
  }
  if (result.rowSetsFilled) {
    console.log(`[ensure] filled ${result.rowSetsFilled} empty row sets`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
