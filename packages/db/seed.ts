import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function seed() {
  const { uuidv7 } = await import("../shared");
  const { db } = await import("./client");
  const { pipelineProbe, users } = await import("./schema");
  const { eq } = await import("drizzle-orm");

  // Fixed UUIDv7 for idempotent re-seeds of the probe row (no digit-run demo OTP).
  const probeId = "01900001-2345-7890-abcd-ef1234567890";
  await db
    .insert(pipelineProbe)
    .values({ id: probeId, label: "seed-ok" })
    .onConflictDoNothing({ target: pipelineProbe.id });
  console.log(`seeded pipeline_probe ${probeId}`);

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const ownerName = process.env.OWNER_NAME?.trim();

  if (ownerEmail && ownerName) {
    const existing = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);

    if (existing[0]) {
      if (existing[0].role !== "OWNER") {
        console.warn(
          `OWNER_EMAIL ${ownerEmail} already exists as ${existing[0].role} — not promoting`,
        );
      } else {
        console.log(`OWNER already present: ${ownerEmail}`);
      }
    } else {
      const ownerCount = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "OWNER"))
        .limit(1);

      if (ownerCount[0]) {
        console.warn(
          "An OWNER already exists — skipping bootstrap for OWNER_EMAIL",
        );
      } else {
        const id = uuidv7();
        await db.insert(users).values({
          id,
          email: ownerEmail,
          name: ownerName,
          role: "OWNER",
          status: "ACTIVE",
          emailVerified: new Date(),
        });
        console.log(`seeded OWNER ${ownerEmail} (${id})`);
      }
    }
  } else {
    console.log("OWNER_EMAIL / OWNER_NAME not set — skipping owner bootstrap");
  }

  console.log(`uuidv7 sample: ${uuidv7()}`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
