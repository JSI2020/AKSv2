"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  completeTotpEnrolmentAction,
  startTotpEnrolmentAction,
} from "./actions";

export function TotpEnrolForm({ email }: { email: string }) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEnrolment() {
    setError(null);
    startTransition(async () => {
      const result = await startTotpEnrolmentAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSecret(result.secret);
      setQrDataUrl(result.qrDataUrl);
    });
  }

  function confirm() {
    if (!secret) return;
    setError(null);
    startTransition(async () => {
      const result = await completeTotpEnrolmentAction({ secret, code });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRecoveryCodes(result.recoveryCodes);
    });
  }

  if (recoveryCodes) {
    return (
      <div className="mt-8 max-w-md space-y-4">
        <p className="text-sm text-greige">
          Save these recovery codes now. Each can be used once. They will not be
          shown again.
        </p>
        <ul className="border border-indigo-lift p-4 font-data text-sm tracking-wide text-greige">
          {recoveryCodes.map((c) => (
            <li key={c} className="py-1">
              {c}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="border border-zari bg-zari px-3 py-2 text-[13px] font-medium text-ink"
          onClick={() => {
            router.replace("/admin");
            router.refresh();
          }}
        >
          Continue to admin
        </button>
      </div>
    );
  }

  if (!secret || !qrDataUrl) {
    return (
      <div className="mt-8 max-w-md space-y-4">
        <p className="text-sm text-chalk">
          Two-factor authentication is required for {email}. Scan a QR code with
          your authenticator app.
        </p>
        {error ? <p className="text-sm text-madder">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={startEnrolment}
          className="border border-zari bg-zari px-3 py-2 text-[13px] font-medium text-ink disabled:opacity-50"
        >
          {pending ? "Preparing…" : "Set up authenticator"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-8 flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        confirm();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrDataUrl}
        alt="Authenticator QR code"
        className="size-60 border border-indigo-lift bg-greige p-2"
      />
      <p className="font-data text-xs break-all text-chalk">
        Manual secret: {secret}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-[0.12em] text-chalk">
          Confirm with a code
        </span>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          disabled={pending}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="border border-indigo-lift bg-indigo px-3 py-2 font-data text-[13px] tracking-[0.2em] text-greige outline-none focus-visible:border-chalk"
        />
      </label>
      {error ? <p className="text-sm text-madder">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-2 text-[13px] font-medium text-ink disabled:opacity-50"
      >
        {pending ? "Verifying…" : "Enable 2FA"}
      </button>
    </form>
  );
}
