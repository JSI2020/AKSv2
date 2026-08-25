import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Admin indigo ground (default) vs greige/milk surfaces. */
  tone?: "on-indigo" | "on-greige";
};

/**
 * Invitation to begin — not an error.
 * Defaults to admin indigo ground (greige title). Pass `tone="on-greige"` on milk/greige surfaces.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
  tone = "on-indigo",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border border-dashed border-chalk/40 px-6 py-10",
        className,
      )}
    >
      <h2
        className={cn(
          "font-display text-2xl",
          tone === "on-indigo" ? "text-greige" : "text-ink",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-md font-sans text-sm",
            tone === "on-indigo" ? "text-chalk" : "text-ink/70",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
