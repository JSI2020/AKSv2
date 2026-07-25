"use client";

import { useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import {
  rejectBankTransferAction,
  verifyBankTransferAction,
} from "@/modules/payments/bank-transfer/verify-actions";

import type { VerificationQueueItem } from "@/modules/payments/bank-transfer/queries";

type Props = {
  items: VerificationQueueItem[];
};

export function VerificationQueue({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleVerify(paymentId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await verifyBankTransferAction(paymentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.paymentId !== paymentId));
      setMessage(`Verified — order ${result.orderNumber} advanced to deposit paid.`);
    });
  }

  function handleReject(paymentId: string) {
    if (!rejectReason.trim()) {
      setError("Enter a reason for rejection.");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await rejectBankTransferAction({
        paymentId,
        reason: rejectReason,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.paymentId !== paymentId));
      setRejectingId(null);
      setRejectReason("");
      setMessage("Receipt rejected — customer can upload again.");
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-chalk">
        No bank transfer receipts waiting — enjoy the quiet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="border border-indigo-lift px-3 py-2 text-[13px] text-greige">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="border border-madder px-3 py-2 text-[13px] text-madder">
          {error}
        </p>
      ) : null}

      {items.map((item) => (
        <article
          key={item.paymentId}
          className="grid gap-4 border border-indigo-lift p-3 md:grid-cols-[180px_1fr_auto]"
        >
          <div className="min-h-[120px] border border-indigo-lift bg-indigo-deep">
            {item.receiptUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.receiptUrl}
                alt={`Receipt for ${item.orderNumber}`}
                className="h-full max-h-[240px] w-full object-contain"
              />
            ) : (
              <p className="p-3 text-[12px] text-chalk">No receipt image</p>
            )}
          </div>

          <div className="text-[13px] text-greige">
            <p className="font-data text-[14px]">{item.orderNumber}</p>
            <p className="mt-1 text-chalk">{item.customerName}</p>
            <p className="mt-2">
              Expected{" "}
              <Money value={item.amountMinor} className="inline text-greige" />{" "}
              · {item.kind.toLowerCase()}
            </p>
            <p className="mt-1 text-[12px] text-chalk">
              Submitted {item.submittedAt.toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleVerify(item.paymentId)}
              className="border border-zari bg-zari px-3 py-2 text-[12px] uppercase tracking-[0.06em] text-indigo disabled:opacity-40"
            >
              Verify
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                setRejectingId(
                  rejectingId === item.paymentId ? null : item.paymentId,
                )
              }
              className="border border-indigo-lift px-3 py-2 text-[12px] uppercase tracking-[0.06em] text-chalk disabled:opacity-40"
            >
              Reject
            </button>
            {rejectingId === item.paymentId ? (
              <div className="flex flex-col gap-2">
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason — shown to ops, not auto-sent"
                  className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[12px] text-greige"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleReject(item.paymentId)}
                  className="border border-madder px-3 py-1.5 text-[12px] text-madder disabled:opacity-40"
                >
                  Confirm reject
                </button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
