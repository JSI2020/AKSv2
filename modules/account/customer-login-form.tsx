"use client";

import { useState, useTransition, type ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/routing";
import { authChannelAction } from "@/modules/auth/social/channel";
import type {
  AuthChannelKey,
  AuthChannelState,
} from "@/modules/auth/social-providers";

import {
  EmailChannelIcon,
  FacebookChannelIcon,
  GoogleChannelIcon,
  InstagramChannelIcon,
  TikTokChannelIcon,
  WhatsAppChannelIcon,
} from "./auth-channel-icons";

type Step = "email" | "code" | "profile";

type Props = {
  /** Where to land after signing in (locale-relative, e.g. "/account/orders"). */
  redirectTo: string;
  /** Channel buttons: live ones sign in; soon ones stay visible but disabled. */
  channels: AuthChannelState[];
  /** Prefill from Auth.js redirect (?error=…) — shop OAuth failures. */
  initialError?: string | null;
};

const CHANNEL_ICON: Record<AuthChannelKey, ReactNode> = {
  whatsapp: <WhatsAppChannelIcon className="auth-channel-icon" />,
  facebook: <FacebookChannelIcon className="auth-channel-icon" />,
  instagram: <InstagramChannelIcon className="auth-channel-icon" />,
  tiktok: <TikTokChannelIcon className="auth-channel-icon" />,
  google: <GoogleChannelIcon className="auth-channel-icon" />,
};

export function CustomerLoginForm({
  redirectTo,
  channels,
  initialError = null,
}: Props) {
  const t = useTranslations("AccountLogin");
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function completeSignIn() {
    const result = await signIn("customer-otp", {
      email,
      otp: code,
      name: name || undefined,
      phone: whatsapp || undefined,
      acceptsMarketing: marketing ? "true" : "false",
      redirect: false,
    });
    if (!result || result.error) {
      setError(t("errorGeneric"));
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  function requestCode() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/customer/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        devCode?: string;
      };
      if (!res.ok) {
        setError(data.error ?? t("errorSendCode"));
        return;
      }
      setMessage(
        data.devCode ? t("devCodeFilled") : (data.message ?? t("checkEmail")),
      );
      if (data.devCode) setCode(data.devCode);
      setStep("code");
    });
  }

  function checkCode() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/customer/otp/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        isNew?: boolean;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? t("errorBadCode"));
        return;
      }
      if (data.isNew) {
        setMessage(null);
        setStep("profile");
        return;
      }
      await completeSignIn();
    });
  }

  function onChannel(channel: AuthChannelState) {
    if (pending) return;
    const action = authChannelAction(channel);
    if (action.type === "ignore") return;
    if (action.type === "route") {
      router.push(action.href);
      return;
    }
    void signIn(action.provider, { callbackUrl: redirectTo });
  }

  const channelLabel = (key: AuthChannelKey) => {
    switch (key) {
      case "whatsapp":
        return t("channelWhatsapp");
      case "facebook":
        return t("channelFacebook");
      case "instagram":
        return t("channelInstagram");
      case "tiktok":
        return t("channelTiktok");
      case "google":
        return t("channelGoogle");
    }
  };

  const liveChannels = channels.filter((c) => c.status === "live");
  const soonChannels = channels.filter((c) => c.status === "soon");
  const emailLeads = liveChannels.length === 0;

  function renderChannels(list: AuthChannelState[]) {
    if (list.length === 0) return null;
    return (
      <div className="auth-channels" role="list">
        {list.map((channel) => {
          const live = channel.status === "live";
          return (
            <button
              key={channel.key}
              type="button"
              role="listitem"
              disabled={!live || pending}
              aria-disabled={!live}
              onClick={() => onChannel(channel)}
              className={`auth-channel${live ? "" : " is-soon"}`}
            >
              <span className="auth-channel-mark" aria-hidden>
                {CHANNEL_ICON[channel.key]}
              </span>
              <span className="auth-channel-label">
                {channelLabel(channel.key)}
              </span>
              {!live ? (
                <span className="auth-channel-soon">{t("soon")}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="auth-form">
      {step === "email" && !emailLeads ? (
        <>
          {renderChannels(liveChannels)}
          <div className="auth-divider" role="separator">
            <span>{t("orEmail")}</span>
          </div>
        </>
      ) : null}

      <form
        className="auth-fields"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "email") requestCode();
          else if (step === "code") checkCode();
          else startTransition(() => completeSignIn());
        }}
      >
        <div className="auth-field">
          <label htmlFor="login-email">{t("emailLabel")}</label>
          <div className="auth-input-wrap">
            <EmailChannelIcon className="auth-input-icon" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              disabled={step !== "email" || pending}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
            />
          </div>
        </div>

        {step === "code" ? (
          <div className="auth-field">
            <label htmlFor="login-code">{t("codeLabel")}</label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              disabled={pending}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="auth-code"
            />
          </div>
        ) : null}

        {step === "profile" ? (
          <>
            <p className="auth-note">{t("welcomeNew")}</p>
            <div className="auth-field">
              <label htmlFor="signup-name">{t("nameLabel")}</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                required
                disabled={pending}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="signup-whatsapp">{t("whatsappOptional")}</label>
              <input
                id="signup-whatsapp"
                type="tel"
                autoComplete="tel"
                disabled={pending}
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder={t("whatsappPlaceholder")}
              />
              <p className="auth-hint">{t("whatsappHint")}</p>
            </div>
            <label className="auth-check">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                disabled={pending}
              />
              <span>{t("marketingOptIn")}</span>
            </label>
          </>
        ) : null}

        {message ? <p className="auth-message">{message}</p> : null}
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? t("pleaseWait")
            : step === "email"
              ? t("emailCode")
              : step === "code"
                ? t("continue")
                : t("createAccount")}
        </button>

        {step !== "email" ? (
          <button
            type="button"
            className="auth-back"
            onClick={() => {
              setStep("email");
              setCode("");
              setName("");
              setWhatsapp("");
              setMarketing(false);
              setError(null);
              setMessage(null);
            }}
          >
            {t("differentEmail")}
          </button>
        ) : null}
      </form>

      {step === "email" && soonChannels.length > 0 ? (
        <details className="auth-soon-details">
          <summary>{emailLeads ? t("orChannels") : t("alsoSoon")}</summary>
          {renderChannels(soonChannels)}
        </details>
      ) : null}

      {step !== "profile" ? (
        <p className="auth-footnote">{t("footnote")}</p>
      ) : null}
    </div>
  );
}
