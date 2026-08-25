"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STANDARD_SIZES } from "../db/enums";
import type { PomKey, StandardSize } from "../db/enums";
import type { DisplayUnit } from "../core/units";
import { formatLength } from "../core/units";
import { POM_LABELS } from "../ui/labels";
import { regradeFromBaseSize } from "../admin/actions";
import { HALF_POMS, storedHundredthsFromDisplay, type ChartSpan } from "./chart-cells";

export type ChartCell = { size: StandardSize; pomKey: PomKey; valueHundredths: number };

export function ChartTable({ rows, styleId, baseSize = "M" }: {
  rows: ChartCell[]; caption?: string; styleId?: string; baseSize?: StandardSize;
}) {
  const router = useRouter();
  const [unit, setUnit] = useState<DisplayUnit>("in");
  const [span, setSpan] = useState<ChartSpan>("full");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const poms = [...new Set(rows.map((row) => row.pomKey))];
  const value = (pom: PomKey, size: StandardSize) => rows.find((row) => row.pomKey === pom && row.size === size)?.valueHundredths;
  const shown = (pom: PomKey, size: StandardSize) => {
    const raw = value(pom, size);
    if (raw == null) return "—";
    return formatLength(span === "half" && HALF_POMS.includes(pom) ? raw / 2 : raw, unit);
  };
  async function save() {
    if (!styleId) return;
    setPending(true);
    const payload: Partial<Record<PomKey, number>> = {};
    for (const pom of poms) {
      const raw = draft[pom];
      if (raw) payload[pom] = storedHundredthsFromDisplay(Number(raw), pom, span, unit);
    }
    await regradeFromBaseSize(styleId, payload);
    setPending(false);
    router.refresh();
  }
  const button = "border border-chalk/50 px-2 py-1 text-[11px] text-greige hover:bg-indigo-lift";
  return (
    <div className="overflow-x-auto border border-indigo-lift">
      <div className="flex flex-wrap justify-end gap-2 border-b border-indigo-lift p-2">
        <button className={button} onClick={() => setSpan(span === "full" ? "half" : "full")}>{span === "full" ? "Full" : "One side"}</button>
        <button className={button} onClick={() => setUnit(unit === "in" ? "cm" : "in")}>{unit === "in" ? "Inches" : "cm"}</button>
        {styleId ? <button className="bg-zari px-3 py-1 text-[11px] text-ink" disabled={pending} onClick={save}>{pending ? "Saving…" : "Update"}</button> : null}
      </div>
      <table className="w-full min-w-[680px] border-collapse text-[12px] text-greige">
        <thead><tr className="bg-indigo-lift/40"><th className="p-2 text-start">Measurement</th>{STANDARD_SIZES.map((s) => <th key={s} className="p-2 text-end">{s}</th>)}</tr></thead>
        <tbody>{poms.map((pom) => <tr key={pom} className="border-t border-indigo-lift">
          <th className="p-2 text-start font-normal">{POM_LABELS[pom]}</th>
          {STANDARD_SIZES.map((size) => <td key={size} className="p-2 text-end font-data">
            {styleId && size === baseSize ? <input className="w-20 border border-chalk/40 bg-indigo px-1 py-0.5 text-end" placeholder={shown(pom, size).replace(/ .*/, "")} value={draft[pom] ?? ""} onChange={(e) => setDraft({ ...draft, [pom]: e.target.value })} /> : shown(pom, size)}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
  );
}
