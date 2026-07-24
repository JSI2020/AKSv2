import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function seed() {
  const { uuidv7 } = await import("../shared");
  const { db } = await import("./client");
  const { pipelineProbe } = await import("./schema");

  // Fixed UUIDv7 for idempotent re-seeds of the probe row.
  const id = "01900000-0000-7000-8000-000000000001";
  await db
    .insert(pipelineProbe)
    .values({ id, label: "seed-ok" })
    .onConflictDoNothing({ target: pipelineProbe.id });
  console.log(`seeded pipeline_probe ${id}`);
  console.log(`uuidv7 sample: ${uuidv7()}`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
