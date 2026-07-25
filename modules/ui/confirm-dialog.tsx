"use client";

import { type ReactNode, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  trigger: ReactNode;
  onConfirm: () => void | Promise<void>;
  className?: string;
};

/** Destructive confirmation — madder accent. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  trigger,
  onConfirm,
  className,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const descId = useId();

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("inline-flex", className)}>
      <span
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {trigger}
      </span>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          role="presentation"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            className="w-full max-w-md border border-madder bg-greige p-6 text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="font-display text-2xl text-madder">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-2 font-sans text-sm text-chalk">
                {description}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => void handleConfirm()}
                className="bg-madder text-greige hover:bg-madder/90"
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
