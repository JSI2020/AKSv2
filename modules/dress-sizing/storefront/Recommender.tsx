"use client";
import { useState } from "react";
import { recommendSizeAction } from "../admin/actions";
import type { SizeRecommendation } from "../core/recommend";
export function Recommender({ styleId }: { styleId: string; styleName: string }) {
  const [values, setValues] = useState({ bustIn: "37", waistIn: "31", hipIn: "39" });
  const [result, setResult] = useState<SizeRecommendation | null>(null);
  const input = "w-20 border border-chalk/40 bg-indigo px-2 py-1 text-greige";
  return <form className="border border-indigo-lift p-3" onSubmit={async (e) => {
    e.preventDefault();
    setResult(await recommendSizeAction({ styleId, bustIn: Number(values.bustIn), waistIn: Number(values.waistIn), hipIn: Number(values.hipIn) }));
  }}>
    <h2 className="font-display text-xl text-greige">Size recommendation</h2>
    <p className="mb-2 text-[12px] text-chalk">Body measurements in inches.</p>
    <div className="flex flex-wrap gap-2">{(["bustIn", "waistIn", "hipIn"] as const).map((field) => <label key={field} className="text-[11px] text-chalk">{field.replace("In", "")}<input className={`${input} ms-1`} value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })} /></label>)}<button className="bg-zari px-3 py-1 text-ink">Recommend</button></div>
    {result ? <p className="mt-2 text-greige">Recommended: <strong>{result.size}</strong></p> : null}
  </form>;
}
