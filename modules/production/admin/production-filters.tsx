"use client";

import { useQueryStates } from "nuqs";

import { cn } from "@/lib/utils";
import { AdminTimeFilter } from "@/modules/admin/time-filter";

import {
  PRODUCTION_JOB_STAGES,
  PRODUCTION_STAGE_LABELS,
} from "../constants";
import type { StaffOption } from "../queries";
import { productionBoardParsers } from "./search-params";

type ProductionFiltersProps = {
  staff: StaffOption[];
};

export function ProductionFilters({ staff }: ProductionFiltersProps) {
  const [params, setParams] = useQueryStates(productionBoardParsers);

  function toggleStage(stage: (typeof PRODUCTION_JOB_STAGES)[number]) {
    const next = params.stage.includes(stage)
      ? params.stage.filter((s) => s !== stage)
      : [...params.stage, stage];
    void setParams({ stage: next });
  }

  function toggleStaff(id: string) {
    const next = params.staff.includes(id)
      ? params.staff.filter((s) => s !== id)
      : [...params.staff, id];
    void setParams({ staff: next });
  }

  return (
    <div className="space-y-3 border border-chalk/20 p-3">
      <AdminTimeFilter />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "border px-2 py-1 text-[11px] uppercase tracking-wide",
            params.atRisk
              ? "border-madder text-madder"
              : "border-chalk/30 text-chalk",
          )}
          onClick={() => void setParams({ atRisk: params.atRisk ? null : true })}
        >
          At risk
        </button>
        {(["STANDARD", "MADE_TO_MEASURE"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              "border px-2 py-1 text-[11px] uppercase tracking-wide",
              params.sizeMode.includes(mode)
                ? "border-zari text-greige"
                : "border-chalk/30 text-chalk",
            )}
            onClick={() => {
              const next = params.sizeMode.includes(mode)
                ? params.sizeMode.filter((m) => m !== mode)
                : [...params.sizeMode, mode];
              void setParams({ sizeMode: next });
            }}
          >
            {mode === "STANDARD" ? "M" : "Custom"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PRODUCTION_JOB_STAGES.filter((s) => s !== "PACKED").map((stage) => (
          <button
            key={stage}
            type="button"
            className={cn(
              "border px-2 py-1 text-[11px]",
              params.stage.includes(stage)
                ? "border-zari text-greige"
                : "border-chalk/30 text-chalk",
            )}
            onClick={() => toggleStage(stage)}
          >
            {PRODUCTION_STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      {staff.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                "border px-2 py-1 text-[11px]",
                params.staff.includes(s.id)
                  ? "border-zari text-greige"
                  : "border-chalk/30 text-chalk",
              )}
              onClick={() => toggleStaff(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
