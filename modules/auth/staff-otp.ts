export type StaffOtpUser = {
  role: string;
  status: string;
  deletedAt: Date | string | null;
};

export type StaffOtpGate =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Admin sign-in only emails codes to active staff. Customers, unknown
 * addresses, and disabled accounts get an explicit refusal — the form used
 * to show the same “code sent” line and then send nothing.
 */
export function staffOtpGate(user: StaffOtpUser | null): StaffOtpGate {
  if (!user || user.deletedAt || user.role === "CUSTOMER") {
    return {
      ok: false,
      error: "That email is not a staff account, so no code was sent.",
    };
  }
  if (user.status === "DISABLED") {
    return {
      ok: false,
      error: "This staff account is disabled, so no code was sent.",
    };
  }
  return { ok: true };
}
