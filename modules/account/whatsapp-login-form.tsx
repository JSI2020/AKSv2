"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

import { Link, useRouter } from "@/i18n/routing";

type Step = "phone" | "code";

const inputClass =
  "w-full border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink";
const labelClass =
  "mb-1.5 block text-[12px] uppercase tracking-[0.06em] text-ink/55";

export function WhatsappLoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestCode() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/customer/whatsapp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
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
          : (data.message ?? "Check WhatsApp for your sign-in code."),
      );
      if (data.devCode) setCode(data.devCode);
      setStep("code");
    });
  }

  function verify() {
    setError(null);
    startTransition(async () => {
      const result = await signIn("customer-whatsapp", {
        phone,
        otp: code,
        redirect: false,
      });
      if (!result || result.error) {
        setError("That code didn't work. Request a new one and try again.");
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 max-w-sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "phone") requestCode();
          else verify();
        }}
      >
        <div>
          <label htmlFor="wa-phone" className={labelClass}>
            WhatsApp number
          </label>
          <input
            id="wa-phone"
            type="tel"
            autoComplete="tel"
            required
            disabled={step !== "phone" || pending}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03001234567"
            className={inputClass}
          />
        </div>

        {step === "code" ? (
          <div>
            <label htmlFor="wa-code" className={labelClass}>
              Code from WhatsApp
            </label>
            <input
              id="wa-code"
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

        {message ? <p className="text-[14px] text-ink/70">{message}</p> : null}
        {error ? (
          <p className="text-[14px] text-madder" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "Please wait…"
            : step === "phone"
              ? "Send me a code"
              : "Sign in"}
        </button>

        {step === "code" ? (
          <button
            type="button"
            className="text-start text-[13px] text-ink/60 underline-offset-2 hover:underline"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
              setMessage(null);
            }}
          >
            Use a different number
          </button>
        ) : null}
      </form>

      <Link
        href="/account/login"
        className="mt-6 inline-block text-[13px] text-ink/60 underline-offset-2 hover:underline"
      >
        ← Other ways to sign in
      </Link>
    </div>
  );
}
