"use client";
import { useState } from "react";
import { FIT_OUTCOMES, FIT_REASONS, STANDARD_SIZES } from "../db/enums";
import type { FitOutcome, FitReason, StandardSize } from "../db/enums";
import { recordFitEventAction } from "./actions";
export function FitEventForm({ styleId }: { styleId: string }) {
  const [size, setSize] = useState<StandardSize>("M");
  const [outcome, setOutcome] = useState<FitOutcome>("kept");
  const [reason, setReason] = useState<FitReason>("other");
  const select = "border border-chalk/40 bg-indigo px-2 py-1 text-[12px] text-greige";
  return <form className="border border-indigo-lift p-3" onSubmit={async (e) => { e.preventDefault(); await recordFitEventAction({ styleId, size, outcome, reason }); }}>
    <h2 className="mb-2 font-display text-xl text-greige">Record fit event</h2>
    <div className="flex flex-wrap gap-2"><select className={select} value={size} onChange={(e) => setSize(e.target.value as StandardSize)}>{STANDARD_SIZES.map((v) => <option key={v}>{v}</option>)}</select>
      <select className={select} value={outcome} onChange={(e) => setOutcome(e.target.value as FitOutcome)}>{FIT_OUTCOMES.map((v) => <option key={v}>{v}</option>)}</select>
      <select className={select} value={reason} onChange={(e) => setReason(e.target.value as FitReason)}>{FIT_REASONS.map((v) => <option key={v}>{v}</option>)}</select>
      <button className="bg-zari px-3 py-1 text-[12px] text-ink">Save</button></div>
  </form>;
}
