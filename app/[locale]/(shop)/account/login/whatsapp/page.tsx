import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { auth } from "@/auth";
import { WhatsappLoginForm } from "@/modules/account/whatsapp-login-form";
import { whatsappLoginEnabled } from "@/modules/auth/social-providers";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

export default async function WhatsappLoginPage() {
  const session = await auth();
  const locale = await getLocale();

  if (session?.user?.id) {
    redirect(`/${locale}/account/orders`);
  }
  // Feature-flagged: fall back to the main sign-in page when not configured.
  if (!whatsappLoginEnabled()) {
    redirect(`/${locale}/account/login`);
  }

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-8 md:py-12">
        <h1 className="font-display text-[26px] font-medium text-ink md:text-[28px]">
          Sign in with WhatsApp
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/70">
          We&apos;ll send a one-time code to your WhatsApp number.
        </p>

        <WhatsappLoginForm redirectTo="/account/orders" />
      </div>
    </ShopPageContainer>
  );
}
