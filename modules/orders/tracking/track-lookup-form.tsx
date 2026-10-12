"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { lookupOrderAction } from "./actions";

export function TrackLookupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 border border-greige-deep bg-greige p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await lookupOrderAction({
            orderNumber,
            email,
            phone,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(result.href);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-[13px] text-ink/70">
        Order number
        <input
          required
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          disabled={pending}
          autoComplete="off"
          className="border border-greige-deep bg-greige px-3 py-2.5 font-data text-[15px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink/70">
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          autoComplete="email"
          className="border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink/70">
        Phone
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={pending}
          autoComplete="tel"
          className="border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink"
        />
      </label>
      {error ? (
        <p className="text-[14px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="border border-ink bg-ink px-4 py-3 text-[12px] uppercase tracking-[0.08em] text-greige disabled:opacity-40"
      >
        {pending ? "Looking up…" : "View order"}
      </button>
    </form>
  );
}
