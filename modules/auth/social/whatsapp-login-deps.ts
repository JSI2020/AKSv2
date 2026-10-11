import "server-only";

import { eq } from "drizzle-orm";

import { db, users } from "@aks/db";
import {
  checkOtpRequestRateLimit,
  clientIpFromHeaders,
  logSignInAttempt,
} from "@/modules/auth";
import { issuePhoneOtp } from "@/modules/auth/phone-otp";
import { whatsappLoginEnabled } from "@/modules/auth/social-providers";

import type { WhatsappLoginDeps } from "./whatsapp-login";

export function liveWhatsappLoginDeps(): WhatsappLoginDeps {
  return {
    enabled: whatsappLoginEnabled,
    clientIp: clientIpFromHeaders,
    rateLimit: checkOtpRequestRateLimit,
    log: logSignInAttempt,
    async findUserByPhone(msisdn) {
      const [user] = await db
        .select({
          role: users.role,
          deletedAt: users.deletedAt,
          status: users.status,
        })
        .from(users)
        .where(eq(users.phone, msisdn))
        .limit(1);
      return user ?? null;
    },
    issueOtp: async (phone) => issuePhoneOtp({ phone }),
  };
}
