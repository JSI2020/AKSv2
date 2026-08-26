import { config } from "dotenv";
import postgres from "postgres";
import { createHash } from "crypto";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * DEV ONLY — mint fresh admin sign-in OTP codes and print them, so you can log
 * in without a real email. Mirrors issueEmailOtp: stores sha256(code) in
 * verification_tokens with a 24-hour expiry.
 */
const OTP_TTL_MS = 24 * 60 * 60 * 1000;

function hashOtp(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "dev-admin-code is a development-only auth bypass and refuses to run with NODE_ENV=production.",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1 });

  const owners = await sql<{ email: string | null; name: string | null }[]>`
    select email, name from users where role = 'OWNER' and email is not null limit 10`;

  if (!owners.length) {
    console.log("No OWNER user found — run `npm run db:seed` first.");
    await sql.end({ timeout: 5 });
    return;
  }

  console.log("\n=== Admin sign-in codes (valid 24 hours) ===");
  for (const owner of owners) {
    const email = owner.email!.trim().toLowerCase();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + OTP_TTL_MS);
    await sql`delete from verification_tokens where identifier = ${email}`;
    await sql`insert into verification_tokens (identifier, token, expires)
      values (${email}, ${hashOtp(code)}, ${expires})`;
    console.log(`  ${email}   code: ${code}   (${owner.name ?? "OWNER"})`);
  }
  console.log(
    "\nGo to http://localhost:3000/admin/login — enter the email + code.\n",
  );
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
