import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { auth } from "@/auth";
import { CustomerLoginForm } from "@/modules/account/customer-login-form";
import {
  configuredSocialProviders,
  whatsappLoginEnabled,
} from "@/modules/auth/social-providers";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

export default async function CustomerLoginPage() {
  const session = await auth();
  const locale = await getLocale();

  if (session?.user?.id) {
    redirect(`/${locale}/account/orders`);
  }

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-8 md:py-12">
        <h1 className="font-display text-[26px] font-medium text-ink md:text-[28px]">
          Sign in
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/70">
          Track orders, see what we&apos;re making for you, and keep your details
          for next time.
        </p>

        <CustomerLoginForm
          redirectTo="/account/orders"
          socialProviders={configuredSocialProviders()}
          whatsappEnabled={whatsappLoginEnabled()}
        />
      </div>
    </ShopPageContainer>
  );
}
