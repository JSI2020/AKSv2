import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

import { SignOutButton } from "./sign-out-button";

export async function AccountFrame({
  section,
  title,
  children,
}: {
  section: "details" | "orders";
  title: string;
  children: ReactNode;
}) {
  const session = await auth();
  const t = await getTranslations("AccountHome");
  const signedIn = Boolean(
    session?.user?.id && session.user.role === "CUSTOMER",
  );

  return (
    <ShopPageContainer>
      <div className="account-home">
        <header className="account-home-head">
          <p className="auth-gate-eyebrow">{t("eyebrow")}</p>
          <h1 className="serif account-home-title">{title}</h1>
        </header>
        {signedIn ? (
          <nav className="account-nav" aria-label={t("navLabel")}>
            <Link
              href={"/account" as "/account/orders"}
              aria-current={section === "details" ? "page" : undefined}
            >
              {t("navDetails")}
            </Link>
            <Link
              href="/account/orders"
              aria-current={section === "orders" ? "page" : undefined}
            >
              {t("navOrders")}
            </Link>
            <SignOutButton label={t("signOut")} />
          </nav>
        ) : null}
        {children}
      </div>
    </ShopPageContainer>
  );
}
