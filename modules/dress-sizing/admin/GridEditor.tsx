"use client";
import { useState } from "react";
import type { StandardSize } from "../db/enums";
import { hundredthsToInches } from "../core/units";
import { saveGridRowsAction } from "./actions";

type Row = { id: string; size: StandardSize; bust: number; waist: number; hip: number; shoulder: number; height: number };
export function GridEditor({ rows }: { rows: Row[] }) {
  const [values, setValues] = useState(rows.map((r) => ({ ...r, bustIn: hundredthsToInches(r.bust), waistIn: hundredthsToInches(r.waist), hipIn: hundredthsToInches(r.hip), shoulderIn: hundredthsToInches(r.shoulder), heightIn: hundredthsToInches(r.height) })));
  const [pending, setPending] = useState(false);
  const fields = ["bustIn", "waistIn", "hipIn", "shoulderIn", "heightIn"] as const;
  return <section className="border border-indigo-lift">
    <div className="border-b border-indigo-lift p-3"><h2 className="font-display text-xl text-greige">Body grid</h2><p className="text-[13px] text-chalk">Values are entered in inches and stored as integer hundredths.</p></div>
    <div className="overflow-x-auto"><table className="w-full text-[12px] text-greige"><thead><tr><th className="p-2 text-start">Size</th>{fields.map((f) => <th key={f} className="p-2 text-end">{f.replace("In", "")}</th>)}</tr></thead>
      <tbody>{values.map((row, i) => <tr key={row.id} className="border-t border-indigo-lift"><th className="p-2 text-start">{row.size}</th>{fields.map((field) => <td key={field} className="p-2"><input className="w-20 border border-chalk/40 bg-indigo px-1 py-0.5 text-end" value={row[field]} onChange={(e) => setValues((all) => all.map((v, n) => n === i ? { ...v, [field]: Number(e.target.value) } : v))} /></td>)}</tr>)}</tbody>
    </table></div>
    <button className="m-3 bg-zari px-3 py-1.5 text-[12px] text-ink" disabled={pending} onClick={async () => { setPending(true); await saveGridRowsAction(values); setPending(false); }}>{pending ? "Saving…" : "Save grid"}</button>
  </section>;
}
