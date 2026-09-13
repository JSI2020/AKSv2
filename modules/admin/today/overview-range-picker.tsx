"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

type OverviewRangePickerProps = {
  fromKey: string;
  toKey: string;
};

function shopTodayKey(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Karachi",
  });
}

function shiftDays(fromKey: string, days: number): string {
  const d = new Date(`${fromKey}T12:00:00+05:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

/** From / to duration for Overview numbers (URL ?from=&to=). */
export function OverviewRangePicker({
  fromKey,
  toKey,
}: OverviewRangePickerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    params.set("from", nextFrom);
    params.set("to", nextTo);
    startTransition(() => {
      router.push(`/admin?${params.toString()}`);
    });
  }

  const today = shopTodayKey();
  const presets = [
    { id: "today", label: "Today", from: today, to: today },
    { id: "7d", label: "7d", from: shiftDays(today, -6), to: today },
    { id: "30d", label: "30d", from: shiftDays(today, -29), to: today },
  ] as const;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {presets.map((p) => {
          const active = fromKey === p.from && toKey === p.to;
          return (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => apply(p.from, p.to)}
              className={cn(
                "border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] disabled:opacity-50",
                active
                  ? "border-ink bg-ink text-milk"
                  : "border-ink/20 text-ink/60 hover:border-ink hover:text-ink",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const from = String(fd.get("from") ?? fromKey);
          const to = String(fd.get("to") ?? toKey);
          apply(from, to);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={fromKey}
            className="border border-ink/12 bg-milk px-3 py-2 font-data text-[13px] text-ink outline-none focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={toKey}
            className="border border-ink/12 bg-milk px-3 py-2 font-data text-[13px] text-ink outline-none focus:border-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.1em] text-milk disabled:opacity-50"
        >
          {pending ? "…" : "Apply"}
        </button>
      </form>
    </div>
  );
}
