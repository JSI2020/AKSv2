"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { retryMessageAction } from "@/modules/messaging/actions";

type MessageRow = {
  id: string;
  templateKey: string;
  recipient: string;
  status: string;
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
};

type OrderMessagesPanelProps = {
  messages: MessageRow[];
};

export function OrderMessagesPanel({ messages }: OrderMessagesPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (messages.length === 0) {
    return (
      <p className="text-[13px] text-chalk">No customer emails logged yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-indigo-lift text-[12px]">
      {messages.map((message) => (
        <li key={message.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
          <div>
            <p className="text-greige">{message.templateKey}</p>
            <p className="text-chalk">{message.recipient}</p>
            <p className="mt-1 uppercase tracking-[0.08em] text-chalk">
              {message.status}
            </p>
            {message.error ? (
              <p className="mt-1 text-madder">{message.error}</p>
            ) : null}
          </div>
          {(message.status === "FAILED" || message.status === "DEAD") && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await retryMessageAction(message.id);
                  router.refresh();
                })
              }
              className="border border-zari px-2 py-1 text-[12px] text-zari disabled:opacity-40"
            >
              Retry
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
