import { normalizeEmail } from "@/modules/auth/otp";

/** Last 10 digits, so 03… and +92… describe the same Pakistani number. */
export function phoneKey(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) return digits.replace(/^0+/, "");
  return digits.slice(-10);
}

export function phonesMatch(a: string, b: string): boolean {
  const left = phoneKey(a);
  const right = phoneKey(b);
  if (left.length < 7 || right.length < 7) return false;
  return left === right;
}

export function orderContactMatches(input: {
  email: string | null;
  phone: string | null;
  orderEmails: Array<string | null | undefined>;
  orderPhones: Array<string | null | undefined>;
}): boolean {
  const email = input.email?.trim() ? normalizeEmail(input.email) : "";
  const phone = input.phone?.trim() ?? "";
  if (!email && !phone) return false;

  const emailOk =
    email.length > 0 &&
    input.orderEmails.some(
      (value) => value && normalizeEmail(value) === email,
    );
  const phoneOk =
    phone.length > 0 &&
    input.orderPhones.some((value) => value && phonesMatch(value, phone));

  if (email && phone) return emailOk || phoneOk;
  return email ? emailOk : phoneOk;
}
