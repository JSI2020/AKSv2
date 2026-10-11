import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WhatsappLoginForm } from "@/modules/account/whatsapp-login-form";
import { whatsappLoginEnabled } from "@/modules/auth/social-providers";
import { AksBrandLogo } from "@/modules/shop/shell/aks-brand-logo";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

export default async function WhatsappLoginPage() {
  const session = await auth();
  const t = await getTranslations("AccountLogin");

  if (session?.user?.id && session.user.role === "CUSTOMER") {
    redirect("/account");
  }
  if (!whatsappLoginEnabled()) {
    redirect("/account/login");
  }

  return (
    <ShopPageContainer>
      <section className="auth-gate" aria-labelledby="auth-wa-title">
        <div className="auth-gate-panel">
          <div className="auth-gate-brand">
            <AksBrandLogo variant="mark" className="auth-gate-mark" />
            <p className="auth-gate-eyebrow">{t("eyebrow")}</p>
            <h1 id="auth-wa-title" className="auth-gate-title serif">
              {t("whatsappTitle")}
            </h1>
            <p className="auth-gate-lead">{t("whatsappLead")}</p>
          </div>

          <WhatsappLoginForm redirectTo="/account" />
        </div>
      </section>
    </ShopPageContainer>
  );
}
