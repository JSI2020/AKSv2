"use client";

import { useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import { submitBankTransferReceipt } from "@/modules/payments/bank-transfer/submit-receipt";

import type { BankTransferConfig } from "@/modules/payments/bank-transfer/config";

type OrderInfo = {
  orderNumber: string;
  depositAmountMinor: number;
  hasPendingVerification: boolean;
  status: string;
};

type Props = {
  order: OrderInfo;
  bank: BankTransferConfig;
};

export function BankTransferPayForm({ order, bank }: Props) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(order.hasPendingVerification);

  async function onFile(file: File) {
    setError(null);
    setStatus("presigning");

    try {
      const presignRes = await fetch("/api/assets/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!presignRes.ok) throw new Error(await presignRes.text());
      const { url, key } = (await presignRes.json()) as {
        url: string;
        key: string;
      };

      setStatus("uploading");
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed: ${put.status}`);

      setStatus("submitting");
      startTransition(async () => {
        const result = await submitBankTransferReceipt({
          orderNumber: order.orderNumber,
          key,
          mime: file.type || "image/jpeg",
        });
        if (!result.ok) {
          setError(result.error);
          setStatus("error");
          return;
        }
        setSubmitted(true);
        setStatus("done");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  if (order.status !== "AWAITING_DEPOSIT") {
    return (
      <p className="text-[15px] leading-relaxed text-ink/75">
        This order is no longer waiting for a deposit. Contact us on WhatsApp
        if you need help.
      </p>
    );
  }

  if (submitted) {
    return (
      <div className="border border-greige-deep px-4 py-4">
        <p className="font-display text-[18px] text-ink">Receipt received</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/70">
          We are verifying your transfer. You will hear from us once the deposit
          is confirmed — usually within one working day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border border-greige-deep p-4">
        <h2 className="text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Transfer to
        </h2>
        <dl className="mt-3 space-y-2 text-[14px] text-ink/80">
          <div className="flex justify-between gap-4">
            <dt>Bank</dt>
            <dd className="text-end text-ink">{bank.bankName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Account title</dt>
            <dd className="text-end text-ink">{bank.accountTitle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Account number</dt>
            <dd className="font-data text-end text-ink">{bank.accountNumber}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>IBAN</dt>
            <dd className="font-data text-end text-ink">{bank.iban}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-greige-deep pt-2">
            <dt>Reference</dt>
            <dd className="font-data text-end font-medium text-ink">
              {order.orderNumber}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Amount</dt>
            <dd>
              <Money value={order.depositAmountMinor} className="text-ink" />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-ink/65">
          Use your order number as the payment reference so we can match your
          transfer quickly.
        </p>
      </section>

      <section>
        <h2 className="text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Upload receipt
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/70">
          A screenshot or photo of your bank transfer confirmation is enough.
        </p>
        <label className="mt-4 block border border-greige-deep px-4 py-4">
          <span className="text-[14px] text-ink">Choose an image</span>
          <input
            type="file"
            accept="image/*"
            disabled={pending}
            className="mt-3 block w-full text-[14px] text-ink/80"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </label>
        {status !== "idle" ? (
          <p className="mt-2 text-[13px] text-ink/55">
            {pending || status === "submitting"
              ? "Submitting…"
              : status === "uploading"
                ? "Uploading…"
                : status === "presigning"
                  ? "Preparing upload…"
                  : null}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[14px] text-madder" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
