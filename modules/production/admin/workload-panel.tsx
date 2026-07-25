import { cn } from "@/lib/utils";

import type { StaffWorkloadRow } from "../workload";

type WorkloadPanelProps = {
  rows: StaffWorkloadRow[];
};

export function WorkloadPanel({ rows }: WorkloadPanelProps) {
  if (rows.length === 0) return null;

  return (
    <section className="border border-chalk/20 p-3">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-chalk">
        Workload this week
      </h2>
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li
            key={row.staffId}
            className={cn(
              "flex items-center justify-between gap-2 text-[12px]",
              row.overAssigned && "text-madder",
            )}
          >
            <span>
              {row.staffName}{" "}
              <span className="text-chalk">({row.role.toLowerCase()})</span>
            </span>
            <span className="font-mono">
              {row.assignedThisWeek}/{row.capacityPerWeek}
              {row.overAssigned ? " · over" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
