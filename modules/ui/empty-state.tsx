import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Invitation to begin — not an error. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border border-dashed border-chalk/40 px-6 py-10",
        className,
      )}
    >
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {description ? (
        <p className="max-w-md font-sans text-sm text-chalk">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
