import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CustomerLoginForm } from "@/modules/account/customer-login-form";
import { customerOAuthErrorKey } from "@/modules/auth/social/oauth-errors";
import { storefrontAuthChannels } from "@/modules/auth/social-providers";
import { AksBrandLogo } from "@/modules/shop/shell/aks-brand-logo";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function CustomerSignupPage({ searchParams }: Props) {
  const session = await auth();
  const t = await getTranslations("AccountLogin");
  const params = await searchParams;

  if (session?.user?.id && session.user.role === "CUSTOMER") {
    redirect("/account");
  }

  const key = customerOAuthErrorKey(params.error);

  return (
    <ShopPageContainer>
      <section className="auth-gate" aria-labelledby="signup-title">
        <div className="auth-gate-panel">
          <div className="auth-gate-brand">
            <AksBrandLogo variant="mark" className="auth-gate-mark" />
            <p className="auth-gate-eyebrow">{t("eyebrow")}</p>
            <h1 id="signup-title" className="auth-gate-title serif">
              {t("signupTitle")}
            </h1>
            <p className="auth-gate-lead">{t("signupLead")}</p>
          </div>
          <CustomerLoginForm
            intent="create"
            redirectTo="/account"
            channels={storefrontAuthChannels()}
            initialError={key ? t(key) : null}
          />
        </div>
      </section>
    </ShopPageContainer>
  );
}
