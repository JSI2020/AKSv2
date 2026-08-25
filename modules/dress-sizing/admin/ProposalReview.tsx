"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FIT_INTENTS, GARMENT_TYPES, LENGTH_BANDS } from "../db/enums";
import type { FitIntent, GarmentType, LengthBand } from "../db/enums";
import type { TemplateInput } from "../core/instantiate";
import type { BodyGrid } from "../core/types";
import { confirmProposalAction, rejectProposalAction } from "./actions";

export function ProposalReview(props: {
  proposalId: string; imageUrl: string; confidence: number; lowConfidence: boolean;
  initialTemplateKey: GarmentType; initialLengthBand: LengthBand; initialFitIntent: FitIntent;
  templates: TemplateInput[]; grid: BodyGrid;
}) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState(props.initialTemplateKey);
  const [lengthBand, setLengthBand] = useState(props.initialLengthBand);
  const [fitIntent, setFitIntent] = useState(props.initialFitIntent);
  const cls = "border border-chalk/40 bg-indigo px-2 py-1 text-[12px] text-greige";
  return <section className="border border-indigo-lift p-4">
    <h1 className="font-display text-2xl text-greige">Review recognition</h1>
    <p className="mb-3 text-[12px] text-chalk">{props.lowConfidence ? "Low confidence" : `${Math.round(props.confidence * 100)}% confidence`} · measurements are not inferred from the image.</p>
    <div className="flex flex-wrap gap-2">
      <select className={cls} value={templateKey} onChange={(e) => setTemplateKey(e.target.value as GarmentType)}>{GARMENT_TYPES.map((v) => <option key={v}>{v}</option>)}</select>
      <select className={cls} value={lengthBand} onChange={(e) => setLengthBand(e.target.value as LengthBand)}>{LENGTH_BANDS.map((v) => <option key={v}>{v}</option>)}</select>
      <select className={cls} value={fitIntent} onChange={(e) => setFitIntent(e.target.value as FitIntent)}>{FIT_INTENTS.map((v) => <option key={v}>{v}</option>)}</select>
      <button className="bg-zari px-3 py-1 text-[12px] text-ink" onClick={async () => { const r = await confirmProposalAction(props.proposalId, { templateKey, lengthBand, fitIntent }); router.push(`/admin/settings/sizing/chart/styles/${r.styleId}`); }}>Confirm</button>
      <button className="border border-madder px-3 py-1 text-[12px] text-greige" onClick={async () => { await rejectProposalAction(props.proposalId); router.push("/admin/settings/sizing/chart/recognition"); }}>Reject</button>
    </div>
  </section>;
}
