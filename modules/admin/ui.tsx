import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared admin visual kit — one consistent header, stat tile, status badge and
 * meter across every tab, so the portal reads as a single system. All colors
 * come from the palette tokens; semantic status uses zari / indigo / madder.
 */

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-ink/50">
          {eyebrow}
        </p>
        <h1 className="font-display text-[2.1rem] font-light leading-none text-ink">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[13px] text-ink/55">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.06] text-ink/60",
  success: "bg-zari/15 text-zari",
  warning: "bg-zari/15 text-zari",
  error: "bg-madder/12 text-madder",
  info: "bg-indigo/10 text-indigo",
  accent: "bg-indigo/10 text-indigo",
};

export function StatusBadge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.06em]",
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  icon,
  hint,
  trend,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  trend?: { value: string; positive: boolean };
  /** Optional accent for the value (e.g. madder for an at-risk count). */
  tone?: "ink" | "madder" | "zari";
}) {
  const valueTone =
    tone === "madder"
      ? "text-madder"
      : tone === "zari"
        ? "text-zari"
        : "text-ink";
  return (
    <div className="flex flex-col gap-2 border border-ink/12 bg-milk px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-ink/50">
          {label}
        </span>
        {icon ? <span className="text-ink/40">{icon}</span> : null}
      </div>
      <p className={cn("font-display text-[1.9rem] font-light leading-none", valueTone)}>
        {value}
      </p>
      {trend ? (
        <p
          className={cn(
            "font-sans text-[11px] font-medium",
            trend.positive ? "text-zari" : "text-madder",
          )}
        >
          {trend.positive ? "▲ " : "▼ "}
          {trend.value}
        </p>
      ) : null}
      {hint ? <p className="text-[11px] text-ink/50">{hint}</p> : null}
    </div>
  );
}

/**
 * A slim horizontal meter — stock level, usage, capacity. `tone` colors the
 * fill; pass `over` to show the value exceeding its target (turns madder).
 */
export function MeterBar({
  value,
  max,
  tone = "zari",
  label,
  className,
}: {
  value: number;
  max: number;
  tone?: "zari" | "madder" | "indigo";
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill =
    tone === "madder"
      ? "bg-madder"
      : tone === "indigo"
        ? "bg-indigo"
        : "bg-zari";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <div className="flex items-baseline justify-between text-[11px] text-ink/55">
          <span>{label}</span>
          <span className="font-data text-ink/70">{pct}%</span>
        </div>
      ) : null}
      <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-ink/[0.08]">
        <div className={cn("h-full rounded-[1px]", fill)} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}
