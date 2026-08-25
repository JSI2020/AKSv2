"use client";
import { useState } from "react";
import type { BodyGrid, StylePomSpec } from "../core/types";
import type { FitWeightDimension, StandardSize } from "../db/enums";
import { hundredthsToInches } from "../core/units";
import { POM_LABELS } from "../ui/labels";
import { saveStylePomsAction, saveTemplatePomsAction } from "./actions";

type Pom = StylePomSpec & { id: string };
type Weight = { id: string; dimension: FitWeightDimension; weight: number };
export function PomEditor({ kind, id, title, poms, weights }: {
  kind: "template" | "style"; id: string; title: string; poms: Pom[]; weights: Weight[]; grid: BodyGrid; baseSize?: StandardSize;
}) {
  const [state, setState] = useState(poms.map((p) => ({ ...p, easeIn: p.ease == null ? "" : String(hundredthsToInches(p.ease)), baseValueIn: p.baseValue == null ? "" : String(hundredthsToInches(p.baseValue)), gradeIncrementIn: String(hundredthsToInches(p.gradeIncrement)) })));
  const [pending, setPending] = useState(false);
  const input = "w-20 border border-chalk/40 bg-indigo px-1 py-0.5 text-end";
  return <section className="border border-indigo-lift"><div className="border-b border-indigo-lift p-3"><h2 className="font-display text-xl text-greige">{title}</h2><p className="text-[12px] text-chalk">Ease and design measurements in inches.</p></div>
    <div className="overflow-x-auto"><table className="w-full text-[12px] text-greige"><thead><tr><th className="p-2 text-start">POM</th><th>Ease</th><th>Base</th><th>Grade</th></tr></thead><tbody>{state.map((p, i) => <tr key={p.id} className="border-t border-indigo-lift"><td className="p-2">{POM_LABELS[p.key]}</td>{(["easeIn", "baseValueIn", "gradeIncrementIn"] as const).map((field) => <td key={field} className="p-2 text-end"><input className={input} value={p[field]} onChange={(e) => setState((all) => all.map((v, n) => n === i ? { ...v, [field]: e.target.value } : v))} /></td>)}</tr>)}</tbody></table></div>
    <button className="m-3 bg-zari px-3 py-1 text-[12px] text-ink" disabled={pending} onClick={async () => { setPending(true); const payload = state.map((p) => ({ id: p.id, easeIn: p.easeIn === "" ? null : Number(p.easeIn), baseValueIn: p.baseValueIn === "" ? null : Number(p.baseValueIn), gradeIncrementIn: Number(p.gradeIncrementIn) })); if (kind === "style") await saveStylePomsAction(id, payload, weights); else await saveTemplatePomsAction(id, payload, weights); setPending(false); }}>{pending ? "Saving…" : "Save & regenerate"}</button>
  </section>;
}
