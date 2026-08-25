"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type OverviewRangePickerProps = {
  fromKey: string;
  toKey: string;
};

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

  return (
    <form
      className="flex flex-wrap items-end gap-3"
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
      <button
        type="button"
        disabled={pending}
        className="border border-ink/20 px-4 py-2 text-[12px] text-ink/55 hover:border-ink hover:text-ink disabled:opacity-50"
        onClick={() => {
          const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Karachi",
          });
          apply(today, today);
        }}
      >
        Today
      </button>
    </form>
  );
}
