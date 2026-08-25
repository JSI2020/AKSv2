"use client";
import { useState } from "react";
import { FIT_INTENTS, GARMENT_TYPES, LENGTH_BANDS } from "../db/enums";
import type { FitIntent, GarmentType, LengthBand } from "../db/enums";
import { updateChartStyle } from "./actions";
export function StyleGuessEditor({ styleId, templateKey, lengthBand, fitIntent }: {
  styleId: string; templateKey: GarmentType; lengthBand: LengthBand; fitIntent: FitIntent;
}) {
  const [type, setType] = useState(templateKey); const [length, setLength] = useState(lengthBand); const [fit, setFit] = useState(fitIntent);
  const cls = "border border-chalk/40 bg-indigo px-2 py-1 text-[12px] text-greige";
  return <div className="border border-indigo-lift p-3"><h2 className="mb-2 font-display text-xl text-greige">Recognized style</h2><div className="flex flex-wrap gap-2">
    <select className={cls} value={type} onChange={(e) => setType(e.target.value as GarmentType)}>{GARMENT_TYPES.map((v) => <option key={v}>{v}</option>)}</select>
    <select className={cls} value={length} onChange={(e) => setLength(e.target.value as LengthBand)}>{LENGTH_BANDS.map((v) => <option key={v}>{v}</option>)}</select>
    <select className={cls} value={fit} onChange={(e) => setFit(e.target.value as FitIntent)}>{FIT_INTENTS.map((v) => <option key={v}>{v}</option>)}</select>
    <button className="bg-zari px-3 py-1 text-[12px] text-ink" onClick={() => updateChartStyle(styleId, { templateKey: type, lengthBand: length, fitIntent: fit })}>Update</button>
  </div></div>;
}
