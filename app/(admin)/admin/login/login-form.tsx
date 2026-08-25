"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Step = "email" | "otp" | "2fa";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [totp, setTotp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestOtp() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not send code");
        return;
      }
      setMessage(data.message ?? "Check your email for a sign-in code.");
      setStep("otp");
    });
  }

  function verifyCredentials(extra?: { totp?: string; recoveryCode?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await signIn("otp", {
        email,
        otp,
        totp: extra?.totp ?? "",
        recoveryCode: extra?.recoveryCode ?? "",
        redirect: false,
      });

      if (!result) {
        setError("Sign-in failed");
        return;
      }

      if (result.error) {
        const code = result.code;
        if (code === "2FA_REQUIRED") {
          setStep("2fa");
          setMessage("Enter your authenticator code to continue.");
          return;
        }
        if (code === "2FA_INVALID") {
          setError("Invalid authenticator or recovery code");
          setStep("2fa");
          return;
        }
        if (code === "ACCOUNT_DISABLED") {
          setError("This account is disabled");
          return;
        }
        setError("Invalid email or code");
        return;
      }

      router.replace("/admin");
      router.refresh();
    });
  }

  return (
    <form
      className="mt-8 flex max-w-sm flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "email") requestOtp();
        else if (step === "otp") verifyCredentials();
        else if (useRecovery) verifyCredentials({ recoveryCode });
        else verifyCredentials({ totp });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-[0.12em] text-chalk">
          Email
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={step !== "email" || pending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-chalk/50 bg-indigo-lift px-3 py-2 text-[13px] text-greige outline-none placeholder:text-chalk/60 focus-visible:border-chalk"
        />
      </label>

      {step === "otp" || step === "2fa" ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.12em] text-chalk">
            One-time code
          </span>
          <input
            type="text"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            disabled={step === "2fa" || pending}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="border border-chalk/50 bg-indigo-lift px-3 py-2 font-data text-[13px] tracking-[0.2em] text-greige outline-none focus-visible:border-chalk"
          />
        </label>
      ) : null}

      {step === "2fa" ? (
        useRecovery ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.12em] text-chalk">
              Recovery code
            </span>
            <input
              type="text"
              name="recoveryCode"
              autoComplete="off"
              required
              disabled={pending}
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              className="border border-chalk/50 bg-indigo-lift px-3 py-2 font-data text-[13px] text-greige outline-none focus-visible:border-chalk"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.12em] text-chalk">
              Authenticator code
            </span>
            <input
              type="text"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              disabled={pending}
              value={totp}
              onChange={(e) =>
                setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="border border-chalk/50 bg-indigo-lift px-3 py-2 font-data text-[13px] tracking-[0.2em] text-greige outline-none focus-visible:border-chalk"
            />
          </label>
        )
      ) : null}

      {message ? <p className="text-sm text-chalk">{message}</p> : null}
      {error ? <p className="text-sm text-madder">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-2 text-[13px] font-medium text-ink disabled:opacity-50"
      >
        {pending
          ? "Please wait…"
          : step === "email"
            ? "Send code"
            : step === "otp"
              ? "Sign in"
              : "Verify"}
      </button>

      {step === "2fa" ? (
        <button
          type="button"
          className="text-start text-xs text-chalk underline-offset-2 hover:underline"
          onClick={() => {
            setUseRecovery((v) => !v);
            setError(null);
          }}
        >
          {useRecovery ? "Use authenticator app" : "Use a recovery code"}
        </button>
      ) : null}

      {step !== "email" ? (
        <button
          type="button"
          className="text-start text-xs text-chalk underline-offset-2 hover:underline"
          onClick={() => {
            setStep("email");
            setOtp("");
            setTotp("");
            setRecoveryCode("");
            setError(null);
            setMessage(null);
          }}
        >
          Use a different email
        </button>
      ) : null}
    </form>
  );
}
