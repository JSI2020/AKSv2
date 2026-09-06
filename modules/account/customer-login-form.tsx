"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

import { useRouter } from "@/i18n/routing";

type Step = "email" | "code" | "profile";

export type SocialProvider = "google" | "facebook";

type Props = {
  /** Where to land after signing in (locale-relative, e.g. "/account/orders"). */
  redirectTo: string;
  /** OAuth providers that are configured on the server. */
  socialProviders: SocialProvider[];
  /** Whether WhatsApp-code sign-in is available. */
  whatsappEnabled: boolean;
};

const inputClass =
  "w-full border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink";
const labelClass =
  "mb-1.5 block text-[12px] uppercase tracking-[0.06em] text-ink/55";

const SOCIAL_LABEL: Record<SocialProvider, string> = {
  google: "Continue with Google",
  facebook: "Continue with Facebook",
};

export function CustomerLoginForm({
  redirectTo,
  socialProviders,
  whatsappEnabled,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Complete sign-in; extra fields are only used when the account is created. */
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
      setError("Something went wrong. Request a new code and try again.");
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
        setError(data.error ?? "Could not send a code. Try again.");
        return;
      }
      setMessage(
        data.devCode
          ? "Dev code filled below."
          : (data.message ?? "Check your email for a sign-in code."),
      );
      if (data.devCode) setCode(data.devCode);
      setStep("code");
    });
  }

  /** Verify the code, then either finish (returning) or ask for a name (new). */
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
        setError(
          data.error ?? "That code didn't work. Request a new one and try again.",
        );
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

  const hasSocial = socialProviders.length > 0 || whatsappEnabled;

  return (
    <div className="mt-6 max-w-sm">
      {hasSocial ? (
        <>
          <div className="flex flex-col gap-2.5">
            {socialProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                disabled={pending}
                onClick={() =>
                  signIn(provider, { callbackUrl: redirectTo })
                }
                className="w-full border border-ink/20 bg-milk px-3 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                {SOCIAL_LABEL[provider]}
              </button>
            ))}
            {whatsappEnabled ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => router.push("/account/login/whatsapp")}
                className="w-full border border-ink/20 bg-milk px-3 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                Continue with WhatsApp
              </button>
            ) : null}
          </div>
          <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-[0.08em] text-ink/40">
            <span className="h-px flex-1 bg-greige-deep" />
            or by email
            <span className="h-px flex-1 bg-greige-deep" />
          </div>
        </>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "email") requestCode();
          else if (step === "code") checkCode();
          else startTransition(() => completeSignIn());
        }}
      >
        <div>
          <label htmlFor="login-email" className={labelClass}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            disabled={step !== "email" || pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        {step === "code" ? (
          <div>
            <label htmlFor="login-code" className={labelClass}>
              One-time code
            </label>
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
              className={`${inputClass} font-data tracking-[0.3em]`}
            />
          </div>
        ) : null}

        {step === "profile" ? (
          <>
            <p className="text-[14px] text-ink/70">
              Welcome — let&apos;s set up your account.
            </p>
            <div>
              <label htmlFor="signup-name" className={labelClass}>
                Your name
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                required
                disabled={pending}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="signup-whatsapp" className={labelClass}>
                WhatsApp number (optional)
              </label>
              <input
                id="signup-whatsapp"
                type="tel"
                autoComplete="tel"
                disabled={pending}
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="03001234567"
                className={inputClass}
              />
              <p className="mt-1.5 text-[12px] text-ink/50">
                For order updates. You can add it later instead.
              </p>
            </div>
            <label className="flex items-start gap-2.5 text-[13px] text-ink/75">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                disabled={pending}
                className="mt-0.5"
              />
              <span>Email me first looks at new editions. No spam.</span>
            </label>
          </>
        ) : null}

        {message ? <p className="text-[14px] text-ink/70">{message}</p> : null}
        {error ? (
          <p className="text-[14px] text-madder" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "Please wait…"
            : step === "email"
              ? "Email me a code"
              : step === "code"
                ? "Continue"
                : "Create account"}
        </button>

        {step !== "email" ? (
          <button
            type="button"
            className="text-start text-[13px] text-ink/60 underline-offset-2 hover:underline"
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
            Use a different email
          </button>
        ) : null}
      </form>

      {step !== "profile" ? (
        <p className="mt-6 text-[13px] leading-relaxed text-ink/55">
          No account needed to order — this is only for order history and saved
          details. New here? Signing in creates your account.
        </p>
      ) : null}
    </div>
  );
}
