"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChartFromPhoto } from "./actions";
export function UploadForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <form className="border border-indigo-lift p-4" onSubmit={async (e) => {
    e.preventDefault(); setPending(true); setError("");
    try { const result = await createChartFromPhoto(new FormData(e.currentTarget)); router.push(`/admin/settings/sizing/chart/${result.styleId}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed"); setPending(false); }
  }}>
    <h2 className="font-display text-xl text-greige">Upload garment photo</h2>
    <p className="mb-3 text-[13px] text-chalk">Recognition proposes style attributes only. Measurements come from the deterministic grid.</p>
    <input className="block w-full border border-chalk/40 bg-indigo p-2 text-[12px] text-greige" type="file" name="photo" accept="image/*" required />
    <button className="mt-3 bg-zari px-3 py-1.5 text-[12px] text-ink" disabled={pending}>{pending ? "Building…" : "Build chart"}</button>
    {error ? <p className="mt-2 text-[12px] text-madder">{error}</p> : null}
  </form>;
}
