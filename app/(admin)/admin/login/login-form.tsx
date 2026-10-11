"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { PasswordField } from "./password-field";

/**
 * signin  → email + password
 * 2fa     → authenticator (Owner/Admin on the live site)
 * forgot  → email, sends a 6-digit code
 * reset   → code + new password, then signs in with it
 */
type Step = "signin" | "2fa" | "forgot" | "reset";

const inputClass =
  "border border-chalk/50 bg-indigo-lift px-3 py-2 text-[13px] text-greige outline-none placeholder:text-chalk/60 focus-visible:border-chalk disabled:opacity-60";
const codeClass =
  "border border-chalk/50 bg-indigo-lift px-3 py-2 font-data text-[13px] tracking-[0.2em] text-greige outline-none focus-visible:border-chalk";
const linkClass =
  "text-start text-xs text-chalk underline-offset-2 hover:text-greige hover:underline";

export function LoginForm({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("signin");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totp, setTotp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(next: Step) {
    setStep(next);
    setError(null);
    setMessage(null);
  }

  async function signInWith(pw: string, extra?: { totp?: string; recoveryCode?: string }) {
    const result = await signIn("password", {
      email,
      password: pw,
      totp: extra?.totp ?? "",
      recoveryCode: extra?.recoveryCode ?? "",
      redirect: false,
    });

    if (!result) {
      setError("Sign-in failed");
      return;
    }

    if (result.error) {
      switch (result.code) {
        case "2FA_REQUIRED":
          setStep("2fa");
          setMessage("Enter the 6-digit code from your authenticator app.");
          return;
        case "2FA_INVALID":
          setStep("2fa");
          setError("That authenticator or recovery code didn't work.");
          return;
        case "ACCOUNT_DISABLED":
          setError("This account has been disabled.");
          return;
        case "TEMP_EXPIRED":
          setError(
            "Your one-time password has expired. Use “Forgot password” to set a new one.",
          );
          return;
        default:
          setError("Wrong email or password.");
          return;
      }
    }

    // Middleware sends first-timers to set a password, Owner/Admin to 2FA setup.
    router.replace("/admin");
    router.refresh();
  }

  function requestCode() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        devCode?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not send the code.");
        return;
      }
      if (data.devCode) setCode(data.devCode);
      setStep("reset");
      setMessage(
        data.devCode
          ? "Dev: code filled in below."
          : "If that email belongs to a staff account, a 6-digit code is on its way. It's valid for 10 minutes.",
      );
    });
  }

  function resetPassword() {
    if (newPassword !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code, password: newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset the password.");
        return;
      }
      setPassword(newPassword);
      setMessage("Password changed. Signing you in…");
      await signInWith(newPassword);
    });
  }

  const title =
    step === "forgot" || step === "reset" ? "Reset your password" : null;

  return (
    <form
      className="mt-8 flex max-w-sm flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (step === "signin") {
          startTransition(async () => {
            setError(null);
            await signInWith(password);
          });
        } else if (step === "2fa") {
          startTransition(async () => {
            setError(null);
            await signInWith(
              password,
              useRecovery ? { recoveryCode } : { totp },
            );
          });
        } else if (step === "forgot") {
          requestCode();
        } else {
          resetPassword();
        }
      }}
    >
      {title ? (
        <p className="text-sm font-medium text-greige">{title}</p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-[0.12em] text-chalk">
          Email
        </span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          disabled={step === "2fa" || step === "reset" || pending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>

      {step === "signin" ? (
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          disabled={pending}
        />
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
              className={inputClass}
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
              autoFocus
              disabled={pending}
              value={totp}
              onChange={(e) =>
                setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={codeClass}
            />
          </label>
        )
      ) : null}

      {step === "reset" ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.12em] text-chalk">
              Code from your email
            </span>
            <input
              type="text"
              name="code"
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
              className={codeClass}
            />
          </label>
          <PasswordField
            label="New password"
            name="new-password"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            disabled={pending}
            hint="At least 10 characters, with a letter and a number."
          />
          <PasswordField
            label="Repeat new password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            disabled={pending}
          />
        </>
      ) : null}

      {message ? <p className="text-sm text-chalk">{message}</p> : null}
      {error ? (
        <p className="text-sm text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-2 text-[13px] font-medium text-ink disabled:opacity-50"
      >
        {pending
          ? "Please wait…"
          : step === "signin"
            ? "Sign in"
            : step === "2fa"
              ? "Verify"
              : step === "forgot"
                ? "Email me a code"
                : "Set password and sign in"}
      </button>

      {step === "signin" ? (
        <button type="button" className={linkClass} onClick={() => go("forgot")}>
          Forgot your password?
        </button>
      ) : null}

      {step === "2fa" ? (
        <button
          type="button"
          className={linkClass}
          onClick={() => {
            setUseRecovery((v) => !v);
            setError(null);
          }}
        >
          {useRecovery ? "Use authenticator app" : "Lost your phone? Use a recovery code"}
        </button>
      ) : null}

      {step !== "signin" ? (
        <button
          type="button"
          className={linkClass}
          onClick={() => {
            setTotp("");
            setRecoveryCode("");
            setCode("");
            setNewPassword("");
            setConfirm("");
            go("signin");
          }}
        >
          Back to sign in
        </button>
      ) : null}
    </form>
  );
}
