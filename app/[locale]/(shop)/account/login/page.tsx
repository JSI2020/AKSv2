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

function oauthErrorMessage(
  error: string | undefined,
  t: (key: string) => string,
): string | null {
  const key = customerOAuthErrorKey(error);
  return key ? t(key) : null;
}

export default async function CustomerLoginPage({ searchParams }: Props) {
  const session = await auth();
  const t = await getTranslations("AccountLogin");
  const params = await searchParams;

  if (session?.user?.id && session.user.role === "CUSTOMER") {
    redirect("/account");
  }

  const channels = storefrontAuthChannels();
  const oauthError = oauthErrorMessage(params.error, t);

  return (
    <ShopPageContainer>
      <section className="auth-gate" aria-labelledby="auth-title">
        <div className="auth-gate-panel">
          <div className="auth-gate-brand">
            <AksBrandLogo variant="mark" className="auth-gate-mark" />
            <p className="auth-gate-eyebrow">{t("eyebrow")}</p>
            <h1 id="auth-title" className="auth-gate-title serif">
              {t("title")}
            </h1>
            <p className="auth-gate-lead">{t("lead")}</p>
          </div>

          <CustomerLoginForm
            intent="sign-in"
            redirectTo="/account"
            channels={channels}
            initialError={oauthError}
          />
        </div>
      </section>
    </ShopPageContainer>
  );
}
