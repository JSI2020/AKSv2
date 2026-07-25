"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

import type { ProductionBoardCard, StaffOption } from "../queries";

type ProductionCardProps = {
  card: ProductionBoardCard;
  staff: StaffOption[];
  onAssign: (jobId: string, staffId: string | null) => Promise<void>;
  dragging?: boolean;
};

export function ProductionCard({
  card,
  staff,
  onAssign,
  dragging = false,
}: ProductionCardProps) {
  const daysLabel =
    card.daysToShip === null
      ? "—"
      : card.daysToShip < 0
        ? `${Math.abs(card.daysToShip)}d late`
        : `${card.daysToShip}d`;

  return (
    <article
      className={cn(
        "border bg-indigo p-2 touch-manipulation select-none",
        card.atRisk ? "border-madder bg-madder/10" : "border-chalk/30",
        card.status === "BLOCKED" && "border-madder",
        dragging && "opacity-80",
      )}
    >
      <div className="flex gap-2">
        {card.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.thumbnailUrl}
            alt=""
            className="size-12 shrink-0 border border-chalk/20 object-cover"
          />
        ) : (
          <div className="size-12 shrink-0 border border-chalk/20 bg-indigo-lift" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[12px] text-greige">
            {card.orderNumber}
          </p>
          <p className="truncate text-[13px] text-greige">{card.customerFirstName}</p>
          <p className="truncate text-[11px] text-chalk">{card.designName}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <Link
          href={`/admin/production/${card.id}/spec`}
          className="border border-zari/60 px-1.5 py-0.5 font-mono uppercase tracking-wide text-zari hover:border-zari hover:text-greige"
          onPointerDown={(e) => e.stopPropagation()}
        >
          Spec
        </Link>
        <span className="border border-chalk/30 px-1.5 py-0.5 font-mono uppercase tracking-wide text-chalk">
          {card.sizeModeLabel}
        </span>
        <span
          className={cn(
            "font-mono",
            card.atRisk ? "text-madder" : "text-chalk",
          )}
        >
          {daysLabel}
        </span>
        {card.status === "BLOCKED" ? (
          <span className="text-madder">Blocked</span>
        ) : null}
      </div>

      <label className="mt-2 block text-[10px] uppercase tracking-[0.1em] text-chalk">
        Karigar
        <select
          className="mt-0.5 w-full border border-chalk/30 bg-indigo px-1.5 py-1 text-[12px] text-greige"
          value={card.assignedToId ?? ""}
          onChange={(e) => {
            void onAssign(card.id, e.target.value || null);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {card.blockedReason ? (
        <p className="mt-1 text-[11px] text-madder">{card.blockedReason}</p>
      ) : null}
    </article>
  );
}
