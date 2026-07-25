"use server";

import { auth, unstable_update } from "@/auth";
import {
  beginTotpEnrolment,
  confirmTotpEnrolment,
  rolesRequiring2fa,
} from "@/modules/auth";

export async function startTotpEnrolmentAction(): Promise<
  | { secret: string; qrDataUrl: string; uri: string }
  | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { error: "Not signed in" };
  }
  if (session.user.twoFactorEnabled) {
    return { error: "2FA is already enabled" };
  }
  if (!rolesRequiring2fa(session.user.role)) {
    // Still allow enrolment for other roles (encouraged).
  }

  return beginTotpEnrolment({ email: session.user.email });
}

export async function completeTotpEnrolmentAction(input: {
  secret: string;
  code: string;
}): Promise<{ recoveryCodes: string[] } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not signed in" };
  }

  if (!input.secret || !/^\d{6}$/.test(input.code.trim())) {
    return { error: "Enter a valid 6-digit code" };
  }

  const result = await confirmTotpEnrolment({
    userId: session.user.id,
    secret: input.secret,
    code: input.code.trim(),
  });

  if ("error" in result) return result;

  await unstable_update({
    user: {
      twoFactorEnabled: true,
      requires2faEnrolment: false,
    },
  });

  return { recoveryCodes: result.recoveryCodes };
}
