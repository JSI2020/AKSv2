import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import { WhatsappOnboarding } from "@/modules/messaging/admin/whatsapp-onboarding";
import { loadWhatsappConnectionView } from "@/modules/messaging/whatsapp-coexistence";
import {
  HOUSE_WHATSAPP_DISPLAY,
  HOUSE_WHATSAPP_PHONE_NUMBER_ID,
  HOUSE_WHATSAPP_WABA_ID,
  whatsappGraphVersion,
} from "@/modules/messaging/whatsapp-coexistence-parse";
import {
  PermissionDeniedError,
  requirePermission,
  UnauthenticatedError,
} from "@/modules/auth";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-indigo-lift py-2 text-[13px]">
      <dt className="text-chalk">{label}</dt>
      <dd className="text-greige">{value}</dd>
    </div>
  );
}

export default async function WhatsappSettingsPage() {
  try {
    await requirePermission("settings.view");
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect("/admin/login");
    if (e instanceof PermissionDeniedError) redirect("/admin");
    throw e;
  }

  const view = await loadWhatsappConnectionView();
  const sending =
    view.phoneSource === "connected" && view.phoneNumberId
      ? view.phoneNumberId
      : view.envPhoneNumberId ?? "Not set";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Eyebrow>Settings · WhatsApp</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          WhatsApp Business app
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Link {HOUSE_WHATSAPP_DISPLAY} to the Cloud API with a QR scan. The
          WhatsApp Business app stays signed in on the phone.
        </p>
        <Link
          href="/admin/settings"
          className="mt-2 inline-block text-[12px] text-zari underline-offset-2 hover:underline"
        >
          Back to settings
        </Link>
      </div>

      <dl>
        <Row label="Meta app" value={`AKS Atelier · ${view.appId}`} />
        <Row label="Shop number" value={HOUSE_WHATSAPP_DISPLAY} />
        <Row label="House WABA" value={HOUSE_WHATSAPP_WABA_ID} />
        <Row label="House phone id" value={HOUSE_WHATSAPP_PHONE_NUMBER_ID} />
        <Row
          label="Sending as"
          value={
            view.phoneSource === "connected"
              ? `${sending} (linked number)`
              : `${sending} (env fallback)`
          }
        />
        <Row label="Link status" value={view.status} />
        <Row
          label="Linked WABA"
          value={
            view.wabaId
              ? view.houseWaba
                ? `${view.wabaId} (house)`
                : `${view.wabaId} (not the house WABA)`
              : "—"
          }
        />
        <Row label="Linked phone id" value={view.phoneNumberId ?? "—"} />
        <Row
          label="Display number"
          value={view.displayPhoneNumber ?? "—"}
        />
        <Row label="Contacts sync" value={view.contactsSync} />
        <Row label="History sync" value={view.historySync} />
        <Row label="Contacts stored" value={String(view.contactsReceived)} />
        <Row
          label="History messages"
          value={String(view.historyMessagesReceived)}
        />
      </dl>
      {view.lastError ? (
        <p className="text-[13px] text-chalk">{view.lastError}</p>
      ) : null}
      {view.contactsSyncDetail ? (
        <p className="text-[12px] text-chalk">{view.contactsSyncDetail}</p>
      ) : null}
      {view.historySyncDetail ? (
        <p className="text-[12px] text-chalk">{view.historySyncDetail}</p>
      ) : null}

      <WhatsappOnboarding
        appId={view.appId}
        graphVersion={whatsappGraphVersion()}
        configId={view.configId}
        appSecretConfigured={view.appSecretConfigured}
        canLaunch={Boolean(view.configId) && view.appSecretConfigured}
      />

      <section className="flex flex-col gap-2 text-[13px] text-chalk">
        <h2 className="font-sans text-[10.5px] uppercase tracking-[0.2em]">
          Meta dashboard
        </h2>
        <ol className="flex list-decimal flex-col gap-2 ps-5">
          <li>
            Open the Meta app AKS Atelier ({view.appId}). Add the products
            WhatsApp and Facebook Login for Business if they are not there.
            App mode must be Live, or the Facebook user who scans must be an
            app admin, developer, or tester.
          </li>
          <li>
            Settings → Basic: App domains `aks-atelier.com`. Privacy policy
            URL `https://www.aks-atelier.com/privacy`. Site URL
            `https://www.aks-atelier.com`.
          </li>
          <li>
            Facebook Login for Business → Settings: turn on Client OAuth
            login, Web OAuth login, and Login with the JavaScript SDK. Enforce
            HTTPS. Allowed domains for the JavaScript SDK:
            `https://www.aks-atelier.com`. Valid OAuth redirect URI:
            `https://www.aks-atelier.com/admin/settings/whatsapp`.
          </li>
          <li>
            Facebook Login for Business → Configurations → Create
            configuration. Login variation: WhatsApp Embedded Signup.
            Permissions: whatsapp_business_management and
            whatsapp_business_messaging. Copy the configuration id and save it
            on this page. The QR flow passes feature type
            whatsapp_business_app_onboarding itself.
          </li>
          <li>
            Settings → Basic → App secret: put that value in the server env as
            WHATSAPP_APP_SECRET (this app, not the Facebook login app). Restart
            the app container after saving .env. Do not replace
            WHATSAPP_ACCESS_TOKEN.
          </li>
          <li>
            WhatsApp → Configuration → webhook callback
            `https://www.aks-atelier.com/api/webhooks/whatsapp` with the
            existing verify token. Subscribe fields messages,
            smb_app_state_sync, history, smb_message_echoes, and
            account_update. The link step also subscribes the app to the WABA.
          </li>
          <li>
            On this page, choose Link WhatsApp Business app. When the QR
            appears, scan it from the WhatsApp Business app that is signed in
            as {HOUSE_WHATSAPP_DISPLAY}. Leave history sharing on if you want
            the old chats. The phone keeps using the Business app.
          </li>
        </ol>
      </section>
    </div>
  );
}
