"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  requestTrackOtpAction,
  verifyTrackOtpAction,
} from "./actions";

type TrackGateFormProps = {
  orderNumber: string;
};

export function TrackGateForm({ orderNumber }: TrackGateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="border border-greige-deep bg-greige p-4">
      <p className="text-[15px] leading-relaxed text-ink/75">
        Enter the email you used for this order. We&apos;ll send you a code — no
        account needed.
      </p>

      {message ? (
        <p className="mt-3 text-[14px] text-zari">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-[14px] text-madder">{error}</p>
      ) : null}

      {step === "email" ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await requestTrackOtpAction({ orderNumber, email });
              if (result.ok) {
                setMessage("Check your email for a six-digit code.");
                setStep("code");
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={pending}
            className="border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink"
          />
          <button
            type="submit"
            disabled={pending}
            className="border border-ink bg-ink px-4 py-3 text-[12px] uppercase tracking-[0.08em] text-greige disabled:opacity-40"
          >
            Send code
          </button>
        </form>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await verifyTrackOtpAction({
                orderNumber,
                email,
                code,
              });
              if (result.ok) {
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            disabled={pending}
            className="border border-greige-deep bg-greige px-3 py-2.5 font-data text-[15px] text-ink"
          />
          <button
            type="submit"
            disabled={pending}
            className="border border-ink bg-ink px-4 py-3 text-[12px] uppercase tracking-[0.08em] text-greige disabled:opacity-40"
          >
            View order
          </button>
        </form>
      )}
    </div>
  );
}
