"use client";

import { useEffect, useState, useTransition } from "react";

import {
  completeWhatsappCoexistenceAction,
  saveWhatsappConfigAction,
} from "./actions";
import { WHATSAPP_COEXISTENCE_FEATURE } from "../whatsapp-coexistence-parse";

type FbAuth = { authResponse?: { code?: string } };

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FbAuth) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type Finish = { wabaId: string; phoneNumberId: string };

const FACEBOOK_ORIGINS = new Set([
  "https://www.facebook.com",
  "https://web.facebook.com",
]);

export function WhatsappOnboarding(props: {
  appId: string;
  graphVersion: string;
  configId: string | null;
  appSecretConfigured: boolean;
  canLaunch: boolean;
}) {
  const [configId, setConfigId] = useState(props.configId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    const init = () => {
      window.FB?.init({
        appId: props.appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: props.graphVersion,
      });
      setSdkReady(true);
    };
    window.fbAsyncInit = init;
    if (window.FB) {
      init();
      return;
    }
    const existing = document.getElementById("facebook-jssdk");
    if (existing) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    document.body.appendChild(script);
  }, [props.appId, props.graphVersion]);

  function launch() {
    if (!window.FB || !props.configId) return;
    setMessage(null);
    const bag: { code?: string; finish?: Finish } = {};
    const submit = () => {
      if (!bag.code || !bag.finish) return;
      const code = bag.code;
      const finish = bag.finish;
      bag.code = undefined;
      bag.finish = undefined;
      startTransition(async () => {
        const result = await completeWhatsappCoexistenceAction({
          code,
          session: {
            type: "WA_EMBEDDED_SIGNUP",
            event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
            data: {
              waba_id: finish.wabaId,
              phone_number_id: finish.phoneNumberId,
            },
          },
        });
        setMessage(
          result.ok
            ? "The shop number is linked. The WhatsApp Business app stays signed in."
            : result.error,
        );
      });
    };

    const onMessage = (event: MessageEvent) => {
      if (!FACEBOOK_ORIGINS.has(event.origin)) return;
      let parsed: unknown;
      try {
        parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as {
        type?: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string; error_message?: string; current_step?: string };
      };
      if (record.type !== "WA_EMBEDDED_SIGNUP") return;
      if (
        record.event === "FINISH" ||
        record.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
      ) {
        const wabaId = record.data?.waba_id ?? "";
        const phoneNumberId = record.data?.phone_number_id ?? "";
        if (!wabaId || !phoneNumberId) return;
        bag.finish = { wabaId, phoneNumberId };
        submit();
        return;
      }
      if (record.event === "CANCEL") {
        setMessage(
          record.data?.current_step
            ? `Stopped at ${record.data.current_step}.`
            : "Signup was cancelled before the QR scan finished.",
        );
      }
      if (record.event === "ERROR") {
        setMessage(record.data?.error_message || "WhatsApp signup failed.");
      }
    };

    window.addEventListener("message", onMessage);
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setMessage("Facebook did not return a signup code.");
          window.removeEventListener("message", onMessage);
          return;
        }
        bag.code = code;
        submit();
        window.setTimeout(() => window.removeEventListener("message", onMessage), 60_000);
      },
      {
        config_id: props.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: WHATSAPP_COEXISTENCE_FEATURE,
          sessionInfoVersion: "3",
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 border border-indigo-lift p-4">
      <form
        className="flex flex-col gap-2"
        action={(formData) => {
          startTransition(async () => {
            const result = await saveWhatsappConfigAction(
              String(formData.get("configId") ?? ""),
            );
            setMessage(result.ok ? "Configuration id saved." : result.error);
          });
        }}
      >
        <label className="text-[12px] text-chalk" htmlFor="wa-config-id">
          Facebook Login for Business configuration id
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="wa-config-id"
            name="configId"
            inputMode="numeric"
            value={configId}
            onChange={(event) => setConfigId(event.target.value)}
            className="min-w-0 flex-1 border border-indigo-lift bg-transparent px-2 py-1.5 text-[13px] text-greige"
            placeholder="config_id"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-zari px-3 py-1.5 text-[12px] uppercase tracking-[0.08em] text-indigo disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={launch}
        disabled={!props.canLaunch || !sdkReady || pending}
        className="self-start bg-zari px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-indigo disabled:opacity-40"
      >
        {pending ? "Linking…" : "Link WhatsApp Business app"}
      </button>
      {!props.appSecretConfigured ? (
        <p className="text-[12px] text-chalk">
          Set WHATSAPP_APP_SECRET for app {props.appId} on the server before
          the QR scan can be finished.
        </p>
      ) : null}
      {!props.configId ? (
        <p className="text-[12px] text-chalk">
          Save a configuration id before launching the QR scan.
        </p>
      ) : null}
      {message ? <p className="text-[13px] text-greige">{message}</p> : null}
    </div>
  );
}
