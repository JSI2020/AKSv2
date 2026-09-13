import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

/** DEV ONLY — clear OTP rate-limit rows so admin login works again after testing. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const emailArg = process.argv[2]?.trim().toLowerCase();
  const sql = postgres(url, { max: 1 });

  const reasons = [
    "otp_request",
    "otp_invalid",
    "2fa_invalid",
    "otp_verify_locked",
    "otp_rate_limited_email",
    "otp_rate_limited_ip",
    "otp_rate_limited_verify",
  ];

  if (emailArg) {
    const deleted = await sql`
      delete from sign_in_attempts
      where email = ${emailArg}
        and reason in ${sql(reasons)}`;
    console.log(`Cleared ${deleted.count} rate-limit row(s) for ${emailArg}.`);
  } else {
    const deleted = await sql`
      delete from sign_in_attempts
      where reason in ${sql(reasons)}`;
    console.log(`Cleared ${deleted.count} OTP rate-limit row(s) for all emails.`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
