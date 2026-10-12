import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import { AccountEditor } from "@/modules/account/account-editor";
import { AccountFrame } from "@/modules/account/account-frame";
import {
  canClearPhone,
  canDisconnectProvider,
} from "@/modules/account/methods";
import { loadAccountSnapshot } from "@/modules/account/profile-store";
import { storefrontAuthChannels } from "@/modules/auth/social-providers";

export const metadata: Metadata = {
  title: "Your account — AKS",
};

export default async function AccountPage() {
  const session = await auth();
  const t = await getTranslations("AccountHome");
  const userId = session?.user?.id;
  const isCustomer = Boolean(userId && session?.user?.role === "CUSTOMER");
  const snapshot =
    isCustomer && userId ? await loadAccountSnapshot(userId) : null;

  return (
    <AccountFrame section="details" title={t("title")}>
      {!snapshot ? (
        <div>
          <p className="auth-hint">{t("signedOut")}</p>
          <p className="account-signed-out-links">
            <Link href="/account/login" className="btn-primary">
              {t("signIn")}
            </Link>
            <Link
              href={"/account/signup" as "/account/login"}
              className="auth-back"
            >
              {t("create")}
            </Link>
          </p>
        </div>
      ) : (
        <AccountEditor
          name={snapshot.name ?? ""}
          email={snapshot.email}
          phone={snapshot.phone}
          providers={snapshot.providers}
          addresses={snapshot.addresses}
          channels={storefrontAuthChannels()}
          canClearPhone={canClearPhone({
            email: snapshot.placeholderEmail ? null : snapshot.email,
            phone: snapshot.phone,
            providers: snapshot.providers,
          })}
          disconnectable={snapshot.providers.filter((provider) =>
            canDisconnectProvider(
              {
                email: snapshot.placeholderEmail ? null : snapshot.email,
                phone: snapshot.phone,
                providers: snapshot.providers,
              },
              provider,
            ),
          )}
        />
      )}
    </AccountFrame>
  );
}
